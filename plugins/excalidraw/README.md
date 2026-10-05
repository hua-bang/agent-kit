# Local Excalidraw MCP App

本地优先的 Excalidraw 插件开发版：Node.js stdio MCP Server + React Excalidraw 编辑器 + 官方 MCP Apps bridge。
不依赖原有 `excalidraw-diagrams` 的代码或远端服务。不需要数据库、常驻 HTTP 服务或全栈框架。

## 当前状态

已实现并通过本地测试：固定 ID 的对话图纸预览/展开编辑/返回，独立图纸库入口、真实缩略图/搜索/新建/复制，手动绘图、自动保存、重新打开、Agent 增量修改、修订冲突保护、五版备份、嵌入图片存储。视觉与交互约束见 [DESIGN.md](DESIGN.md)。

实际浏览器测试通过官方 MCP Apps AppBridge 连接真实 stdio Server，运行真实 Excalidraw SDK，并用鼠标绘制图形；这**不等于已通过 ChatGPT、Claude 或其他生产宿主的安装与兼容性验收**。
Sidebar 扩展元数据是关闭的实验功能，尚未通过真实 OpenAI 宿主验证。

## Agent Plugins 包与 Codex 本地安装

本目录是 Agent Plugins v1.0.0 源码包，与相邻 `excalidraw-diagrams` 使用相同的可移植布局：

```text
excalidraw/
├── plugin.json                 # 插件身份、版本
├── mcp.json                    # local-excalidraw stdio，使用 ${PLUGIN_ROOT}
├── skills/excalidraw/SKILL.md   # 随插件安装的 Agent 工作流
├── scripts/start.mjs           # 与宿主 cwd 无关；缺少构建时明确失败
├── package.json / package-lock.json
└── dist/                       # 本地构建后生成，不提交
```

仓库的 [本地 marketplace](../../.agents/plugins/marketplace.json) 提供 `excalidraw@agent-kit-local`，不自动启用插件，不修改用户配置。根 `skills/` 和 `mcp.json` 由支持规范的宿主发现；不需要把 skill 再安装一份。

### 在 Codex 安装整包（不是只注册 MCP）

从仓库根目录执行；当前源码尚未推送，测试应使用本地工作树，不要从远端 master 安装旧版本。

```sh
# 首次准备；npm ci 会联网下载依赖并运行安装脚本
cd plugins/excalidraw
npm ci
npm run build
npm run test:plugin
cd ../..

# 以下两条会修改当前用户的 Codex marketplace / plugin 配置
codex plugin marketplace add "$PWD"
codex plugin add excalidraw@agent-kit-local
```

先构建再安装：本地 Codex 会把插件复制进缓存。只安装未构建的源码不能启动服务；启动脚本不会偷偷执行 npm install。Node 必须在宿主 PATH 中可用，建议 Node 24。

安装后重启桌面端或开启新会话，发送：

> 使用 excalidraw 插件及其配套 skill，打开本地图纸库。使用 local-excalidraw，不要使用 excalidraw-diagrams。

然后创建“接入测试”，手动拖动图形并等待已保存，再让 Agent 读取最新图纸并添加一个节点，最后重开检查。默认数据在 `~/.excalidraw-plugin/`；如需隔离，启动 Codex 的进程环境应设置 `EXCALIDRAW_PLUGIN_DIR`，桌面启动器不一定继承终端环境。

如果之前手动添加过同名 MCP，请先检查配置，避免插件与手动注册重复；明确不再使用手动连接时执行 `codex mcp remove local-excalidraw`，这不删除图纸。

更新源码后需要重新构建并刷新已安装插件缓存，不要只修改源码便假定缓存已更新。可使用 `codex plugin remove excalidraw@agent-kit-local` 后重新 `codex plugin add excalidraw@agent-kit-local`；移除插件不删除外部图纸目录。

已在临时 `CODEX_HOME` 实测 marketplace 注册和 `codex plugin add`，并从安装缓存验证 skill、stdio 工具读写和 UI 资源。**尚未验证真实桌面对话的 skill 自动触发和画板渲染**，也未修改用户的正式 Codex 配置。CLI 不能显示交互画板。

参考：[Agent Plugins 参考包](../excalidraw-diagrams/README.md)、[OpenAI 插件打包文档](https://developers.openai.com/plugins/build/plugins)。本地开发安装不等于获得公开发布许可，仍受本文末尾发布限制约束。

## 安装与构建

需要 Node.js 22.12+（建议 Node 24 LTS）与 npm。只在本插件目录安装依赖，不改变仓库根目录依赖。

```sh
cd plugins/excalidraw
npm ci
npm run typecheck
npm test
npm run build
npm run test:stdio
```

`npm ci` 会联网下载依赖并可能运行依赖安装脚本。`build` 写入被 Git 忽略的 `dist/`，不访问用户图纸目录。
`npm start` 启动 stdio 服务，不是网页服务器；不要在 shell 中等待网页地址，也不要把日志输出写到 stdout。

在支持本地 stdio 的 MCP 宿主中配置以下内容，将路径替换成你的实际绝对路径：

```json
{
  "mcpServers": {
    "local-excalidraw": {
      "command": "node",
      "args": ["/absolute/path/to/agent-kit/plugins/excalidraw/dist/server/index.js"]
    }
  }
}
```

此配置是常见的 MCP JSON 格式，不是跨平台一键安装清单；具体配置位置、Node 可执行路径和 MCP Apps 支持由宿主决定。没有 MCP Apps 支持时仍可调用文本工具，但没有嵌入编辑器。
没有修改本机正式宿主配置（仅在临时 CODEX_HOME 验证插件安装），也未发布 npm 包。随包 Skill 见 [使用指引](skills/excalidraw/SKILL.md)。

## 使用

- `open_library`：独立图纸库资源，面向 Sidebar，支持缩略图、搜索、新建、复制与进入详情。宿主不支持 Sidebar 时，显式调用此工具可能把图纸库放在对话中；插件不能强制宿主布局。
- `create_drawing`：创建一张图，打开固定 ID 的预览。
- `open_drawing`：在对话内展示指定图纸预览，点击「展开编辑」进入真实编辑器，保存后返回同一张图。卡片中没有图纸列表或切换图纸入口。
- `list_drawings` / `read_drawing`：只读取，不打开 UI。
- `patch_drawing`：按稳定元素 ID 增量 upsert/remove，保留未修改元素与图片。
- `save_drawing`：保存完整场景，必须携带最新 `expectedRevision`。

图纸身份是永久 UUID，不是会话 ID 或 MCP 连接 ID。卡片绑定首次收到的图纸 ID，忽略其他图纸结果与旧修订；同 ID 默认展示最新内容。未建立宿主会话数据库，Agent 通过上下文显式传递 ID。图纸库编辑器左上角菜单（☰）里的「复制为新图」生成独立 UUID，原图与旧卡片不改变。

仅浏览预览不创建修订。展开编辑后，界面约每 1.2 秒保存脏场景；无未保存改动时每 5 秒检查远端修订。
编辑器页头只保留返回、标题和保存状态；有未保存修改或自动保存暂停时才出现“保存”按钮。冲突或错误会暂停自动保存，保留编辑器草稿，用户可以从菜单导出草稿或明确放弃后重新载入。不会静默覆盖。
编辑器菜单（☰）里的“导出”下载标准 `.excalidraw` 文件，需要宿主允许 iframe 下载。关闭宿主可能不触发浏览器退出提示，请先确认“已保存”。

## 本地存储

```text
~/.excalidraw-plugin/
├── drawings/<uuid>.excalidraw
└── backups/<uuid>/<revision>.excalidraw
```

- 标准 Excalidraw 场景字段，额外 `plugin` 字段保存 ID、名称、修订号和时间。
- 原子替换 + 文件 fsync + `proper-lockfile` 跨进程写锁；按图保留最近五个旧版本。
- 图纸列表扫描文件生成，不维护另一份索引数据库。
- 文件名只接受 UUID；拒绝图纸文件和数据子目录的符号链接。不视作抵御同一 OS 用户恶意更换父目录的安全沙箱。
- 可用 `EXCALIDRAW_PLUGIN_DIR` 指定独立目录，测试始终使用临时目录并清理。
- 最大单图 4 MiB，避免大型图片越过常见 stdio 消息限制；图片暂支持 PNG/JPEG/WebP/GIF。SVG、外部嵌入、直接导入任意文件及备份恢复 UI 未实现。
- 没有多用户协同协议；后台同步采用轮询，并发写入采用乐观修订检查。

## 构建与轻量边界

一个独立 TypeScript 包；React 18.3 + Excalidraw 0.18.1、MCP SDK 1.32 + MCP Apps 1.7.5、Vite、普通 CSS。使用 MCP Apps v1 与 MCP SDK v1 配对，未混入 SDK v2。

真实编辑器本身有体积成本：自包含 HTML 约 5.56 MB（本次 UI 改造后；准确字节数以构建输出为准），相比原始 9.01 MB 减少约 38.4%。JS/CSS 和常用字体在本地构建时内联，不从 CDN 加载。Xiaolai 字体约 12 MiB，未打包：其占位使用 Liberation 拉丁字形，中文回退系统字体，不保证跨 OS 字形完全一致。字体原包没有被修改，转换仅发生在构建产物中。

Mermaid 转换库及其 Mermaid/Cytoscape/KaTeX 依赖图不进入 UI 构建；粘贴 Mermaid 源码会保留为可编辑文本，不转换为图形。Agent 仍直接生成或修改 Excalidraw 元素。保留全部现有语言包与字体子集化能力。

实现采用构建别名及文本兼容适配器，不是抛错占位。SDK 的 `aiEnabled=false` 不会隐藏全部 Mermaid 入口，因此对锁定的 0.18.1 做受断言保护的菜单构建转换；升级 SDK 时必须重新验证。构建检查禁止转换依赖回流，并限制最终原始 HTML 不超过 5.70 MB。此优化不移除 npm 锁文件中的上游传递依赖，也不代表安装体积或安全审计条目已减少。

`npm run dev` 仅提供 UI 开发服务器；普通浏览器直接打开不能获得 MCP bridge 或本地持久化。完整运行请使用 MCP Apps 宿主或下面的浏览器测试。

## 验证

```sh
npm run typecheck
npm test
npm run build
npm run test:stdio
npm run test:plugin
# 首次需下载 Chromium，或通过环境变量使用已有浏览器：
npx playwright install chromium
npm run test:browser
# 可选：PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chromium npm run test:browser
```

- 单元测试：14 项，包含 Mermaid 粘贴文本保留、开发/生产 SDK 菜单移除与上游变更保护，以及原有 8 项存储测试，覆盖文件持久化、图片、旧修订拒绝、多个 store 实例并发写入、备份保留、路径/符号链接/体积防护、坏文件隔离和场景校验。
- stdio：真实启动子进程，验证 handshake、工具、UI 资源、保存冲突、进程重启后读回及 Agent 更新保留用户坐标。
- 浏览器：仅绑定 `127.0.0.1` 随机端口的测试宿主，官方 AppBridge + sandbox iframe + 禁止远程网络的 CSP；鼠标绘图、落盘、Mermaid 入口移除、Mermaid/普通文本粘贴保存、Agent 修改、重新打开、375px 溢出检查；新增固定 ID/无串图、预览只读、返回前保存、缩略图/搜索/独立副本、同 ID 更新、冲突后保留草稿/导出及长标题检查。结束后关闭服务、清理临时图纸。
- 截图写入 `.test-output/`，不提交。测试不使用 `~/.excalidraw-plugin/`。

## Sidebar（实验）

在服务进程设置 `EXCALIDRAW_ENABLE_SIDEBAR=1`，会为 `open_library` 加入 `openai/ui.entrypoints: [{type: "global"}]` 元数据。
该入口使用 `ui://excalidraw/library.html`，先进入图纸列表，再进入详情。对话图纸使用 `ui://excalidraw/editor.html`，先预览再编辑。两者共用真实数据与构建包。默认关闭 Sidebar 元数据，不影响对话图纸 App。
参考 [OpenAI Extensions](https://developers.openai.com/plugins/build/extensions)。尚未验证目标宿主是否接收该元数据或支持本机 stdio。

## 安全与发布限制

此版本用于本地开发验收，**尚不建议公开分发构建包**。

- `npm audit` 当前仍有 6 个 high 条目，均属于 `braces` 经 `micromatch` / `chokidar` / `sass` / `vite-plugin-singlefile` 传播的依赖链（包含 Excalidraw 汇总条目），不是六种独立漏洞。未通过强制降级编辑器规避报告。需要后续替换构建链/核实上游修复后再发布。
- 已通过 overrides 修复锁定依赖中的 lodash-es 和 nanoid 报告，升级后重新跑构建与集成测试。
- 首版不执行链接、不加载远程嵌入；但本地存储不等于离线推理，AI 宿主可以把工具返回内容发送给模型服务。
- 第三方代码/字体许可汇总尚未完成，见 [来源说明](PROVENANCE.md)。仓库自身尚未选择开源许可证。
