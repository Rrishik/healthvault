import Dexie, { type Table } from 'dexie';
import type {
  HealthProfile,
  InteractionLog,
  FoodScanRecord,
  AppSettings,
} from '../types';

class HealthVaultDB extends Dexie {
  healthProfile!: Table<HealthProfile, number>;
  interactionLog!: Table<InteractionLog, number>;
  foodScanHistory!: Table<FoodScanRecord, number>;
  appSettings!: Table<AppSettings, number>;

  constructor() {
    super('HealthVaultDB');
    this.version(1).stores({
      healthProfile: '++id, updatedAt',
      interactionLog: '++id, type, providerId, timestamp',
      foodScanHistory: '++id, source, providerId, timestamp',
      appSettings: '++id',
    });
  }
}

export const db = new HealthVaultDB();

// ---------- HealthProfile helpers ----------

export async function getProfile(): Promise<HealthProfile | undefined> {
  return db.healthProfile.orderBy('updatedAt').last();
}

export async function saveProfile(
  profile: Partial<HealthProfile>,
): Promise<number> {
  const existing = await getProfile();
  const now = Date.now();
  if (existing?.id) {
    await db.healthProfile.update(existing.id, {
      ...profile,
      updatedAt: now,
    });
    return existing.id;
  }
  return db.healthProfile.add({
    conditions: [],
    allergies: [],
    medications: [],
    dietaryPreferences: [],
    healthGoals: [],
    ...profile,
    createdAt: now,
    updatedAt: now,
  } as HealthProfile);
}

// ---------- InteractionLog helpers ----------

export async function addInteraction(
  log: Omit<InteractionLog, 'id'>,
): Promise<number> {
  return db.interactionLog.add(log as InteractionLog);
}

export async function getRecentInteractions(
  limit = 20,
): Promise<InteractionLog[]> {
  return db.interactionLog
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

// ---------- FoodScanHistory helpers ----------

export async function addFoodScan(
  record: Omit<FoodScanRecord, 'id'>,
): Promise<number> {
  return db.foodScanHistory.add(record as FoodScanRecord);
}

export async function getRecentScans(
  limit = 10,
): Promise<FoodScanRecord[]> {
  return db.foodScanHistory
    .orderBy('timestamp')
    .reverse()
    .limit(limit)
    .toArray();
}

// ---------- AppSettings helpers ----------

const DEFAULT_SETTINGS: Omit<AppSettings, 'id'> = {
  selectedProviderId: '',
  providerConfigs: {},
  showPromptBeforeSending: false,
  onboardingComplete: false,
};

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.toCollection().first();
  if (existing) return existing;
  const id = await db.appSettings.add(DEFAULT_SETTINGS as AppSettings);
  return { ...DEFAULT_SETTINGS, id } as AppSettings;
}

export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<void> {
  const settings = await getSettings();
  if (settings.id) {
    await db.appSettings.update(settings.id, patch);
  }
}
