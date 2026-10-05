# UI bundle size analysis

## Adopted production change

The user approved removing Mermaid only; all existing locales and font-subsetting modules remain. The current production HTML is **5,550,334 bytes**, gzip reference **2,120,379 bytes**, a **38.4% raw reduction** from the original 9,012,144 bytes.

- Exact package alias excludes the converter graph; a small compatibility adapter preserves Mermaid clipboard input as editable text instead of throwing.
- `aiEnabled=false` hides AI/command-palette actions; a guarded build transform removes the remaining Mermaid toolbar item and empty Generate heading in both pinned dev/prod SDKs. Upstream changes fail closed.
- Build checks reject Mermaid/converter/parser/Cytoscape/KaTeX module inclusion and enforce a 5,700,000-byte final HTML budget.
- Typecheck, 14 unit tests, production build, real stdio smoke, and official AppBridge browser smoke passed. Browser tests use installed Chrome, temporary data, test Mermaid menu absence plus Mermaid/plain-text paste persistence, pointer drawing, Agent patch, reopen, mobile overflow and no external requests.
- npm transitive dependencies remain installed/locked; this is a UI payload optimization, not an installation-size or security-audit fix. Real target-host and comprehensive export acceptance remain outstanding.

## Historical experiment scope

Measured the installed, lockfile-pinned build using Vite's `generateBundle` module metadata and isolated counterfactual builds. No production source, dependency, host configuration, or official `dist/ui/index.html` was changed. Probe scripts and experimental builds are under ignored `.test-output/`; they are not release implementations.

All sizes below are decimal MB. Raw HTML is the relevant current MCP resource payload size; gzip is only a compression reference, not an implemented stdio transport optimization.

## Measured results

| Experiment | HTML bytes | MB | gzip bytes (Node default settings) |
| --- | ---: | ---: | ---: |
| Existing production build | 9,012,144 | 9.01 | 3,050,874 |
| Remove Mermaid conversion dependency graph | 5,550,542 | 5.55 | 2,120,300 |
| Retain only English/Chinese locale payloads | 7,963,741 | 7.96 | 2,761,302 |
| Both of the above | 4,503,296 | 4.50 | 1,830,968 |
| Remove font-subsetting modules only | 7,190,461 | 7.19 | 2,314,819 |
| Remove Mermaid and font-subsetting modules, keep all locales | 3,728,885 | 3.73 | 1,384,072 |

Counterfactual deltas are not perfectly additive because bundling/minification changes across builds. Gzip output can vary by compressor/settings.

## Findings

1. **Single-file bundling pulls optional dynamically imported features into the initial resource.** Dynamic import alone does not defer transfer with the current single-file configuration.
2. **Mermaid conversion accounts for about 3.46 MB of removable payload in this build.** Its graph includes Mermaid, its parser, Cytoscape/layout engines and KaTeX. These are not required for the tested basic drawing/edit/save flows. However, removing them disables native Mermaid-to-shapes conversion, including Mermaid paste handling. Agent-produced element JSON through `patch_drawing` is a separate path.
3. **Non-English/Chinese locale payloads account for about 1.05 MB.** The build contains 119 modules under the editor's locales directory (this is a module count, not a language count). Keeping English and Chinese locales requires an explicit supported-language policy and proper fallback before release.
4. **Font subsetting accounts for about 1.82 MB.** The editor's subsetting chunk embeds HarfBuzz-related WASM as Base64. This is different from the font files themselves. Removing it can break font embedding/subsetting paths such as SVG export; do not remove it blindly.
5. The previously measured embedded font data is about 0.68 MB of Base64. It is not the primary source of the 9 MB payload.

Module `renderedLength` attribution is before final bundle minification and is not a table of final-byte ownership. The final HTML comparisons above are the basis of the savings estimates.

## Verification and limitations

The Mermaid-free and Chinese/English + Mermaid-free experimental HTML both passed the existing real browser smoke flow: official MCP AppBridge, sandboxed Excalidraw pointer drawing, autosave to temporary storage, Agent patch, reopen, 375px overflow checks and no external requests.

These experiments intentionally used throwing stubs for removed optional APIs and empty export payloads for unsupported locale modules. They demonstrate bundle weight, **not a production-ready feature removal**. No Mermaid, comprehensive locale, font export, SVG export, image export or actual target-host acceptance was claimed. Font-subsetting-removal variants were size-only builds, not browser-validated implementations.

## Historical recommendations (before approval)

- Historical combined proposal (not adopted; the user approved Mermaid removal only): **about 4.5 MB**, keeping the real editor, offline single-file loading and font subsetting, while explicitly limiting languages to English/Chinese and disabling native Mermaid conversion. Confirm this feature tradeoff before changing production behavior.
- Implement feature removal with explicit UI behavior, paste fallback and tests; do not ship the measurement stubs. Prefer supported boundaries and avoid hash-named upstream file coupling where possible.
- If native Mermaid conversion must remain, locale trimming alone measures about **7.96 MB**. To retain all features while reducing initial payload, investigate target-host support for separately loaded local resources; this changes loading architecture and does not automatically reduce total installed size.
- Further savings from font-subsetting replacement require a valid export fallback and cross-platform font/export tests. Do not set a smaller release target from the size-only probe.
- Add a deterministic raw-HTML size budget once the supported feature set is agreed. Keep separate gates for size, functionality, dependency security and third-party licenses.
