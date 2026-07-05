import { browser } from 'wxt/browser';
import { toSerializedError } from './errors';
import type { MessageType, ProtocolMap, Result } from './types';

interface Envelope<K extends MessageType> {
  __glean: true;
  type: K;
  input: ProtocolMap[K]['input'];
}

function isEnvelope(value: unknown): value is Envelope<MessageType> {
  return typeof value === 'object' && value !== null && (value as { __glean?: unknown }).__glean === true;
}

export async function sendMessage<K extends MessageType>(
  type: K,
  input: ProtocolMap[K]['input']
): Promise<Result<ProtocolMap[K]['output']>> {
  const envelope: Envelope<K> = { __glean: true, type, input };
  try {
    const response = (await browser.runtime.sendMessage(envelope)) as
      | Result<ProtocolMap[K]['output']>
      | undefined;
    if (!response) {
      return { ok: false, error: { code: 'UNKNOWN', message: 'No response from background.' } };
    }
    return response;
  } catch (err) {
    return {
      ok: false,
      error: { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'Message failed' },
    };
  }
}

export type Handlers = {
  [K in MessageType]: (input: ProtocolMap[K]['input']) => Promise<ProtocolMap[K]['output']>;
};

export function registerHandlers(handlers: Handlers): void {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isEnvelope(message)) return false;

    const handler = handlers[message.type] as (input: unknown) => Promise<unknown>;
    if (!handler) {
      sendResponse({ ok: false, error: { code: 'UNKNOWN', message: `Unknown message type: ${message.type}` } });
      return false;
    }

    handler(message.input)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => {
        console.error(`[Glean] Error handling ${message.type}:`, err);
        sendResponse({ ok: false, error: toSerializedError(err) });
      });

    return true;
  });
}

export type ContentMessage =
  | { __gleanContent: true; kind: 'TRIGGER'; word: string }
  | { __gleanContent: true; kind: 'PROMPT' };

export function sendToTab(tabId: number, message: ContentMessage): Promise<void> {
  return browser.tabs.sendMessage(tabId, message).then(
    () => undefined,
    (err) => console.debug('[Glean] Failed to reach content script:', err?.message)
  );
}

export function onContentMessage(handler: (message: ContentMessage) => void): void {
  browser.runtime.onMessage.addListener((message) => {
    if (typeof message === 'object' && message !== null && (message as ContentMessage).__gleanContent === true) {
      handler(message as ContentMessage);
    }
  });
}
