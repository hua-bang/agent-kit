# Element Catalog — Node Type Templates

## Component (Rounded Rectangle)

Default node type for general services, apps, and components.

- Shape: rectangle with `roundness: { type: 3 }`
- Fill: solid background color
- Stroke: 2px solid

## Database

For databases, data stores, caches.

- Same shape as component (rectangle)
- Color: orange by default
- Label convention: `"PostgreSQL\n(Database)"` or `"Redis\n(Cache)"`

## Queue

For message queues, event buses, streaming.

- Same shape as component
- Color: yellow by default
- Label convention: `"Kafka\n(Events)"` or `"SQS\n(Queue)"`

## User

For users, actors, external clients.

- Same shape as component
- Color: gray by default
- Label convention: `"User"` or `"Mobile App\n(Client)"`

## Cloud

For cloud services, external APIs, SaaS.

- Same shape as component
- Color: purple by default
- Label convention: `"AWS S3\n(Storage)"` or `"Stripe\n(Payments)"`

## Group Box

For visually grouping related nodes.

- Shape: rectangle with `strokeStyle: "dashed"`, low opacity
- Background: `#f8f9fa` (very light gray)
- Stroke: `#495057` (gray)
- Label positioned top-left inside the box

---

# Color Palette Reference

| IR Color | Background | Stroke   | Hex Pair                | Typical Use          |
|----------|-----------|----------|-------------------------|----------------------|
| blue     | #a5d8ff   | #1971c2  | Light blue / Dark blue  | Frontend, UI         |
| green    | #b2f2bb   | #2f9e44  | Light green / Dark green| APIs, Services       |
| orange   | #ffd8a8   | #e8590c  | Light orange / Dark orange| Databases, Storage |
| red      | #ffc9c9   | #e03131  | Light red / Dark red    | Auth, Security       |
| purple   | #d0bfff   | #7048e8  | Light purple / Dark purple| Infrastructure     |
| yellow   | #ffec99   | #f08c00  | Light yellow / Dark yellow| Queues, Events     |
| gray     | #dee2e6   | #495057  | Light gray / Dark gray  | External, 3rd party  |

## Usage Guidelines

- Match colors to semantic roles, not aesthetics
- Use consistent colors for the same type of component across diagrams
- Groups use dashed borders with low opacity to avoid visual clutter
- Edge labels use black (#1e1e1e) for readability
- Background is always white (#ffffff)

## Multi-line Labels

Use `\n` in label strings for multi-line text:

```
"API Gateway\n(Express.js)"   →  API Gateway
                                  (Express.js)

"PostgreSQL\n(Primary)"       →  PostgreSQL
                                  (Primary)
```

Text sizing formula:
- Width: `min(max(longestLineChars * 10, 120), 280)`
- Height: `40 + lineCount * 24`
- Node padding: 40px width, 20px height added to text dimensions
