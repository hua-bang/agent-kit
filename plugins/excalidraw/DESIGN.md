# UI design contract

## 1. Direction

Look like Excalidraw itself: the shell reuses the editor's UI tokens (violet primary, `surface-low` gray buttons, white "island" panels with the island shadow), so chrome and canvas read as one product. Keep it lean: one heading with a count, one toolbar row, cards with a thumbnail, a title and a time. No decorative marks, hover hints or revision numbers in lists. Chrome follows the host theme (`hostContext.theme`, falling back to `prefers-color-scheme`) and passes it to the editor and preview export.

## 2. Palette

Values mirror Excalidraw 0.18's CSS variables. Tokens live on `:root` and are redefined under `[data-theme="dark"]` (set by `applyDocumentTheme`).

| Token | Light | Dark | Excalidraw source |
| --- | --- | --- | --- |
| `--canvas` | `#ffffff` | `#121212` | default canvas background |
| `--island` | `#ffffff` | `#232329` | `--island-bg-color` |
| `--ink` / `--muted` | `#1b1b1f` / `#7a7a7a` | `#e3e3e8` / `#999999` | `--color-on-surface`, gray scale |
| `--button` / `--button-hover` | `#ececf4` / `#f1f0ff` | `#31303b` / `#3d3c4a` | `--color-surface-low` / `-high` |
| `--primary` (+ hover, active) | `#6965db` | `#a8a5ff` | `--color-primary` (+ `-darker`) |
| `--primary-light` / `--primary-text` | `#e3e2fe` / `#5b57d1` | `#403e6a` / `#d0ceff` | count badge, notices, empty icon |
| `--line` | `#ebebeb` | `#2e2d39` | inputs, bar dividers |
| `--ok` / `--pending` / `--danger` | `#2b8a3e` / `#f08c00` / `#e03131` | `#51cf66` / `#ffa94d` / `#ff8787` | save dot, errors |

## 3. Typography

System stack with PingFang SC / YaHei fallback, no added web fonts (Excalifont only covers Latin, so it is not used for mostly-Chinese titles). 14px body and buttons, 16px/600 library heading and card title, 13px editor actions, 12px metadata and status. Library titles clamp to two lines; card and editor titles wrap rather than truncate.

## 4. Components

- Buttons: 8px radius, 36px high (32px in the editor bar). `tool` buttons use Excalidraw's gray fill and get a primary border while pressed; the primary button is violet with bold text; `ghost` is only for "back". Icons appear only on back, search, refresh and create; they are local inline SVG with `aria-hidden`, and the icon-only refresh button carries an `aria-label`.
- Inputs: 36px, 1px `--line` border on the island colour; focus shows a 1px primary border plus a 1px primary ring.
- Count: a violet-tinted badge beside the library heading; while searching it reads `matches / total`.
- Save state: an 8px coloured dot plus label.
- Library cards: island panels with the island shadow and an 8px radius, 16:10 thumbnail on the canvas colour rendered lazily by the SDK as a `data:` PNG (host CSPs commonly allow `data:` but not `blob:` images), title and relative time. Hover outlines the card in primary.
- Preview failures never prevent opening the editor.

## 5. Layout and identity

- Drawing resource: fixed-ID preview, then explicit expand to edit, then return to that same preview. No list, new-drawing or ID-switch control inside a conversation card.
- Library resource: search/create/list, then full-width editor with return to list. Copy creates a new UUID and opens the independent copy.
- Both resources serve the same UI bundle with a server-assigned surface marker. Surface is not inferred from viewport width, MCP connection or a global last-opened drawing.
- `open_library` is an explicit library request intended for Sidebar. A host may render this dedicated resource inline when Sidebar is unavailable; it is not reachable from a drawing card. The plugin cannot force a host to place a resource in its Sidebar.
- No stable host conversation ID is assumed. The Agent carries drawing IDs explicitly in conversation context. A drawing card binds to the first document result and ignores unrelated results.
- Return waits for a successful save. Conflicted drafts remain editable and exportable. Preview-only opening does not write a new revision.

## 6. Depth

Only library cards are raised, with Excalidraw's island shadow; bars use a 1px divider; notices are tinted rounded strips inside the content column. The library heading, notices and content share one centred 960px column. Plain CSS; app selectors are wrapped in `:where()` / `:not(.excalidraw *)` so they never restyle Excalidraw's native controls.

## 7. Guardrails

Use real Excalidraw rendering and editing, never a mock canvas. Do not introduce CDN requests, new component libraries, automatic dependency installation or a session database. Keep errors actionable, loading distinct from empty results, and explicit reload confirmation before discarding a draft. Thumbnails load only when visible; list pages reveal 20 at a time.

## 8. Responsive and motion

At 640px and below, the library toolbar stacks search above create. At 560px and below, editor actions move to their own row under back/title/status; the library grid becomes two columns; the card's expand button spans the full width; preview height becomes 240px (320px normally) and editor height 520px (600px normally). 150ms colour transitions and the pending pulse are disabled under reduced motion. Excalidraw's native compact toolbar is retained. The app fills the frame height: `html`/`body`/`#root` are 100% and the editor, card preview and library grow into spare space. The App SDK measures `<html>` at `max-content`, so the reported auto-resize height stays the natural one (600px editor, 320px preview). When the host context reports a fixed `containerDimensions.height` or fullscreen mode, `data-fill` is set on `<html>` and the editor shrinks to fit (minimum 320px) instead of overflowing. Browser regression checks 375px layout and long Chinese/English names. Actual Codex Sidebar sizing remains a host acceptance task.

## 9. Follow-up implementation prompts

- Add a secondary action as a `tool` button: 13–14px text, `--button` fill, 8px radius, 32–36px height, `--button-hover` on hover, primary border while pressed. Do not change native Excalidraw buttons.
- Add a library state using 12px `--muted` metadata on `--bg`, optionally with a violet-tinted `empty-icon` tile. Loading must not show the final empty-state message.
- Add drawing metadata to the card's `.meta` line without repeating save state. Keep the h1 title and the fixed drawing ID; never introduce a library switcher into the drawing resource.
