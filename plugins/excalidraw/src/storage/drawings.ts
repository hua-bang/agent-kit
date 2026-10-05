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
export class DrawingStore {
  readonly root: string;
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
    for (const entry of await readdir(join(this.root, 'drawings'))) {
      if (!entry.endsWith('.excalidraw')) continue;
      try { drawings.push((await this.read(entry.slice(0, -11))).plugin); }
      catch { warnings.push(`Cannot read ${entry}`); }
    }
    return { drawings: drawings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), warnings };
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
      // Cleanup failure must not make a committed save look unsuccessful.
      try {
        const versions = (await readdir(backupDir)).filter(x => /^\d+\.excalidraw$/.test(x)).sort((a, b) => parseInt(b) - parseInt(a));
        for (const old of versions.slice(5)) await rm(join(backupDir, old));
      } catch (error) { console.error('Backup cleanup failed:', error); }
      return next;
    });
  }
}
