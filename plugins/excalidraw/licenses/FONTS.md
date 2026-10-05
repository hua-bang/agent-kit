# Bundled fonts

The UI build inlines these font files unmodified from `@excalidraw/excalidraw@0.18.1` (`dist/prod/fonts/`). Copyright and license data below were read from each file's own OpenType `name` table (IDs 0, 5, 13, 14), not inferred from family names.

| Family | Version | Copyright (name ID 0) | License evidence | License |
| --- | --- | --- | --- | --- |
| Assistant | 3.000 | Copyright 2020 The Assistant Project Authors (https://github.com/hafontia/Assistant). Copyright 2010 The Source Sans Pro Authors (https://github.com/adobe-fonts/source-sans-pro), with Reserved Font Name 'Source'. Source is a trademark of Adobe Systems Incorporated in the United States and/or other countries. | ID 13 states OFL 1.1 | [OFL 1.1](OFL-1.1.txt) |
| Virgil | 001.001 | Copyright (c) 2011 by Your Own Font Foundry. All rights reserved. | ID 13 states OFL 1.1 and embeds its full text | [OFL 1.1](OFL-1.1.txt) |
| Lilita One | 1.002 | Copyright (c) 2011 Juan Montoreano (juan@remolacha.biz), with Reserved Font Names "Lilita One" | ID 14 license URL is the OFL | [OFL 1.1](OFL-1.1.txt) |
| Nunito | 3.602 | Copyright 2014 The Nunito Project Authors (https://github.com/googlefonts/nunito) | ID 14 license URL is the OFL | [OFL 1.1](OFL-1.1.txt) |
| Comic Shanns | 1.3.0 | Copyright (c) 2018 Shannon Miwa, (c) 2023 Jesus Gonzalez, (c) 2023 Rodrigo Batista de Moraes, (c) 2024 Fini Jastrow, (c) 2024 Kyle Beechly | ID 0 embeds the full MIT license | [MIT](ComicShanns-MIT.txt) |

`OFL-1.1.txt` is the license text embedded in the bundled Virgil file; it is identical to the text in Microsoft's `cascadia-code` repository. `ComicShanns-MIT.txt` is the text embedded in the bundled Comic Shanns file. Reserved Font Names are unaffected: the files are shipped unmodified.

## Families not shipped

Excalidraw 0.18.1 also ships the families below. Their redistribution terms could not be verified from the files or reachable upstream sources, so the build substitutes a family from the table above (see `localFonts` in `vite.config.ts`, which fails the build if any other family would be inlined). Drawings keep their original `fontFamily` values; only rendering inside this plugin differs.

| Family | Finding | Rendered with |
| --- | --- | --- |
| Excalifont 1.000 | ID 0 reads "All rights reserved"; no license field; no license file in Excalidraw v0.18.0 `packages/excalidraw/fonts/`. | Virgil (its predecessor) |
| Cascadia Code 2005.150 | ID 13 carries Microsoft's product-font terms, although the upstream repository is OFL 1.1. | Comic Shanns Latin subset (monospace) |
| Liberation Sans 1.05 | ID 13 only refers to "the license agreement under which you accepted" it (Ascender, 2007). The upstream repository's OFL notice names Google 2010 / Red Hat 2012 digitized data, i.e. the 2.x releases, not this file. | Assistant Regular |
| Xiaolai SC | 12 MiB, too large for common stdio message limits. | Assistant Regular plus system CJK fonts |
