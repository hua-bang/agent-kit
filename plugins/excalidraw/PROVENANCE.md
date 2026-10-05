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

Local modifications are integration code, not a vendored source fork. The Vite font transform inlines font assets from the installed package and substitutes its large Xiaolai fallback with Liberation plus system CJK fallback to remain below common stdio message limits. The original installed assets are not changed.

**Binary redistribution is not yet cleared.** Before distributing `dist/`, collect and preserve the notices for all bundled transitive dependencies and each bundled font (Assistant, Cascadia, ComicShanns, Excalifont, Liberation, Lilita, Nunito, Virgil). The editor's MIT license must not be treated as a substitute for those notices. Font-specific license files were not found in the inspected Excalidraw v0.18.1 tree, so this task remains a release blocker rather than a guessed license declaration.

No built assets, dependency directories, user diagrams, screenshots, or host configuration are committed. The new package is marked `private: true`; the repository has no blanket open-source license.
