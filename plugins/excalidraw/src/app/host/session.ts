import { useState } from 'react';
import { bridge } from './bridge';

/**
 * Drawings opened in this library instance, newest first. A thread panel has one instance per
 * conversation, so this is the panel's "this conversation" list. Hosts give no conversation id;
 * the list travels in this instance's model context, which hosts hand back on remount.
 */
export function useSession() {
  const [session, setSession] = useState<string[]>([]);
  return {
    session,
    remember(id: string) {
      setSession(ids => ids[0] === id ? ids : [id, ...ids.filter(other => other !== id)].slice(0, 50));
    },
    restore() { setSession(ids => ids.length ? ids : restoredSession()); },
  };
}

/** The panel's list as this instance last reported it; OpenAI hosts return it in host context on remount. */
function restoredSession(): string[] {
  const context = (bridge.getHostContext() as Record<string, unknown> | undefined)?.['openai/modelContext'] as { structuredContent?: { session?: unknown } } | null | undefined;
  const ids = context?.structuredContent?.session;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string').slice(0, 50) : [];
}
