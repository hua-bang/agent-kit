# Excalidraw v2 JSON Schema Reference

## File Wrapper

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "claude-code-excalidraw-plugin",
  "elements": [ ... ],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": null
  },
  "files": {}
}
```

## Common Element Properties

All elements share these fields:

| Field           | Type    | Description                                |
|-----------------|---------|-------------------------------------------|
| id              | string  | Unique identifier (UUID)                  |
| type            | string  | Element type                              |
| x, y            | number  | Position (top-left corner)                |
| width, height   | number  | Dimensions                                |
| angle           | number  | Rotation in radians (usually 0)           |
| strokeColor     | string  | Border/text color (hex)                   |
| backgroundColor | string  | Fill color (hex or "transparent")         |
| fillStyle       | string  | "solid", "hachure", "cross-hatch"         |
| strokeWidth     | number  | Border width (1 or 2)                     |
| strokeStyle     | string  | "solid", "dashed", "dotted"               |
| roughness       | number  | 0 (clean) to 2 (very sketchy)            |
| opacity         | number  | 0-100                                     |
| seed            | number  | Random int for roughjs rendering          |
| version         | number  | Version counter                           |
| versionNonce    | number  | Random int                                |
| isDeleted       | boolean | Soft delete flag                          |
| groupIds        | array   | Group membership                          |
| frameId         | null    | Frame container (null if none)            |
| roundness       | object  | `{ type: 3 }` for rounded, null for sharp|
| boundElements   | array   | Elements bound to this one                |
| updated         | number  | Timestamp                                 |
| link            | null    | Hyperlink                                 |
| locked          | boolean | Whether element is locked                 |

## Rectangle Element

```json
{
  "type": "rectangle",
  "roundness": { "type": 3 },
  "boundElements": [
    { "id": "text-id", "type": "text" },
    { "id": "arrow-id", "type": "arrow" }
  ]
}
```

## Text Element

```json
{
  "type": "text",
  "text": "Display text\nwith newlines",
  "fontSize": 16,
  "fontFamily": 1,
  "textAlign": "center",
  "verticalAlign": "middle",
  "containerId": "parent-rect-id",
  "originalText": "Display text\nwith newlines",
  "autoResize": true,
  "lineHeight": 1.25
}
```

- `fontFamily`: 1 = Virgil (hand-drawn), 2 = Helvetica, 3 = Cascadia Code
- `containerId`: links text to parent rectangle; null for freestanding text
- When bound (`containerId` set), position is relative to container

## Arrow Element

```json
{
  "type": "arrow",
  "points": [[0, 0], [200, 100]],
  "lastCommittedPoint": null,
  "startBinding": {
    "elementId": "source-rect-id",
    "focus": 0,
    "gap": 1
  },
  "endBinding": {
    "elementId": "target-rect-id",
    "focus": 0,
    "gap": 1
  },
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "roundness": { "type": 2 }
}
```

- `points`: array of [x, y] offsets relative to element's x, y
- `focus`: -1 to 1, controls where arrow meets the bound element edge
- `gap`: pixel gap between arrow tip and element edge
- `startArrowhead`: null, "arrow", "bar", "dot", "triangle"
- `endArrowhead`: same options (usually "arrow")

## Bound Elements Array

The `boundElements` array on a rectangle tells Excalidraw which elements are connected:

```json
"boundElements": [
  { "id": "text-123", "type": "text" },
  { "id": "arrow-456", "type": "arrow" }
]
```

This is bidirectional:
- Rectangle lists text/arrows in `boundElements`
- Text references rectangle via `containerId`
- Arrow references rectangle via `startBinding`/`endBinding`
