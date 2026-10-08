import { mkdir, readFile, readdir, lstat, open, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { documentSchema, emptyScene, idSchema, sceneSchema, titleSchema, type Drawing, type Scene } from '../shared/schemas.js';

const MAX_BYTES = 4 * 1024 * 1024;
export class ConflictError extends Error {
  constructor(public currentRevision: number) { super(`Revision conflict: current revision is ${currentRevision}. Read latest before retrying.`); }
}
type Element = Scene['elements'][number];
/** Upsert elements by ID in place, append new ones, and drop removed IDs (removal wins). */
export function patchElements(elements: Element[], upsert: Element[], removeIds: string[]): Element[] {
  const changes = new Map(upsert.map(e => [e.id, e]));
  const removed = new Set(removeIds);
  const next = elements.filter(e => !removed.has(e.id)).map(e => {
    const change = changes.get(e.id); changes.delete(e.id); return change ?? e;
  });
  for (const added of changes.values()) if (!removed.has(added.id)) next.push(added);
  return next;
}
type Stat = Awaited<ReturnType<typeof lstat>>;
// A file is unchanged while its inode, size, mtime and ctime are; atomic saves always replace the inode.
const fingerprint = (stat: Stat) => `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
export class DrawingStore {
  readonly root: string;
  // Metadata of files already validated, so polling the list does not re-parse every scene and image.
  private summaries = new Map<string, { fingerprint: string; plugin: Drawing['plugin'] }>();
  constructor(root = process.env.EXCALIDRAW_PLUGIN_DIR || join(homedir(), '.excalidraw-plugin')) {
    this.root = resolve(root);
  }
  private async directory(path: string) {
    await mkdir(path, { recursive: true, mode: 0o700 });
    if ((await lstat(path)).isSymbolicLink()) throw new Error('Symbolic-link data directories are not supported');
  }
  private async init() {
    await this.directory(this.root);
    await this.directory(join(this.root, 'drawings'));
    await this.directory(join(this.root, 'backups'));
  }
  private path(id: string) { return join(this.root, 'drawings', `${idSchema.parse(id)}.excalidraw`); }
  private async readSafe(path: string) {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) throw new Error('Unsafe or oversized drawing file');
    return readFile(path, 'utf8');
  }
  private async atomic(path: string, content: string) {
    if (Buffer.byteLength(content) > MAX_BYTES) throw new Error('Drawing exceeds 4 MiB limit');
    const tmp = `${path}.${randomUUID()}.tmp`;
    try {
      const file = await open(tmp, 'wx', 0o600);
      try { await file.writeFile(content); await file.sync(); } finally { await file.close(); }
      await rename(tmp, path);
    } finally { await rm(tmp, { force: true }); }
  }
  private async locked<T>(work: () => Promise<T>): Promise<T> {
    await this.init();
    const release = await lockfile.lock(this.root, { realpath: false, retries: { retries: 30, minTimeout: 20, maxTimeout: 100 }, stale: 10000 });
    try { return await work(); } finally { await release(); }
  }
  async list() {
    await this.init();
    const drawings: Drawing['plugin'][] = [];
    const warnings: string[] = [];
    const entries = (await readdir(join(this.root, 'drawings'))).filter(entry => entry.endsWith('.excalidraw'));
    for (const name of this.summaries.keys()) if (!entries.includes(name)) this.summaries.delete(name);
    // A few files at a time: fast on a cold start, without opening hundreds of files at once.
    let next = 0;
    const worker = async () => {
      for (let entry = entries[next++]; entry !== undefined; entry = entries[next++]) {
        try { drawings.push(await this.summary(entry)); }
        catch { this.summaries.delete(entry); warnings.push(`Cannot read ${entry}`); }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    return { drawings: drawings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)), warnings: warnings.sort() };
  }
  // Called under the write lock right after this store wrote the file.
  private async remember(plugin: Drawing['plugin']) {
    try { this.summaries.set(`${plugin.id}.excalidraw`, { fingerprint: fingerprint(await lstat(this.path(plugin.id))), plugin }); }
    catch { /* The next list() reads the file instead. */ }
  }
  private async summary(entry: string) {
    const stat = await lstat(join(this.root, 'drawings', entry));
    const cached = this.summaries.get(entry);
    if (cached && cached.fingerprint === fingerprint(stat) && stat.isFile()) return cached.plugin;
    const { plugin } = await this.read(entry.slice(0, -11));
    this.summaries.set(entry, { fingerprint: fingerprint(stat), plugin });
    return plugin;
  }
  async read(id: string): Promise<Drawing> {
    const doc = documentSchema.parse(JSON.parse(await this.readSafe(this.path(id))));
    if (doc.plugin.id !== id) throw new Error('Drawing ID mismatch');
    sceneSchema.parse(doc);
    return doc;
  }
  async create(title: string, scene: Scene = emptyScene): Promise<Drawing> {
    title = titleSchema.parse(title); scene = sceneSchema.parse(scene);
    return this.locked(async () => {
      const timestamp = new Date().toISOString();
      const doc: Drawing = { type: 'excalidraw', version: 2, source: 'agent-kit/excalidraw', ...scene,
        plugin: { id: randomUUID(), title, revision: 1, createdAt: timestamp, updatedAt: timestamp } };
      await this.atomic(this.path(doc.plugin.id), JSON.stringify(doc));
      await this.remember(doc.plugin);
      return doc;
    });
  }
  async save(id: string, expectedRevision: number, scene: Scene, title?: string): Promise<Drawing> {
    scene = sceneSchema.parse(scene);
    if (title !== undefined) title = titleSchema.parse(title);
    return this.locked(async () => {
      const current = await this.read(id);
      if (current.plugin.revision !== expectedRevision) throw new ConflictError(current.plugin.revision);
      const next: Drawing = { ...current, ...scene, plugin: { ...current.plugin, title: title ?? current.plugin.title,
        revision: current.plugin.revision + 1, updatedAt: new Date().toISOString() } };
      const serialized = JSON.stringify(next);
      if (Buffer.byteLength(serialized) > MAX_BYTES) throw new Error('Drawing exceeds 4 MiB limit');
      const backupDir = join(this.root, 'backups', id);
      await this.directory(backupDir);
      await this.atomic(join(backupDir, `${current.plugin.revision}.excalidraw`), JSON.stringify(current));
      await this.atomic(this.path(id), serialized);
      await this.remember(next.plugin);
      // Cleanup failure must not make a committed save look unsuccessful.
      try {
        const versions = (await readdir(backupDir)).filter(x => /^\d+\.excalidraw$/.test(x)).sort((a, b) => parseInt(b) - parseInt(a));
        for (const old of versions.slice(5)) await rm(join(backupDir, old));
      } catch (error) { console.error('Backup cleanup failed:', error); }
      return next;
    });
  }
  /** Element-level edit: untouched elements, files and app state are kept. Fails fast on a stale revision. */
  async patch(id: string, expectedRevision: number, upsert: Element[], removeIds: string[]): Promise<Drawing> {
    const doc = await this.read(id);
    if (doc.plugin.revision !== expectedRevision) throw new ConflictError(doc.plugin.revision);
    // save() re-checks the revision under the lock, so a write between read and save still conflicts.
    return this.save(id, expectedRevision, { elements: patchElements(doc.elements, upsert, removeIds), appState: doc.appState, files: doc.files });
  }
}
