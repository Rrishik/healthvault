// HealthVault — Shared constants

/** Emoji map for food verdict status badges */
export const verdictEmoji = { safe: '✅', caution: '⚠️', avoid: '🚫' } as const;

// ---------- AI / Provider ----------

/** Default temperature for all LLM API calls */
export const DEFAULT_TEMPERATURE = 0.3;

/** Timeout (ms) for AI requests (onboarding suggestions, etc.) */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

// ---------- Chat ----------

/** Default title for newly created conversations */
export const DEFAULT_CHAT_TITLE = 'New Chat';

/** Max characters from first message used as conversation title */
export const CHAT_TITLE_MAX_LENGTH = 60;

/** Number of chat starters / recent items shown in UI */
export const DISPLAY_ITEMS_COUNT = 3;

/** Show the "new chat" coachmark tip after this many messages */
export const NEW_CHAT_TIP_THRESHOLD = 6;

/** Pulse the new-chat button after this many messages */
export const NEW_CHAT_PULSE_THRESHOLD = 12;

// ---------- Onboarding suggestions ----------

/** Max items per suggestion category after sanitisation */
export const MAX_SUGGESTION_ITEMS = 12;

/** Max AI-generated starters to cache in settings */
export const MAX_STARTERS_CACHED = 15;

// ---------- Image compression ----------

/** Max dimension (px) for scanned image resize */
export const IMAGE_MAX_DIM = 1024;

/** JPEG compression quality for scanned images */
export const IMAGE_QUALITY = 0.7;

// ---------- UI ----------

/** Duration (ms) for status toast messages */
export const STATUS_TOAST_DURATION_MS = 3000;

/** Max characters for debug log truncation */
export const DEBUG_TRUNCATE_LENGTH = 300;

/** Console log prefix */
export const LOG_PREFIX = '[HealthVault]';

// ---------- localStorage keys ----------

export const LS_KEYS = {
  NEW_CHAT_TIP_DISMISSED: 'hv_newchat_tip_dismissed',
  CONFIG_SALT: 'hv_config_salt',
  COMMUNITY_WARNING_DISMISSED: 'hv_community_warning_dismissed',
} as const;
