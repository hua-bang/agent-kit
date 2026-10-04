---
name: excalidraw
description: >-
  Generates Excalidraw architecture diagrams from a natural-language
  description, rendering inline via the Excalidraw MCP server by default and
  falling back to local scripts (.excalidraw + SVG + PNG) when MCP is
  unavailable or files are requested. Use when the user asks to "draw a diagram",
  "architecture diagram", "visualize the system", "excalidraw", "system
  diagram", "generate diagram", "box and arrow diagram", "component diagram"
  or "service map".
compatibility: Best with the Excalidraw MCP server (shipped in mcp.json). Script fallback requires Node.js 18+ and npm.
metadata:
  version: "1.1.0"
---

# Excalidraw Diagram Generation

Generate architecture diagrams as Excalidraw files with SVG/PNG exports.

All paths below are relative to this skill's directory (the folder containing
this `SKILL.md`). Resolve them to absolute paths before running commands.

## When to Use

- Draw or create an architecture / system / component diagram
- Visualize a system, codebase, or service topology
- Generate an Excalidraw file
- Create a box-and-arrow diagram

## Choose a rendering path (MCP first)

**Default: render inline with the Excalidraw MCP server.** This plugin ships
one in `mcp.json` (server name `excalidraw`). Before anything else, check
whether its tools are available in this session (client UIs may show them
under names such as `read_me` / `create_view`, possibly prefixed with the
server name).

1. **MCP available → use it.** Call the server's `read_me` tool once to load
   the element format, then call `create_view` with the elements. Do not run
   `npm install` or the scripts. Do not explain the choice to the user.
2. **Fall back to the scripts** (sections below) only when:
   - the Excalidraw MCP tools are not available, failed to connect, or a call errors out; or
   - the user explicitly asks for files on disk (`.excalidraw`, `.svg`, `.png`,
     "save", "export", "download"), or the client has no way to display inline UI.
3. If the user wants both (see it now *and* keep a file), render with MCP first,
   then also run the scripts to write the files.

When falling back because MCP was unavailable, mention it in one short line
(e.g. "Excalidraw MCP isn't connected, so I generated files instead").

### MCP rendering tips

- Follow the server's `read_me` for element schema, colors, and camera rules;
  it is authoritative over this file for the MCP path.
- Use the same semantic palette as below (blue=frontend, green=API, …).
- Lay out top-to-bottom for layered/hierarchical diagrams; give containers a
  light gray background and put child boxes inside them.
- For edits to a diagram already rendered via MCP, prefer the server's
  checkpoint/restore mechanism over redrawing from scratch.

## Script path: how it works

1. Convert the user's description into an **IR (Intermediate Representation) JSON**
2. Run `scripts/generate.mjs` to produce an `.excalidraw` file with dagre auto-layout
3. Run `scripts/export.mjs` to produce `.svg` and `.png` files

## Setup (script path, first run only)

```bash
cd scripts && if [ ! -d node_modules ]; then npm install; fi
```

## IR JSON Format

```json
{
  "title": "Diagram Title",
  "direction": "TB",
  "nodes": [
    { "id": "unique_id", "label": "Display Name\n(detail)", "type": "component", "color": "blue" }
  ],
  "edges": [
    { "from": "source_id", "to": "target_id", "label": "optional label" }
  ],
  "groups": [
    { "id": "group_id", "label": "Group Name", "members": ["node_id1", "node_id2"] }
  ]
}
```

## Color Palette

| IR Color | Background | Stroke   | Use Case          |
|----------|-----------|----------|-------------------|
| blue     | #a5d8ff   | #1971c2  | Frontend, UI      |
| green    | #b2f2bb   | #2f9e44  | APIs, Services    |
| orange   | #ffd8a8   | #e8590c  | Databases         |
| red      | #ffc9c9   | #e03131  | Auth, Security    |
| purple   | #d0bfff   | #7048e8  | Infrastructure    |
| yellow   | #ffec99   | #f08c00  | Queues, Events    |
| gray     | #dee2e6   | #495057  | External/3rd party|

## Node Types
- `component` — rounded rectangle (general services, apps)
- `database` — databases, storage systems
- `queue` — message queues, event buses
- `user` — users, actors
- `cloud` — cloud services, external APIs
- `group` — logical grouping container

## Scripts

**Generate:** `node scripts/generate.mjs <output.excalidraw> < <ir.json>`

**Export:** `node scripts/export.mjs <output.excalidraw> [output-prefix]`
→ writes `<prefix>.svg` and `<prefix>.png`

Name output files after the diagram title in kebab-case
(e.g. `system-architecture.excalidraw`) and write them to the user's working
directory, not into the skill directory.

## Guidelines

- Use `TB` direction for hierarchical architectures, `LR` for pipelines
- Add `\n` in labels for multi-line text: `"API Gateway\n(Express)"`
- Group related services with the `groups` array
- Choose colors semantically (blue=frontend, green=API, orange=DB, etc.)
- Keep node count under 20 for readable diagrams; use groups for complexity
- Write the IR to a temp file rather than piping inline JSON to avoid escaping issues

## References

- `references/element-catalog.md` — node type templates and palette details
- `references/excalidraw-schema.md` — Excalidraw v2 JSON element schema

## Example

"Draw a web app with React frontend, Express API, and PostgreSQL database" →

```json
{
  "title": "Web Application",
  "direction": "TB",
  "nodes": [
    { "id": "frontend", "label": "Frontend\n(React)", "type": "component", "color": "blue" },
    { "id": "api", "label": "API Server\n(Express)", "type": "component", "color": "green" },
    { "id": "db", "label": "PostgreSQL\n(Database)", "type": "database", "color": "orange" }
  ],
  "edges": [
    { "from": "frontend", "to": "api", "label": "REST/HTTPS" },
    { "from": "api", "to": "db", "label": "SQL" }
  ],
  "groups": []
}
```
