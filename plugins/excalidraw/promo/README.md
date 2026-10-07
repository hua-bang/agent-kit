# Agentic Excalidraw 宣传素材

用真实插件录制中英文宣传片，并生成同一风格的官网。做法和规则见 [mcp-app-promo skill](../../../skills/mcp-app-promo/SKILL.md)；这里是本插件的具体素材。生成的截图、音频、视频和站点都写入 `promo/out/`（已被 Git 忽略），不提交。

## 文件

| 文件 | 作用 |
| --- | --- |
| `cases.mjs` / `cases-en.mjs` | 四个由浅到深的案例（PR 合并流程、财报三张表、论文拆解、《孙子兵法》），以 Excalidraw 元素数据分几次写入 |
| `host.ts` | 单卡测试宿主（官方 AppBridge），供 `gallery.mjs` 截图 |
| `host-chat.ts` | 对话演示宿主：每张卡片和侧边栏整页各自连一个官方 AppBridge |
| `gallery.mjs` | 通过插件工具写入四个案例，在真实编辑器中截图（3200×2000） |
| `record-en.mjs` / `record-zh.mjs` | 录制宣传片：对话出图、手绘后让 Agent 接着改、由浅到深的案例、侧边栏整页图纸库、深色与语言切换 |
| `lines-en.json` / `lines-zh.json` | 旁白原文，同时就是字幕 |
| `site/en.html` / `site/zh.html` | 官网页面源码（片段，由 `build_site.py` 包成完整 HTML） |
| `make.sh` | 一键生成全部产物 |

## 生成

```sh
cd plugins/excalidraw
npm ci && npm run build
TTS_PYTHON=/path/to/.venv-tts/bin/python KOKORO_DIR=/path/to/kokoro-model bash promo/make.sh
```

依赖与安装方式见 [skill README](../../../skills/mcp-app-promo/README.md)：ffmpeg、Playwright 用的 Chromium（可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定）、装有 kokoro-onnx 与 misaki[zh] 的 Python，以及 Kokoro 模型文件。脚本本身不下载、不安装、不部署；录制使用临时图纸目录，不读写 `~/.excalidraw-plugin/`。

产物：

- `promo/out/assets-en/promo.mp4`、`promo/out/assets-zh/promo.mp4`：带配音、字幕和配乐的宣传片。
- `promo/out/dist/`：静态站点，中文在 `/`，英文在 `/en/`，可直接部署到 Cloudflare Pages（步骤见 skill，需用户明确要求并使用其账号）。

## 内容说明

- 对话窗口是为视频制作的演示宿主，不是 ChatGPT、Claude 或 Codex，宿主界面和页面说明都已注明；对话内容为预先编写，图纸均为真实工具调用结果。
- 配音由 Kokoro 本地合成（英文 `af_heart`，中文 `zf_xiaoxiao`），配乐由 `music.py` 生成，页面中已说明。
- 财报案例的公司和数字为虚构；论文数字取自原文；《孙子兵法》分组是一种常见读法，英文版篇名与引文依 Lionel Giles 译本（1910，公有领域），中文版引句为原文。公开前请再核对引文与数字。
- 验证方式：`make.sh` 端到端运行一次，再看整片抽帧、卡片出现与放大处的逐帧画面、人声与配乐响度，以及页面在桌面和手机宽度下是否溢出。没有自动化断言。
