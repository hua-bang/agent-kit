# UI design contract

## 1. Direction

Paper canvas with quiet monochrome controls. Excalidraw contributes the drawing tools, Notion informs the list-to-detail navigation, and Linear informs compact action rows. These are interaction references, not copied assets. The real drawing, not a decorative shell, is the visual anchor.

## 2. Palette

- Ink `#252525`: headings, primary actions.
- Secondary `#646464`: dates and save state.
- Paper `#ffffff`: drawing and thumbnails.
- Shell `#f0f0f0`: library and editor actions.
- Divider `#dedede`, hover `#e5e5e5`.
- Errors `#8e2424` on `#fff4f4`, reserved for actionable failures.

## 3. Typography

System stack with PingFang SC fallback, no added web fonts. 14px body and controls, 16px/600 headings, 12px status and metadata. Saving states use identical sizing to avoid layout jumps. Long drawing names wrap rather than disappear behind truncation.

## 4. Components

Buttons use 6px radius and 40px minimum height. Primary controls use dark ink fill; secondary controls are quiet text buttons. Inputs share button geometry. Focus uses a 2px ink outline. Library rows contain lazy SDK-rendered raster thumbnails, title, revision/date and a navigation indicator. Preview failures never prevent opening the editor.

## 5. Layout and identity

- Drawing resource: fixed-ID preview, then explicit expand to edit, then return to that same preview. No list, new-drawing or ID-switch control inside a conversation card.
- Library resource: search/create/list, then full-width editor with return to list. Copy creates a new UUID and opens the independent copy.
- Both resources serve the same UI bundle with a server-assigned surface marker. Surface is not inferred from viewport width, MCP connection or a global last-opened drawing.
- `open_library` is an explicit library request intended for Sidebar. A host may render this dedicated resource inline when Sidebar is unavailable; it is not reachable from a drawing card. The plugin cannot force a host to place a resource in its Sidebar.
- No stable host conversation ID is assumed. The Agent carries drawing IDs explicitly in conversation context. A drawing card binds to the first document result and ignores unrelated results.
- Return waits for a successful save. Conflicted drafts remain editable and exportable. Preview-only opening does not write a new revision.

## 6. Depth

Background steps and fine dividers only. No shadows, gradients, ornamental icons or nested cards. Plain CSS only, scoped app chrome must not restyle Excalidraw's native controls.

## 7. Guardrails

Use real Excalidraw rendering and editing, never a mock canvas. Do not introduce CDN requests, new component libraries, automatic dependency installation or a session database. Keep errors actionable, loading distinct from empty results, and explicit reload confirmation before discarding a draft. Thumbnails load only when visible; list pages reveal 20 at a time.

## 8. Responsive and motion

At 480px and below, editor status gets a stable separate row; actions wrap; preview height becomes 240px and editor height 500px. Normal preview height is 280px. Press scale .97 and 150ms color transition are disabled under reduced motion. Excalidraw's native compact toolbar is retained rather than overridden. Browser regression checks 375px layout and long Chinese/English names. Actual Codex Sidebar sizing remains a host acceptance task.

## 9. Follow-up implementation prompts

- Add a secondary action with 14px system text, `#252525` foreground, transparent background, 6px radius, minimum 40px height, 8px/12px padding, and `#e5e5e5` hover. Do not change native Excalidraw buttons.
- Add a library state using 12px `#646464` metadata and 16px padding on `#f0f0f0`. Loading must not show the final empty-state message.
- Add drawing metadata without repeating save state. Keep the 16px/600 title and the fixed drawing ID; never introduce a library switcher into the drawing resource.
