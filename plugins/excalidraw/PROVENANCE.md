# Provenance and release gate

This plugin's server, storage, UI shell, tests and build configuration were implemented in this repository. No code was copied from the neighboring `excalidraw-diagrams` plugin.

Installed upstream dependencies are pinned in `package-lock.json`, including integrity hashes:

| Dependency | Version | Upstream | Declared license |
| --- | --- | --- | --- |
| @excalidraw/excalidraw | 0.18.1 | https://github.com/excalidraw/excalidraw/tree/v0.18.1 | MIT |
| @modelcontextprotocol/sdk | 1.32.0 | https://github.com/modelcontextprotocol/typescript-sdk | MIT |
| @modelcontextprotocol/ext-apps | 1.7.5 | https://github.com/modelcontextprotocol/ext-apps | MIT |
| React / React DOM | 18.3.1 | https://github.com/facebook/react | MIT |
| proper-lockfile | 4.1.2 | https://github.com/moxystudio/node-proper-lockfile | MIT |
| Zod | 4.6.5 | https://github.com/colinhacks/zod | MIT |

The Excalidraw MIT license was retrieved directly from its v0.18.1 tag and is retained in [licenses/excalidraw-MIT.txt](licenses/excalidraw-MIT.txt).

Local modifications are integration code, not a vendored source fork. The Vite font transform inlines font assets from the installed package without modifying them, and substitutes the families listed below. The original installed assets are not changed.

## Redistribution of the prebuilt release

The `release` branch carries a built `dist/`, published by `.github/workflows/release-excalidraw.yml`. What it bundles and the notices it ships:

- **npm packages**: every build writes `dist/ui/THIRD_PARTY_NOTICES.txt` and `dist/server/THIRD_PARTY_NOTICES.txt` from the packages actually present in that bundle's module graph, each with its declared license and the license file it ships. The build fails if a bundled package declares no license. At the time of writing: 87 UI and 13 server packages, all MIT, ISC, Apache-2.0 (no `NOTICE` files shipped), BSD-3-Clause, 0BSD, CC0-1.0 or MIT AND Zlib.
- **Fonts**: only Assistant, Virgil, Lilita One, Nunito (OFL 1.1) and Comic Shanns (MIT) are shipped, with evidence read from each font file in [licenses/FONTS.md](licenses/FONTS.md). Excalifont, Cascadia Code and Liberation Sans could not be verified and are replaced at build time by a cleared family; Xiaolai is replaced for size. The transform fails the build if any other family would be inlined.
- The Excalidraw MIT license is in [licenses/excalidraw-MIT.txt](licenses/excalidraw-MIT.txt); it does not substitute for the notices above.

The repository itself still has no blanket license; that decision belongs to the owner and is independent of these third-party notices.

The default branch commits no built assets, dependency directories, user diagrams, screenshots, or host configuration; only the generated `release` branch adds `dist/`. The new package is marked `private: true`; the repository has no blanket open-source license.
