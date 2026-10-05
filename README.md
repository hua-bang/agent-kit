# agent-kit

A personal toolkit of agent skills, plugins, and workflows.

收录可复用的 Agent 工具。每项工具自包含，根目录只负责导航；按内容类型组织，不按使用平台拆分。

## 内容

| 类型 | 工具 | 状态 | 用途 |
| --- | --- | --- | --- |
| Skill | [init-harness](skills/init-harness/SKILL.md) | 首版，待真实项目试用 | 复用项目已有规则与检查入口，建立最小可用的开发、验证和交付闭环 |
| Plugin | [Local Excalidraw MCP App](plugins/excalidraw/README.md) | Agent Plugins 包；预构建版发布在 `release` 分支（`codex plugin marketplace add hua-bang/agent-kit --ref release`），桌面 UI 待验收 | 本地持久化图纸，用户与 Agent 共同编辑 |
| Plugin | [Excalidraw diagrams](plugins/excalidraw-diagrams/README.md) | 已收录二创包，客户端/MCP 待验证 | 生成、展示和导出架构图；上游许可尚未核实 |

## 目录

```text
agent-kit/
├── AGENTS.md
├── README.md
├── skills/
│   └── init-harness/
│       └── SKILL.md
└── plugins/
    ├── README.md
    ├── excalidraw/
    └── excalidraw-diagrams/
```

- `skills/<name>/SKILL.md` 是独立技能入口。有实际内容时再添加 `references/`、`scripts/` 或 `assets/`。
- `plugins/<name>/` 保留插件自身的结构、来源说明和许可证。插件内的 skill 不再复制到根级 `skills/`。
- 平台专属适配留在相应工具内；暂不提供统一安装器。

## 使用

```bash
git clone https://github.com/hua-bang/agent-kit.git
```

### Skills

先阅读目标 skill 的 `SKILL.md`。如果客户端支持 Agent Skills，按该客户端的发现规则，将整个 skill 目录复制或链接到其技能目录，并刷新或重启客户端。不要只复制 `SKILL.md`，否则后续附带的脚本和资料会丢失。

未支持技能自动发现的客户端，可以将 `SKILL.md` 作为任务说明交给 Agent。具体安装目录与激活方式取决于客户端；本仓库尚未验证各客户端兼容性。

`init-harness` 用于初始化目标项目，不是自动执行脚本。首版不依赖额外运行时；它会要求 Agent 识别目标项目的原生工具链与执行风险。

### Plugins

按插件自己的 README 使用，见 [收录状态](plugins/README.md)。Excalidraw 已收录用户提供的二创包；客户端安装及远端 MCP 尚未验证。

## 修改与验证

仓库规则见 [AGENTS.md](AGENTS.md)。当前以 Markdown 文档为主，没有统一构建、测试入口或 CI。

提交前至少执行：

```bash
git diff --check
```

同时检查相对链接、skill frontmatter、文档中的命令及隐私信息。结构检查不代表 skill 已在真实项目中验证，也不代表插件能连接远端服务。

## 来源与许可

第三方工具原则上应先明确来源和再分发许可，并保留原许可证及署名。Excalidraw 按用户明确要求先收录二创包，其上游许可尚未核实，详见 [来源与许可状态](plugins/excalidraw-diagrams/PROVENANCE.md)。当前未选择仓库级开源许可证；公开可见不等于授予再分发许可，也不能替代未来收录工具各自的许可证。
