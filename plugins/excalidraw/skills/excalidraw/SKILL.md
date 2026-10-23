---
name: excalidraw
description: Create, open and edit local Excalidraw drawings, architecture diagrams and flowcharts with Agentic Excalidraw, the bundled local-excalidraw MCP App. Use when the user asks to draw, open or list the drawing library, asks what is in a saved drawing or in "the list" / "this page" while the Excalidraw library or a drawing is open (e.g. 图纸库、列表、这张图), or continues editing a saved diagram while preserving manual changes.
compatibility: Requires this plugin's local-excalidraw stdio MCP server and Node.js 22+. Interactive editing requires an MCP Apps host; Sidebar is optional.
metadata:
  version: "0.1.0"
---

# Agentic Excalidraw

An unofficial plugin, not affiliated with or endorsed by the Excalidraw team.

Requires this plugin's MCP server, configured according to [README](../../README.md).
Tool names may be prefixed by the host's server name. This portable Agent Plugins package discovers the skill from `skills/` and the server from root `mcp.json`; installing only this skill does not install its server.

## Connection and safety

- Use this package's `local-excalidraw` tools, not the neighboring `excalidraw-diagrams` remote server (`create_view`, checkpoints). Do not silently send local drawings to a remote fallback.
- If the server is missing, explain that the whole plugin must be installed and built; follow the README. Do not modify host configuration or install dependencies without authorization.
- For “open my library”, call `open_library`. For a named existing drawing, list and resolve its ID; ask when multiple names match.
- When the user refers to “the list”, “my drawings”, “this page” or “this drawing” while the Excalidraw library or a drawing card is open, they mean this plugin's data. Loads made by the UI itself do not reach you: use the drawing IDs in any app context the host provides (the UI reports its current view when the host supports it), otherwise call `list_drawings`, and `read_drawing` for a specific drawing. Do not ask which list they mean.
- A user may @-mention a drawing, which attaches a link like `excalidraw://drawings/<id>`. The last path segment is the drawing ID: read the resource if your host can, otherwise call `read_drawing` with that ID. Never edit through the resource; use `patch_drawing`/`save_drawing`.
- If tools work but no editor appears, distinguish MCP connectivity from host MCP Apps support. Do not repeatedly create drawings to diagnose UI rendering.
- Mermaid conversion is intentionally unavailable. Generate standard Excalidraw elements directly; Mermaid pasted into the editor remains text.

## Drawing workflow

1. For existing drawings, use `list_drawings` to discover an ID, then `read_drawing` to read the latest scene and revision. Never invent a drawing ID.
2. Use `open_drawing` to show a fixed-ID drawing card; it opens straight in the editor and autosaves the user's edits to that drawing. There is no library switcher in this card. Use `open_library` only for an explicit library request; its separate resource is intended for Sidebar but host placement can vary. The drawing App works without Sidebar support.
   Keep the current drawing ID explicitly in this conversation. Continue that ID unless asked to create, switch or copy. Never infer it from a global most-recent drawing or MCP connection ID. To copy, read the latest scene then create a new drawing with it; existing cards stay attached to the original ID.
3. To create a drawing, call `create_drawing` with a title and optionally an Excalidraw scene. Keep element IDs unique and stable. Use standard Excalidraw element fields, not arbitrary diagram DSLs. Default to the hand-drawn style unless the user asks otherwise: `roughness: 1` on shapes and arrows, and `fontFamily: 1` (Virgil) on text. Size text boxes generously (about `fontSize × 0.6` per Latin character and `fontSize` per CJK character, `fontSize × lineHeight` per line); Excalidraw clips text beyond its element's width.
   Build diagrams so a person can move and edit them like hand-made ones, not as loose stacked layers:
   - Put a node's label inside its shape: the text gets `containerId: "<shape id>"`, `textAlign: "center"`, `verticalAlign: "middle"`, and the shape lists it in `boundElements: [{ "id": "<text id>", "type": "text" }]`. Do not lay a free text element over a shape.
   - Connect arrows to shapes: the arrow gets `startBinding: { "elementId": "<from id>", "focus": 0, "gap": 8 }` and the same `endBinding` for the target, and each shape adds `{ "id": "<arrow id>", "type": "arrow" }` to its `boundElements`. The arrow's `x`/`y` is its start point and `points` are relative, starting at `[0, 0]` and ending at the target's edge. Arrow labels use `containerId` on the arrow the same way.
   - Do not use `groupIds`, frames or `locked: true` unless asked: grouping makes a click select the whole cluster instead of the one shape.
   Example of two connected nodes: `[{"id":"a","type":"rectangle","x":0,"y":0,"width":160,"height":80,"boundElements":[{"id":"a-label","type":"text"},{"id":"a-b","type":"arrow"}]},{"id":"a-label","type":"text","x":10,"y":28,"width":140,"height":25,"text":"Start","originalText":"Start","fontSize":20,"fontFamily":1,"lineHeight":1.25,"textAlign":"center","verticalAlign":"middle","containerId":"a"},{"id":"b","type":"rectangle","x":300,"y":0,"width":160,"height":80,"boundElements":[{"id":"a-b","type":"arrow"}]},{"id":"a-b","type":"arrow","x":168,"y":40,"width":124,"height":0,"points":[[0,0],[124,0]],"startBinding":{"elementId":"a","focus":0,"gap":8},"endBinding":{"elementId":"b","focus":0,"gap":8},"endArrowhead":"arrow"}]`.
   When editing, keep these links consistent: removing a shape also removes or unbinds its arrows and labels.
   Presets: call `list_templates` to see the built-in presets (flowchart, architecture, mindmap, sequence, kanban, matrix) and the user's own templates (UUID, name, when to use it). Prefer a user template whose name or description fits the request. Call `create_drawing` with `template` (a preset name or a user template UUID) and `language` (`zh-CN` for Chinese conversations, otherwise `en`) instead of a scene, then `read_drawing` and `patch_drawing` the labels and nodes to the user's content. Template element IDs are readable (`start`, `check`, `gateway`, `<id>-label`); keep them stable when patching.
4. To modify existing elements, retain all their fields and only change what the user requested. Prefer `patch_drawing` with complete upsert elements and `expectedRevision` from the latest read. Untouched elements and local image files are retained.
5. If the user has unsaved edits in an open editor when you write, their editor pauses and lets them keep their edits as a new drawing or discard them; it never merges silently. On a revision conflict, read the latest drawing again, reapply only intended edits, and retry. Never bypass revision checks or replace the entire drawing to suppress a conflict.
6. `save_drawing` is a full-scene replacement. Include all retained elements and files. Use it only when a full save is intended. Image files must be embedded PNG/JPEG/WebP/GIF data, not remote URLs. Scenes are limited to 4 MiB serialized.
7. Delete a whole drawing with `delete_drawing` (and the latest `expectedRevision`) only when the user explicitly asks for that drawing; it moves to the local `trash/` folder. Users can also delete from a library card.
8. Do not delete elements, overwrite an unrelated drawing, or discard a user's unsaved edits without clear authorization. Five previous saved versions are retained locally; this is not unlimited undo.

## Suggesting next steps

- After creating a drawing or making a substantial edit, end your reply with two or three short, concrete next steps that fit this drawing (for example: add an error branch, split a crowded layer, unify colours, turn it into a sequence diagram), phrased so the user can just say "do 1". Do not act on them until asked.
- The editor's `建议` / `Ideas` button and its welcome screen can post messages for the user, such as "Tidy the layout of drawing “…” (id …)" or ones naming selected element IDs. Treat them as normal user requests: read the latest drawing first, change only what was asked (only the listed elements when IDs are given), and keep the user's manual layout elsewhere.
- Templates a user inserts in the editor get prefixed IDs (`kanban-<suffix>-c1`, `tpl-<suffix>-…`); treat them like any other elements.

## The user's own templates

- When the user asks to keep a diagram as a template, call `save_template` with `drawingId` (its latest saved scene), a short `name`, and a `description` of when to use it; set `placeholders: true` only if they want text replaced by numbered placeholders.
- The editor's "用一句话生成模板 / Describe a template" posts a request like “Create a reusable drawing template from this description: …”. Draw a draft with `create_drawing` (title starting with “模板草稿：” / “Template draft: ”), keep it generic but concrete, ask whether to adjust, and call `save_template` with that drawing only after the user confirms. Do not save templates on your own initiative.
- Delete a template with `delete_template` only when the user explicitly asks; it moves to the local `trash/` folder.

Data lives under `~/.excalidraw-plugin/` by default, not in the source repository.
Do not claim a save succeeded until the tool returns success. Do not claim offline inference: reading a scene through an AI host can transmit it to that host/model.
