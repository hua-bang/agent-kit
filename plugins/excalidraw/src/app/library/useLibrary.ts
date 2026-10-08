import { useEffect, useRef, useState } from 'react';
import { callTool } from '../host/bridge';
import type { DrawingSummary } from '../../shared/schemas';

export type Library = { drawings: DrawingSummary[]; warnings: string[] };

/**
 * The drawing list. While `active` (the list is on screen), poll it silently:
 * agents create and edit drawings from chat. No spinner or disabled cards, and
 * state only changes when something did.
 */
export function useLibrary(connected: boolean, active: boolean, onError: (message: string) => void) {
  const [library, setLibrary] = useState<Library | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Polling and manual refresh can overlap; only the most recently started request may update the list.
  const listRequest = useRef(0);
  async function fetchLibrary() {
    const request = ++listRequest.current;
    const data = await callTool<Library>('list_drawings');
    return mounted.current && request === listRequest.current ? data : null;
  }
  async function refresh() {
    setRefreshing(true);
    try { const data = await fetchLibrary(); if (data) setLibrary(data); }
    catch (e) { if (mounted.current) onError(String(e)); }
    finally { if (mounted.current) setRefreshing(false); }
  }
  useEffect(() => {
    if (!connected || !active) return;
    let polling = false;
    const poll = async () => {
      if (polling || document.visibilityState !== 'visible') return;
      polling = true;
      try {
        const next = await fetchLibrary();
        if (next) setLibrary(previous => previous && librarySignature(previous) === librarySignature(next) ? previous : next);
      } catch { /* The manual refresh button reports errors. */ }
      finally { polling = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void poll(); };
    const timer = setInterval(() => void poll(), 5000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [connected, active]);
  return { library, setLibrary, refreshing, refresh };
}

function librarySignature(library: Library) {
  return JSON.stringify([library.warnings.length, library.drawings.map(d => [d.id, d.revision, d.title])]);
}
