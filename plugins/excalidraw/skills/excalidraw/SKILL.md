---
name: excalidraw
description: Create, open and edit local Excalidraw drawings, architecture diagrams and flowcharts with the bundled local-excalidraw MCP App. Use when the user asks to draw, open or list the drawing library, asks what is in a saved drawing or in "the list" / "this page" while the Excalidraw library or a drawing is open (e.g. 图纸库、列表、这张图), or continues editing a saved diagram while preserving manual changes.
compatibility: Requires this plugin's local-excalidraw stdio MCP server and Node.js 22+. Interactive editing requires an MCP Apps host; Sidebar is optional.
metadata:
  version: "0.1.0"
---

# Local Excalidraw

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
4. To modify existing elements, retain all their fields and only change what the user requested. Prefer `patch_drawing` with complete upsert elements and `expectedRevision` from the latest read. Untouched elements and local image files are retained.
5. On a revision conflict, read the latest drawing again, reapply only intended edits, and retry. Never bypass revision checks or replace the entire drawing to suppress a conflict.
6. `save_drawing` is a full-scene replacement. Include all retained elements and files. Use it only when a full save is intended. Image files must be embedded PNG/JPEG/WebP/GIF data, not remote URLs. Scenes are limited to 4 MiB serialized.
7. Do not delete elements, overwrite an unrelated drawing, or discard a user's unsaved edits without clear authorization. Five previous saved versions are retained locally; this is not unlimited undo.

Data lives under `~/.excalidraw-plugin/` by default, not in the source repository.
Do not claim a save succeeded until the tool returns success. Do not claim offline inference: reading a scene through an AI host can transmit it to that host/model.
