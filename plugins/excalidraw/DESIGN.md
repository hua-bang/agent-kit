# UI design contract

## 1. Direction

Paper canvas inside a calm, card-based shell. Excalidraw contributes the drawing tools; the library reads like a gallery of real thumbnails, the conversation card like a framed canvas with a single clear action. The real drawing, not decoration, is the visual anchor. Chrome follows the host theme (`hostContext.theme`, falling back to `prefers-color-scheme`) and passes it to the Excalidraw editor and preview export.

## 2. Palette

Tokens live on `:root` and are redefined under `[data-theme="dark"]` (set by `applyDocumentTheme`).

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--ink` | `#1d1d22` | `#ececf1` | Text, ghost actions |
| `--muted` | `#6c6c76` | `#9c9ca8` | Metadata, icons |
| `--bg` | `#f6f6f8` | `#141417` | Library background |
| `--surface` | `#ffffff` | `#1d1d21` | Bars, cards |
| `--canvas` / `--canvas-dot` | `#ffffff` / `#e3e3ea` | `#121214` / `#2a2a30` | Dotted preview canvas |
| `--line` | `#e7e7ec` | `#2c2c33` | Dividers, card borders |
| `--accent` | `#6965db` | `#a8a5ff` | Primary action, focus, mark |
| `--accent-soft` | `#ecebff` | `#2b2a4a` | Mark tile, notices, focus ring |
| `--ok` / `--pending` | `#2f9e5a` / `#d9822b` | `#4cc27a` / `#eba45a` | Save-state dot |
| `--danger` on `--danger-soft` | `#c23a3a` on `#fdf0f0` | `#ff8a8a` on `#3a2224` | Actionable failures only |

## 3. Typography

System stack with PingFang SC / YaHei fallback, no added web fonts. 14px body, 15px/600 headings and editor title, 13px editor actions, 12px metadata and status. Library titles clamp to two lines; card and editor titles wrap rather than truncate.

## 4. Components

- Buttons: 8px radius, 36px minimum height, icon + label. Primary uses accent fill; secondary actions are ghost buttons with muted icons. Icon-only buttons (refresh) carry an `aria-label`. All icons are local inline SVG with `aria-hidden`.
- Inputs: 8px radius, accent border plus 3px soft ring on focus. Search has a leading icon.
- Save state: a pill with a coloured dot (saved / saving or unsaved, pulsing / paused, tinted red).
- Library cards: 12px radius, 4:3 dotted-canvas thumbnail rendered lazily by the SDK, title, relative time and revision.
- Mark: a hand-drawn stroke in an accent-soft tile; it is not the Excalidraw logo.
- Preview failures never prevent opening the editor.

## 5. Layout and identity

- Drawing resource: fixed-ID preview, then explicit expand to edit, then return to that same preview. No list, new-drawing or ID-switch control inside a conversation card.
- Library resource: search/create/list, then full-width editor with return to list. Copy creates a new UUID and opens the independent copy.
- Both resources serve the same UI bundle with a server-assigned surface marker. Surface is not inferred from viewport width, MCP connection or a global last-opened drawing.
- `open_library` is an explicit library request intended for Sidebar. A host may render this dedicated resource inline when Sidebar is unavailable; it is not reachable from a drawing card. The plugin cannot force a host to place a resource in its Sidebar.
- No stable host conversation ID is assumed. The Agent carries drawing IDs explicitly in conversation context. A drawing card binds to the first document result and ignores unrelated results.
- Return waits for a successful save. Conflicted drafts remain editable and exportable. Preview-only opening does not write a new revision.

## 6. Depth

Soft two-layer shadows on cards and the primary button only, lifted slightly on hover. No gradients other than the dotted canvas pattern, no nested cards. Plain CSS; app selectors are wrapped in `:where()` / `:not(.excalidraw *)` so they never restyle Excalidraw's native controls.

## 7. Guardrails

Use real Excalidraw rendering and editing, never a mock canvas. Do not introduce CDN requests, new component libraries, automatic dependency installation or a session database. Keep errors actionable, loading distinct from empty results, and explicit reload confirmation before discarding a draft. Thumbnails load only when visible; list pages reveal 20 at a time.

## 8. Responsive and motion

At 560px and below, editor actions move to their own wrapped row under back/title/status; the library grid becomes two columns; the card's expand button spans the full width; preview height becomes 240px (320px normally) and editor height 520px (600px normally). Press scale .97, 150ms transitions, the hover hint and the pending pulse are disabled under reduced motion; on touch devices the "点击编辑" hint is always shown. Excalidraw's native compact toolbar is retained. Browser regression checks 375px layout and long Chinese/English names. Actual Codex Sidebar sizing remains a host acceptance task.

## 9. Follow-up implementation prompts

- Add a secondary action as a `ghost` button: 13–14px text, local SVG icon in `--muted`, 8px radius, 36px minimum height, `--hover` background on hover. Do not change native Excalidraw buttons.
- Add a library state using 12px `--muted` metadata on `--bg`, optionally with an `empty-icon` tile. Loading must not show the final empty-state message.
- Add drawing metadata to the card's `.meta` line without repeating save state. Keep the h1 title and the fixed drawing ID; never introduce a library switcher into the drawing resource.
