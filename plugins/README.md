# Plugins

完整插件放在 `plugins/<name>/`，保留原生结构，不拆散到根级 skills。

| 插件 | 状态 | 来源与许可 |
| --- | --- | --- |
| [excalidraw](excalidraw/README.md) | Agent Plugins 包 + 配套 skill；隔离 Codex 安装、stdio、sandbox 浏览器通过；桌面 UI 待验收 | [来源与发布限制](excalidraw/PROVENANCE.md)；独立实现，依赖/字体发布审计未完成 |
| [excalidraw-diagrams](excalidraw-diagrams/README.md) | 已收录用户提供的二创包，manifest 版本 1.1.0；客户端和 MCP 未验证 | [来源说明](excalidraw-diagrams/PROVENANCE.md)，上游许可尚未核实 |

今后收录仍应核实来源、版本和再分发依据，保留原许可证及署名。当前 Excalidraw 收录是用户明确要求的例外，不能视为其上游许可已确认，也不能推广为默认收录规则。
