import { defineConfig } from 'vite';
import { thirdPartyNotices } from './build/notices';

// Bundle the stdio server and its npm dependencies into one file so a prebuilt
// plugin runs from a plain git checkout, without node_modules.
export default defineConfig({
  ssr: { noExternal: true },
  plugins: [thirdPartyNotices()],
  build: {
    ssr: 'src/server/index.ts',
    outDir: 'dist/server',
    emptyOutDir: true,
    target: 'node22',
    minify: true,
    rollupOptions: { output: { format: 'es', entryFileNames: 'index.js', codeSplitting: false } },
  },
});
