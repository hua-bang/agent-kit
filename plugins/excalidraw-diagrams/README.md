# excalidraw-diagrams

An [Agent Plugins](https://agent-plugins.org) v1.0.0 package that turns
natural-language descriptions into Excalidraw architecture diagrams.

```
excalidraw-diagrams/
├── plugin.json                       # portable manifest (required)
├── mcp.json                          # Excalidraw MCP server (inline rendering)
├── skills/
│   └── excalidraw/                   # portable Agent Skill
│       ├── SKILL.md
│       ├── scripts/                  # generate.mjs (IR → .excalidraw), export.mjs (→ SVG/PNG)
│       └── references/
└── com.anthropic.claude-code/
    └── commands/draw.md              # client-specific /draw command (not portable)
```

## Components

| Component | Portable? | What it does |
|---|---|---|
| `skills/excalidraw` | Yes | **Renders inline via the Excalidraw MCP server by default**; falls back to the bundled scripts (IR JSON → dagre layout → `.excalidraw` / `.svg` / `.png`) when MCP isn't available or the user asks for files. |
| `mcp.json` → `excalidraw` | Yes | Remote Streamable HTTP MCP server that renders hand-drawn diagrams inline in the chat. Authorization, if any, is handled by the client. |
| `com.anthropic.claude-code/commands/draw.md` | No | The original `/draw` slash command. Slash commands are not a v1 component type, so it lives in a client extension directory; clients that don't implement that namespace ignore it. |

## Requirements

- Recommended: a client that supports Streamable HTTP MCP servers, so the default inline path works.
- For the script fallback: Node.js 18+ and npm. On first use the skill runs `npm install` inside
  `skills/excalidraw/scripts` (`@dagrejs/dagre`, `sharp`).

## Validate

```bash
go install github.com/rchaganti/agent-plugin-validator@latest
apv validate ./excalidraw-diagrams
```

## Changes from the original Claude Code plugin

- Manifest moved to root `plugin.json` with the v1.0.0 `$schema`.
- `SKILL.md` no longer uses `${CLAUDE_PLUGIN_ROOT}`; script paths are relative to
  the skill directory so any Agent Skills client can run them. Added
  `compatibility` frontmatter.
- Added `mcp.json` for the Excalidraw MCP server; the skill uses it first (1.1.0).
- `/draw` kept as a Claude Code–only extension.

## 本仓库收录说明

这是用户提供的非官方二创包；来源、修改范围与尚未核实的许可见 [PROVENANCE.md](PROVENANCE.md)。注明来源不表示已获得上游再分发许可。

### 使用与副作用

- 支持相应 Agent Plugins 规范的客户端可按其导入方式加载整个目录；各客户端安装兼容性尚未验证。
- 仅使用 skill 时，加载 `skills/excalidraw/` 全目录；MCP 配置需在客户端单独配置，不能假定会自动发现。
- MCP 模式访问 `https://mcp.excalidraw.com/mcp`，会向远端发送绘图内容；不要发送凭据或私有运维资料。
- 离线脚本需 Node.js 18+；在 `skills/excalidraw/scripts` 执行 `npm ci` 会下载依赖并写入 `node_modules`。依赖包含原生组件 `sharp`，安装前确认网络及生命周期脚本权限。
- `generate.mjs` 写入指定 `.excalidraw` 文件；`export.mjs` 写入 SVG 并尝试写入 PNG。指定独立输出目录，避免覆盖已有文件；仅处理可信输入。
- PNG 失败时导出脚本仍可能成功退出，验收 PNG 必须另外确认文件存在且可读。SVG 是简化渲染，不等同于官方手绘渲染器。

### 本地结构检查（无依赖安装、无远端 MCP 调用）

从插件目录执行：

```bash
node --check skills/excalidraw/scripts/generate.mjs
node --check skills/excalidraw/scripts/export.mjs
node -e "for (const p of ['plugin.json', 'mcp.json', 'skills/excalidraw/scripts/package.json', 'skills/excalidraw/scripts/package-lock.json']) JSON.parse(require('node:fs').readFileSync(p, 'utf8'))"
```

上述检查只覆盖语法与 JSON 可解析性。完整离线验证需安装依赖，以可信 IR 生成文件后检查 SVG 与 PNG；MCP 连接和客户端安装需分别验证。`apv` 校验会额外下载 Go 工具，不属于上述无依赖检查。
