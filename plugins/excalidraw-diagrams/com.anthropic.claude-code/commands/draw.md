---
description: Generate an architecture diagram as an Excalidraw file from a natural language description
argument-hint: "<description of diagram>"
allowed-tools:
  - Bash
  - Write
  - Read
---

# /draw — Generate Architecture Diagram

You are generating an Excalidraw architecture diagram from the user's description.

## Setup

First, ensure dependencies are installed:
```bash
cd ${CLAUDE_PLUGIN_ROOT}/skills/excalidraw/scripts && if [ ! -d node_modules ]; then npm install; fi
```

## Process

1. **Parse** the user's description into the IR JSON format below
2. **Write** the IR JSON to a temp file
3. **Generate** the Excalidraw file by running: `cat <ir.json> | node ${CLAUDE_PLUGIN_ROOT}/skills/excalidraw/scripts/generate.mjs <output.excalidraw>`
4. **Export** SVG/PNG by running: `node ${CLAUDE_PLUGIN_ROOT}/skills/excalidraw/scripts/export.mjs <output.excalidraw>`
5. Report the output file paths to the user

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

### Node Types
- `component` — rounded rectangle (default)
- `database` — for databases/storage
- `queue` — for message queues
- `user` — for users/actors
- `cloud` — for cloud services
- `group` — for grouping

### Color Palette
| Color  | Use Case               |
|--------|------------------------|
| blue   | Frontend, UI           |
| green  | APIs, Services         |
| orange | Databases, Storage     |
| red    | Auth, Security         |
| purple | Infrastructure         |
| yellow | Queues, Events         |
| gray   | External / 3rd party   |

### Direction
- `TB` — top-to-bottom (default, best for hierarchical flows)
- `LR` — left-to-right (best for pipeline/sequence flows)

## Output Files

Write files to the current working directory. Name them based on the diagram title (kebab-case), e.g.:
- `system-architecture.excalidraw`
- `system-architecture.svg`
- `system-architecture.png`

## Guidelines

- Use descriptive node labels with line breaks for details: `"API Gateway\n(Express)"`
- Choose colors that semantically match node roles
- Group related services together
- Keep labels concise — long labels cause layout issues
- Prefer TB direction for hierarchical architectures, LR for data pipelines
- Write the IR JSON to a temporary file, not inline to stdin, to avoid shell escaping issues

## Example

User says: "Draw a web app with React frontend, Express API, and PostgreSQL database"

IR:
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
