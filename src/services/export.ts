// HealthVault — Encrypted export / import
// Serializes all IndexedDB data → encrypts with passphrase → .healthvault file
// Import: decrypt → merge (newer wins)

import { db, getSettings, updateSettings } from './db';
import { encrypt, decrypt } from './crypto';
import type {
  HealthProfile,
  InteractionLog,
  FoodScanRecord,
  AppSettings,
} from '../types';

/** The shape of a .healthvault export file (before encryption) */
interface ExportPayload {
  version: 1;
  exportedAt: number;
  healthProfile: HealthProfile[];
  interactionLog: InteractionLog[];
  foodScanHistory: FoodScanRecord[];
  appSettings: AppSettings[];
}

/**
 * Export all local data as an encrypted `.healthvault` file download.
 */
export async function exportData(passphrase: string): Promise<void> {
  const [profiles, interactions, scans, settings] = await Promise.all([
    db.healthProfile.toArray(),
    db.interactionLog.toArray(),
    db.foodScanHistory.toArray(),
    db.appSettings.toArray(),
  ]);

  const payload: ExportPayload = {
    version: 1,
    exportedAt: Date.now(),
    healthProfile: profiles,
    interactionLog: interactions,
    foodScanHistory: scans,
    // Strip API keys / encrypted config from export to prevent credential leakage
    appSettings: settings.map((s) => ({
      ...s,
      providerConfigs: {},
      encryptedProviderConfigs: undefined,
    })),
  };

  const encrypted = await encrypt(JSON.stringify(payload), passphrase);

  // Trigger browser download
  const blob = new Blob([encrypted], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `healthvault-backup-${new Date().toISOString().slice(0, 10)}.healthvault`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import a `.healthvault` file, decrypt it and merge into IndexedDB.
 * Strategy: for each record, insert if no matching ID exists; otherwise
 * keep whichever row has the newer timestamp / updatedAt.
 */
export async function importData(
  file: File,
  passphrase: string,
): Promise<{ imported: number; skipped: number }> {
  const fileText = await file.text();
  const json = await decrypt(fileText, passphrase);
  const payload: ExportPayload = JSON.parse(json);

  if (payload.version !== 1) {
    throw new Error(`Unsupported export version: ${payload.version}`);
  }

  let imported = 0;
  let skipped = 0;

  // Merge health profiles (keep newest updatedAt)
  for (const incoming of payload.healthProfile) {
    const existing = incoming.id
      ? await db.healthProfile.get(incoming.id)
      : undefined;
    if (!existing || incoming.updatedAt > existing.updatedAt) {
      await db.healthProfile.put(incoming);
      imported++;
    } else {
      skipped++;
    }
  }

  // Merge interaction logs (insert if missing)
  for (const incoming of payload.interactionLog) {
    const existing = incoming.id
      ? await db.interactionLog.get(incoming.id)
      : undefined;
    if (!existing) {
      await db.interactionLog.put(incoming);
      imported++;
    } else {
      skipped++;
    }
  }

  // Merge food scans (insert if missing)
  for (const incoming of payload.foodScanHistory) {
    const existing = incoming.id
      ? await db.foodScanHistory.get(incoming.id)
      : undefined;
    if (!existing) {
      await db.foodScanHistory.put(incoming);
      imported++;
    } else {
      skipped++;
    }
  }

  // Merge app settings (overwrite with imported version, but preserve local provider configs)
  if (payload.appSettings.length > 0) {
    const incoming = payload.appSettings[0];
    const current = await getSettings();
    await updateSettings({
      selectedProviderId:
        incoming.selectedProviderId || current.selectedProviderId,
      // Don't import providerConfigs — they are excluded from exports
      // and should never overwrite locally configured API keys
      onboardingComplete:
        incoming.onboardingComplete || current.onboardingComplete,
    });
    imported++;
  }

  return { imported, skipped };
}
