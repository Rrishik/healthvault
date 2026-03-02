import Dexie, { type Table } from 'dexie';
import type {
  HealthProfile,
  InteractionLog,
  FoodScanRecord,
  AppSettings,
  Conversation,
  ConversationSummary,
} from '../types';
import { DEFAULT_CHAT_TITLE, MAX_CONVERSATIONS } from '../constants';

class HealthVaultDB extends Dexie {
  healthProfile!: Table<HealthProfile, number>;
  interactionLog!: Table<InteractionLog, number>;
  foodScanHistory!: Table<FoodScanRecord, number>;
  appSettings!: Table<AppSettings, number>;
  conversations!: Table<Conversation, number>;

  constructor() {
    super('HealthVaultDB');
    this.version(1).stores({
      healthProfile: '++id, updatedAt',
      interactionLog: '++id, type, providerId, timestamp',
      foodScanHistory: '++id, source, providerId, timestamp',
      appSettings: '++id',
      conversations: '++id, updatedAt',
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

// ---------- Conversation helpers ----------

export async function getActiveConversation(): Promise<
  Conversation | undefined
> {
  return db.conversations.orderBy('updatedAt').last();
}

export async function saveConversation(
  conversation: Conversation,
): Promise<number> {
  const now = Date.now();
  const messageCount = conversation.messages.length;
  if (conversation.id) {
    await db.conversations.update(conversation.id, {
      messages: conversation.messages,
      messageCount,
      title: conversation.title,
      updatedAt: now,
    });
    await pruneOldConversations();
    return conversation.id;
  }
  const id = await db.conversations.add({
    ...conversation,
    messageCount,
    createdAt: now,
    updatedAt: now,
  });
  await pruneOldConversations();
  return id;
}

export async function startNewConversation(): Promise<Conversation> {
  const now = Date.now();
  const id = await db.conversations.add({
    title: DEFAULT_CHAT_TITLE,
    messages: [],
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  } as Conversation);
  await pruneOldConversations();
  return { id, title: DEFAULT_CHAT_TITLE, messages: [], messageCount: 0, createdAt: now, updatedAt: now };
}

export async function getConversationById(
  id: number,
): Promise<Conversation | undefined> {
  return db.conversations.get(id);
}

export async function getRecentConversations(
  limit: number,
): Promise<Conversation[]> {
  return db.conversations.orderBy('updatedAt').reverse().limit(limit).toArray();
}

/** Return lightweight conversation summaries (no messages array) for listings */
export async function getRecentConversationSummaries(
  limit: number,
): Promise<ConversationSummary[]> {
  const convs = await db.conversations.orderBy('updatedAt').reverse().limit(limit).toArray();
  return convs
    .filter((c) => c.messageCount > 0)
    .map(({ messages: _msgs, ...summary }) => summary);
}

/** Delete oldest conversations beyond MAX_CONVERSATIONS */
async function pruneOldConversations(): Promise<void> {
  const count = await db.conversations.count();
  if (count <= MAX_CONVERSATIONS) return;
  const toDelete = count - MAX_CONVERSATIONS;
  const oldest = await db.conversations
    .orderBy('updatedAt')
    .limit(toDelete)
    .primaryKeys();
  await db.conversations.bulkDelete(oldest);
}

/** Erase all IndexedDB data and localStorage keys, then reload */
export async function clearAllData(): Promise<void> {
  await db.delete();
  localStorage.clear();
  window.location.reload();
}
