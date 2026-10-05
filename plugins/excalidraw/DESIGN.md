# UI design contract

## 1. Direction

Geist-inspired (Vercel dashboard): one surface colour, hairline borders, monochrome primary action and monospace revision numbers. No brand colour, shadows or decorative marks; colour is reserved for state (focus, save status, errors). The real drawing, shown on a faint dotted canvas, is the only visual anchor. Chrome follows the host theme (`hostContext.theme`, falling back to `prefers-color-scheme`) and passes it to the Excalidraw editor and preview export.

## 2. Palette

Tokens live on `:root` and are redefined under `[data-theme="dark"]` (set by `applyDocumentTheme`).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#0a0a0a` | The single page/card surface |
| `--subtle` / `--dot` | `#fafafa` / `#e4e4e4` | `#111111` / `#262626` | Dotted preview canvas, notices |
| `--ink` | `#171717` | `#ededed` | Text |
| `--muted` / `--faint` | `#666666` / `#8f8f8f` | `#a1a1a1` / `#737373` | Metadata, icons, placeholders |
| `--line` / `--line-strong` | `#ebebeb` / `#d4d4d4` | `#232323` / `#3a3a3a` | Borders; strong on hover |
| `--primary` | `#171717` | `#ededed` | Primary button (inverted text) |
| `--focus` | `#006bff` | `#52a8ff` | Focus outline and input ring only |
| `--ok` / `--pending` | `#1a9338` / `#e59a00` | `#3fbf64` / `#f5b544` | Save-state dot |
| `--danger` on `--danger-soft` | `#d4342a` on `#fff0ef` | `#ff6166` on `#2a1314` | Actionable failures only |

## 3. Typography

`Geist`/`Inter` when installed, then the system stack with PingFang SC / YaHei; `Geist Mono`/`ui-monospace` for revision numbers. No bundled web fonts. 14px body, 16px/600 library heading, 14px/600 card and editor titles, 13px/500 buttons, 12px metadata and status. Library titles clamp to two lines; card and editor titles wrap rather than truncate.

## 4. Components

- Buttons: 6px radius, 32px high (36px beside inputs). Primary is the inverted ink fill; secondary actions are ghost buttons in `--muted` that darken on hover; icon-only buttons (refresh) are bordered squares with an `aria-label`. Icons are local inline SVG with `aria-hidden`.
- Inputs: 36px, 1px `--line` border, stronger border on hover, blue ring on focus. Search has a leading icon and shares one toolbar row with the create input and button.
- Save state: an 8px coloured dot plus label, like a deployment status; no pill background.
- Library cards: 10px radius, 1px border that strengthens on hover, 16:10 dotted thumbnail rendered lazily by the SDK as a `data:` PNG (host CSPs commonly allow `data:` but not `blob:` images), title, relative time and monospace revision.
- Preview failures never prevent opening the editor.

## 5. Layout and identity

- Drawing resource: fixed-ID preview, then explicit expand to edit, then return to that same preview. No list, new-drawing or ID-switch control inside a conversation card.
- Library resource: search/create/list, then full-width editor with return to list. Copy creates a new UUID and opens the independent copy.
- Both resources serve the same UI bundle with a server-assigned surface marker. Surface is not inferred from viewport width, MCP connection or a global last-opened drawing.
- `open_library` is an explicit library request intended for Sidebar. A host may render this dedicated resource inline when Sidebar is unavailable; it is not reachable from a drawing card. The plugin cannot force a host to place a resource in its Sidebar.
- No stable host conversation ID is assumed. The Agent carries drawing IDs explicitly in conversation context. A drawing card binds to the first document result and ignores unrelated results.
- Return waits for a successful save. Conflicted drafts remain editable and exportable. Preview-only opening does not write a new revision.

## 6. Depth

Flat: borders only, no shadows or gradients other than the dotted canvas pattern, no nested cards. The library header, notices and content share one centred 960px column so their edges align. Plain CSS; app selectors are wrapped in `:where()` / `:not(.excalidraw *)` so they never restyle Excalidraw's native controls.

## 7. Guardrails

Use real Excalidraw rendering and editing, never a mock canvas. Do not introduce CDN requests, new component libraries, automatic dependency installation or a session database. Keep errors actionable, loading distinct from empty results, and explicit reload confirmation before discarding a draft. Thumbnails load only when visible; list pages reveal 20 at a time.

## 8. Responsive and motion

At 640px and below, the library toolbar stacks search above create. At 560px and below, editor actions move to their own row under back/title/status and drop their icons; the library grid becomes two columns; the card's expand button spans the full width; preview height becomes 240px (320px normally) and editor height 520px (600px normally). 150ms colour transitions, the hover hint fade and the pending pulse are disabled under reduced motion; on touch devices the "点击编辑" hint is always shown. Excalidraw's native compact toolbar is retained. The app fills the frame height: `html`/`body`/`#root` are 100% and the editor, card preview and library grow into spare space. The App SDK measures `<html>` at `max-content`, so the reported auto-resize height stays the natural one (600px editor, 320px preview). When the host context reports a fixed `containerDimensions.height` or fullscreen mode, `data-fill` is set on `<html>` and the editor shrinks to fit (minimum 320px) instead of overflowing. Browser regression checks 375px layout and long Chinese/English names. Actual Codex Sidebar sizing remains a host acceptance task.

## 9. Follow-up implementation prompts

- Add a secondary action as a `ghost` button: 13px/500 text in `--muted`, local SVG icon, 6px radius, 32px height, `--hover` background and `--ink` text on hover. Do not change native Excalidraw buttons.
- Add a library state using 12px `--muted` metadata on `--bg`, optionally with a bordered `empty-icon` tile. Loading must not show the final empty-state message.
- Add drawing metadata to the card's `.meta` line without repeating save state. Keep the h1 title and the fixed drawing ID; never introduce a library switcher into the drawing resource.
