/**
 * Web Worker for off-main-thread text processing.
 * Runs profanity replacement and negative news scoring without blocking the UI.
 */

import {
  replaceProfanity,
  setCustomProfanity,
  setCustomSafeWords,
  addCustomProfanity,
  addCustomSafeWords,
} from '../shared/profanity-engine';
import {
  setCustomTriggers,
  setCustomSafeContext,
  addCustomTriggers,
  addCustomSafeContext,
} from '../shared/negative-news-words';
import { addCustomFunnyWords } from '../shared/funny-words';
import type { FilterResult, NegativeContentResult, Sensitivity } from '../shared/types';
import type { RemoteWordListDelta } from '../shared/word-list-updater';

/** Message types for worker communication. */
export type WorkerRequest =
  | { type: 'FILTER_TEXT'; id: number; texts: string[]; sensitivity: Sensitivity }
  | { type: 'SCORE_TEXT'; id: number; texts: string[] }
  | {
      type: 'SET_CUSTOM_WORDS';
      customBlockedWords: string[];
      customSafeWords: string[];
      customNegativeTriggers: string[];
      customSafeContext: string[];
    }
  | { type: 'APPLY_WORD_DELTA'; delta: RemoteWordListDelta };

export type WorkerResponse =
  | { type: 'FILTER_TEXT_RESULT'; id: number; results: FilterResult[] }
  | { type: 'SCORE_TEXT_RESULT'; id: number; results: NegativeContentResult[] };

/**
 * Handle an incoming worker message. Exported for testing.
 */
export async function handleWorkerMessage(msg: WorkerRequest): Promise<WorkerResponse | undefined> {
  switch (msg.type) {
    case 'FILTER_TEXT': {
      const results = msg.texts.map((text) => replaceProfanity(text, msg.sensitivity));
      return { type: 'FILTER_TEXT_RESULT', id: msg.id, results };
    }

    case 'SCORE_TEXT': {
      const { scoreText } = await import('../shared/negative-news-engine');
      const results = msg.texts.map((text) => scoreText(text));
      return { type: 'SCORE_TEXT_RESULT', id: msg.id, results };
    }

    case 'SET_CUSTOM_WORDS': {
      setCustomProfanity(msg.customBlockedWords);
      setCustomSafeWords(msg.customSafeWords);
      setCustomTriggers(msg.customNegativeTriggers);
      setCustomSafeContext(msg.customSafeContext);
      return undefined;
    }

    case 'APPLY_WORD_DELTA': {
      const delta = msg.delta;
      if (delta.profanity) {
        if (delta.profanity.add?.length) addCustomProfanity(delta.profanity.add);
        if (delta.profanity.addSafe?.length) addCustomSafeWords(delta.profanity.addSafe);
      }
      if (delta.negativeNews) {
        if (delta.negativeNews.addTriggers?.length)
          addCustomTriggers(delta.negativeNews.addTriggers);
        if (delta.negativeNews.addSafeContext?.length)
          addCustomSafeContext(delta.negativeNews.addSafeContext);
      }
      if (delta.funnyWords?.add) {
        addCustomFunnyWords(delta.funnyWords.add);
      }
      return undefined;
    }
  }
}

// Self-register when loaded as a Web Worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const response = await handleWorkerMessage(event.data);
  if (response) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).postMessage(response);
  }
};
