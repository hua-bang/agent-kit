import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Emit THIRD_PARTY_NOTICES.txt for every npm package that actually ends up in
 * this bundle, using each package's own license field and shipped license file.
 * Fails the build when a bundled package declares no license at all.
 */
export function thirdPartyNotices(fileName = 'THIRD_PARTY_NOTICES.txt'): Plugin {
  return {
    name: 'third-party-notices',
    generateBundle() {
      const roots = new Map<string, string>();
      for (const raw of this.getModuleIds()) {
        const id = raw.replace(/^\0/, '').split('?')[0].replaceAll('\\', '/');
        const at = id.lastIndexOf('/node_modules/');
        if (at < 0) continue;
        const parts = id.slice(at + '/node_modules/'.length).split('/');
        const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
        roots.set(id.slice(0, at + '/node_modules/'.length) + name, name);
      }
      const entries = new Map<string, string>();
      for (const root of roots.keys()) {
        const manifest = join(root, 'package.json');
        if (!existsSync(manifest)) continue;
        const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
        const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type;
        const file = readdirSync(root).find(f => /^(licen[cs]e|copying)(\.|-|$)/i.test(f));
        if (!license && !file) this.error(`Bundled package ${pkg.name}@${pkg.version} declares no license`);
        const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? pkg.homepage ?? '';
        entries.set(`${pkg.name}@${pkg.version}`, [
          `${pkg.name}@${pkg.version}`,
          `License: ${license ?? 'see license file'}`,
          ...(repo ? [`Source: ${repo}`] : []),
          '',
          file ? readFileSync(join(root, file), 'utf8').trim() : '(No license file is shipped with this package; license as declared in its package.json.)',
        ].join('\n'));
      }
      const body = [...entries.keys()].sort().map(key => entries.get(key)).join(`\n\n${'-'.repeat(72)}\n\n`);
      this.emitFile({
        type: 'asset', fileName,
        source: `Third-party software bundled in this build (${entries.size} packages).\nFonts are listed separately in licenses/FONTS.md.\n\n${'='.repeat(72)}\n\n${body}\n`,
      });
    },
  };
}
