// Library thumbnails: a few rendered at a time, cached per drawing revision and theme,
// so polling, returning to the list or toggling the theme does not refetch every scene.
const LIMIT = 3;
const MAX_CACHED = 120; // ~50-100 KB PNG data URLs each.
const cache = new Map<string, string>(); // '' marks a blank drawing. Map order doubles as LRU.
const pending = new Map<string, Promise<string>>();
const waiting: (() => void)[] = [];
let active = 0;

export function thumbnailKey(id: string, revision: number, dark: boolean) { return `${id}:${revision}:${dark ? 'dark' : 'light'}`; }

export function cachedThumbnail(key: string) {
  const value = cache.get(key);
  if (value !== undefined) { cache.delete(key); cache.set(key, value); }
  return value;
}

/** Renders through the shared queue; `isCancelled` lets an unmounted card or a superseded revision give up its turn. */
export function thumbnail(key: string, render: () => Promise<string>, isCancelled: () => boolean): Promise<string | null> {
  const hit = cachedThumbnail(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const running = pending.get(key);
  if (running) return running;
  return (async () => {
    while (active >= LIMIT) await new Promise<void>(resolve => waiting.push(resolve));
    if (isCancelled()) { waiting.shift()?.(); return null; }
    active++;
    const job = render().then(value => {
      cache.set(key, value);
      if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
      return value;
    }).finally(() => { pending.delete(key); active--; waiting.shift()?.(); });
    pending.set(key, job);
    return job;
  })();
}
