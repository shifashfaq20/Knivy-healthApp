import { api, backendConfigured } from '../api';

// All AI calls go through the Knivy backend so provider keys never ship in the app.
// Phase 1 has no backend, so these functions report "unavailable" instead of inventing results.

export type AiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

const UNAVAILABLE =
  'The AI service isn’t connected in this version of Knivy. It needs the Knivy backend, which arrives in a later release.';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendAssistantMessage(history: AssistantTurn[], context?: Record<string, unknown>): Promise<AiResult<{ reply: string }>> {
  if (!backendConfigured) return { status: 'unavailable', message: UNAVAILABLE };
  try {
    const { data } = await api.post<{ reply: string }>('/v1/assistant/messages', { messages: history, context });
    return { status: 'ok', data };
  } catch {
    return { status: 'error', message: 'The assistant didn’t respond. Check your connection and try again.' };
  }
}

export interface RecognizedFood {
  label: string;
  confidence: number;
  /** Approximate portion in grams, only when the service can support an estimate. */
  estimatedGrams: number | null;
}

export async function recognizeFoodPhoto(uri: string, mimeType = 'image/jpeg'): Promise<AiResult<{ items: RecognizedFood[] }>> {
  if (!backendConfigured) return { status: 'unavailable', message: UNAVAILABLE };
  try {
    const form = new FormData();
    form.append('image', { uri, name: 'meal.jpg', type: mimeType } as unknown as Blob);
    const { data } = await api.post<{ items: RecognizedFood[] }>('/v1/nutrition/recognize', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { status: 'ok', data };
  } catch {
    return { status: 'error', message: 'The photo couldn’t be analysed. Check your connection and try again.' };
  }
}

export const aiConfigured = backendConfigured;
