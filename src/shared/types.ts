// ---- Settings ----

export type Sensitivity = 'mild' | 'moderate' | 'strict';

export interface PGPatrolSettings {
  enabled: boolean;
  textFilterEnabled: boolean;
  imageFilterEnabled: boolean;
  positiveModeEnabled: boolean;
  mlClassifierEnabled: boolean;
  sensitivity: Sensitivity;
  developerMode: boolean;
  customThreshold: number | null;
  whitelistedSites: string[];
  perspectiveApiKey: string;
  customBlockedWords: string[];
  customSafeWords: string[];
  customNegativeTriggers: string[];
  customSafeContext: string[];
  hasSeenOnboarding: boolean;
  stats: {
    totalWordsReplaced: number;
    totalImagesReplaced: number;
  };
}

export const DEFAULT_SETTINGS: PGPatrolSettings = {
  enabled: true,
  textFilterEnabled: true,
  imageFilterEnabled: true,
  positiveModeEnabled: true,
  mlClassifierEnabled: true,
  sensitivity: 'strict',
  developerMode: false,
  customThreshold: 0.10,
  whitelistedSites: [],
  perspectiveApiKey: '',
  customBlockedWords: [],
  customSafeWords: [],
  customNegativeTriggers: [],
  customSafeContext: [],
  hasSeenOnboarding: false,
  stats: {
    totalWordsReplaced: 0,
    totalImagesReplaced: 0,
  },
};

// ---- Messages ----

export enum MessageType {
  UPDATE_STATS = 'UPDATE_STATS',
  GET_TAB_STATS = 'GET_TAB_STATS',
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  TOGGLE_FILTERING = 'TOGGLE_FILTERING',
  GET_SETTINGS = 'GET_SETTINGS',
  ML_CLASSIFY_REQUEST = 'ML_CLASSIFY_REQUEST',
  ML_CLASSIFY_INTERNAL = 'ML_CLASSIFY_INTERNAL',
  ML_CLASSIFY_RESPONSE = 'ML_CLASSIFY_RESPONSE',
  OFFSCREEN_IDLE = 'OFFSCREEN_IDLE',
  GET_FILTER_STATE = 'GET_FILTER_STATE',
  NSFW_WARMUP = 'NSFW_WARMUP',
  NSFW_WARMUP_INTERNAL = 'NSFW_WARMUP_INTERNAL',
  NSFW_WARMUP_RESPONSE = 'NSFW_WARMUP_RESPONSE',
  NSFW_CLASSIFY_IMAGE = 'NSFW_CLASSIFY_IMAGE',
  NSFW_CLASSIFY_INTERNAL = 'NSFW_CLASSIFY_INTERNAL',
  NSFW_CLASSIFY_RESPONSE = 'NSFW_CLASSIFY_RESPONSE',
  LOG_ACTIVITY = 'LOG_ACTIVITY',
  GET_ACTIVITY_LOG = 'GET_ACTIVITY_LOG',
}

export interface UpdateStatsMessage {
  type: MessageType.UPDATE_STATS;
  data: { wordsReplaced: number; imagesReplaced: number };
}

export interface GetTabStatsMessage {
  type: MessageType.GET_TAB_STATS;
  tabId?: number;
}

export interface SettingsChangedMessage {
  type: MessageType.SETTINGS_CHANGED;
  data: Partial<PGPatrolSettings>;
}

export interface ToggleFilteringMessage {
  type: MessageType.TOGGLE_FILTERING;
  data: { enabled: boolean };
}

export interface GetSettingsMessage {
  type: MessageType.GET_SETTINGS;
}

export interface MLClassifyResult {
  isToxic: boolean;
  confidence: number;
}

export interface MLClassifyRequestMessage {
  type: MessageType.ML_CLASSIFY_REQUEST;
  data: { text: string };
}

export interface MLClassifyInternalMessage {
  type: MessageType.ML_CLASSIFY_INTERNAL;
  data: { text: string; requestId: number };
}

export interface MLClassifyResponseMessage {
  type: MessageType.ML_CLASSIFY_RESPONSE;
  data: { requestId: number; result: MLClassifyResult };
}

export interface OffscreenIdleMessage {
  type: MessageType.OFFSCREEN_IDLE;
}

export interface GetFilterStateMessage {
  type: MessageType.GET_FILTER_STATE;
}

export interface LogActivityMessage {
  type: MessageType.LOG_ACTIVITY;
  data: ActivityEntry;
}

export interface GetActivityLogMessage {
  type: MessageType.GET_ACTIVITY_LOG;
  tabId?: number;
}

export type NSFWImageInput =
  | { kind: 'url'; imageUrl: string }
  | { kind: 'pixels'; width: number; height: number; data: Uint8ClampedArray };

export interface NSFWWarmupMessage {
  type: MessageType.NSFW_WARMUP;
}

export interface NSFWWarmupInternalMessage {
  type: MessageType.NSFW_WARMUP_INTERNAL;
  data: { requestId: number };
}

export interface NSFWWarmupResponseMessage {
  type: MessageType.NSFW_WARMUP_RESPONSE;
  data: { requestId: number; ok: boolean };
}

export interface NSFWClassifyImageMessage {
  type: MessageType.NSFW_CLASSIFY_IMAGE;
  data: { source: NSFWImageInput; sensitivity: Sensitivity; customThreshold?: number | null };
}

export interface NSFWClassifyInternalMessage {
  type: MessageType.NSFW_CLASSIFY_INTERNAL;
  data: {
    source: NSFWImageInput;
    sensitivity: Sensitivity;
    requestId: number;
    customThreshold?: number | null;
  };
}

export interface NSFWClassifyResponseMessage {
  type: MessageType.NSFW_CLASSIFY_RESPONSE;
  data: { requestId: number; result: { isNSFW: boolean; score: number } };
}

export interface FilterStateResponse {
  filteringPaused: boolean;
}

export type Message =
  | UpdateStatsMessage
  | GetTabStatsMessage
  | SettingsChangedMessage
  | ToggleFilteringMessage
  | GetSettingsMessage
  | MLClassifyRequestMessage
  | MLClassifyInternalMessage
  | MLClassifyResponseMessage
  | OffscreenIdleMessage
  | GetFilterStateMessage
  | NSFWWarmupMessage
  | NSFWWarmupInternalMessage
  | NSFWWarmupResponseMessage
  | NSFWClassifyImageMessage
  | NSFWClassifyInternalMessage
  | NSFWClassifyResponseMessage
  | LogActivityMessage
  | GetActivityLogMessage;

export interface StatsResponse {
  wordsReplaced: number;
  imagesReplaced: number;
}

// ---- Activity Log ----

export interface ActivityEntry {
  type: 'word' | 'image' | 'block';
  original: string;
  replacement?: string;
  category?: string;
  timestamp: number;
}

// ---- Profanity Engine ----

export interface ProfanityMatch {
  original: string;
  replacement: string;
  index: number;
}

export interface ProfaneUrl {
  url: string;
  index: number;
  length: number;
}

export interface FilterResult {
  original: string;
  filtered: string;
  replacements: ProfanityMatch[];
  profaneUrls: ProfaneUrl[];
  hasProfanity: boolean;
}

// ---- Negative Content Detection ----

export interface NegativeContentMatch {
  phrase: string;
  index: number;
  length: number;
  category: string;
}

export interface NegativeContentResult {
  isNegative: boolean;
  score: number;
  matches: NegativeContentMatch[];
}
