import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DrawingStore, ConflictError } from '../src/storage/drawings';
import { emptyScene, sceneSchema } from '../src/shared/schemas';
let root: string;
let store: DrawingStore;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'excalidraw-test-')); store = new DrawingStore(root); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const box = { id: 'box', type: 'rectangle' as const, x: 20, y: 30, width: 160, height: 80 };
describe('local drawing storage', () => {
  it('persists standard Excalidraw scenes and lists by metadata', async () => {
    const doc = await store.create('流程', { ...emptyScene, elements: [box] });
    const reopened = await new DrawingStore(root).read(doc.plugin.id);
    expect(reopened.elements).toEqual([box]);
    expect(reopened.type).toBe('excalidraw');
    expect((await store.list()).drawings[0].title).toBe('流程');
  });
  it('preserves image data, IDs and user positions through a save', async () => {
    const scene = sceneSchema.parse({ ...emptyScene, elements: [{ ...box, type: 'image', fileId: 'photo' }],
      files: { photo: { id: 'photo', mimeType: 'image/png', dataURL: 'data:image/png;base64,aGVsbG8=', created: 1 } } });
    const doc = await store.create('图片', scene);
    const next = await store.save(doc.plugin.id, 1, { ...scene, elements: [{ ...scene.elements[0], x: 999 }] });
    expect(next.files).toEqual(scene.files); expect(next.elements[0].x).toBe(999);
  });
  it('rejects stale writes without destroying the latest scene', async () => {
    const doc = await store.create('first');
    await store.save(doc.plugin.id, 1, { ...emptyScene, elements: [box] });
    await expect(store.save(doc.plugin.id, 1, emptyScene)).rejects.toBeInstanceOf(ConflictError);
    expect((await store.read(doc.plugin.id)).elements).toEqual([box]);
  });
  it('keeps the cached list in step with writes from other processes and outside edits', async () => {
    const doc = await store.create('cached');
    const other = await store.create('other');
    expect((await store.list()).drawings.map(d => d.revision)).toEqual([1, 1]);
    await new DrawingStore(root).save(doc.plugin.id, 1, emptyScene, 'renamed');
    expect((await store.list()).drawings.find(d => d.id === doc.plugin.id)).toMatchObject({ title: 'renamed', revision: 2 });
    await writeFile(join(root, 'drawings', `${other.plugin.id}.excalidraw`), '{');
    expect((await store.list()).warnings).toEqual([`Cannot read ${other.plugin.id}.excalidraw`]);
    await rm(join(root, 'drawings', `${other.plugin.id}.excalidraw`));
    const after = await store.list();
    expect(after.warnings).toEqual([]);
    expect(after.drawings.map(d => d.id)).toEqual([doc.plugin.id]);
  });
  it('allows exactly one concurrent writer across store instances', async () => {
    const doc = await store.create('race');
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => new DrawingStore(root).save(doc.plugin.id, 1, emptyScene)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await store.read(doc.plugin.id)).plugin.revision).toBe(2);
  });
  it('keeps five previous versions and no temp files', async () => {
    let doc = await store.create('backup');
    for (let i = 0; i < 7; i++) doc = await store.save(doc.plugin.id, doc.plugin.revision, emptyScene);
    const files = await readdir(join(root, 'backups', doc.plugin.id));
    expect(files).toHaveLength(5);
    expect(JSON.parse(await readFile(join(root, 'backups', doc.plugin.id, '7.excalidraw'), 'utf8')).plugin.revision).toBe(7);
    expect(await readdir(join(root, 'drawings'))).toEqual([`${doc.plugin.id}.excalidraw`]);
  });
  it('rejects traversal, symbolic links and oversized data', async () => {
    await expect(store.read('../../secret')).rejects.toThrow();
    const doc = await store.create('safe');
    const path = join(root, 'drawings', `${doc.plugin.id}.excalidraw`);
    await rm(path); await symlink(join(root, 'secret'), path);
    await expect(store.read(doc.plugin.id)).rejects.toThrow();
    await expect(store.create('large', { ...emptyScene, elements: [{ ...box, text: 'a'.repeat(5 * 1024 * 1024) }] })).rejects.toThrow('4 MiB');
  });
  it('reports corrupt files without hiding good drawings', async () => {
    await store.create('good');
    await writeFile(join(root, 'drawings', 'bad.excalidraw'), 'invalid');
    const list = await store.list(); expect(list.drawings).toHaveLength(1); expect(list.warnings).toHaveLength(1);
  });
  it('rejects duplicate IDs, external images and unsupported embedded content', () => {
    expect(() => sceneSchema.parse({ ...emptyScene, elements: [box, box] })).toThrow();
    expect(() => sceneSchema.parse({ ...emptyScene, elements: [{ ...box, type: 'image', fileId: 'remote' }] })).toThrow();
    expect(() => sceneSchema.parse({ ...emptyScene, elements: [{ ...box, type: 'iframe' }] })).toThrow();
  });
});
