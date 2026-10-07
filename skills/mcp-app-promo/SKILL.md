---
name: mcp-app-promo
description: Make a narrated promo video and a simple landing page for an MCP Apps plugin from real recordings of the plugin, then prepare the page for a static host such as Cloudflare Pages. Use when asked for a demo video, product video, launch video, promo, landing page, product site or cover image for an MCP App or agent plugin, or to publish such a page to Cloudflare Pages.
---

# MCP App promo: video and landing page

Produce three things for an MCP Apps plugin, every frame taken from the real plugin:

1. A narrated video (about 60–100 s) with verbatim subtitles and a music bed.
2. A cover image and a short landing page in the same style.
3. A static `dist/` folder that any static host can serve, ready for Cloudflare Pages.

A complete, working example lives in [`plugins/excalidraw/promo/`](../../plugins/excalidraw/promo/README.md). Start from it.

## Permissions and side effects

Ask before anything outside the "read" and "write output" rows, and say what it will do.

| Step | Effect | Default |
| --- | --- | --- |
| Read the plugin's README, tests and status notes | Read only | Do it |
| Build the plugin, run its tests, record, synthesize audio | Writes only to a git-ignored output folder | Do it once the user asked for a promo |
| Install the TTS packages (`kokoro-onnx`, `misaki[zh]`) and download the Kokoro model (~340 MB) | Network, disk; use a separate virtualenv, never the global Python | Ask first |
| Commit scripts, page sources or narration text | Changes the repository | Only when the user asks; never commit generated media |
| Deploy to Cloudflare Pages | Publishes to the public internet under the user's account | Only on an explicit request, with the user's own credentials |

## What the video should show

Learned from several rounds of review. Follow these unless the user says otherwise.

- **Start from the conversation.** The user asks in plain words, the agent replies, and the app appears in the chat as an editable card. Show the tool name the agent used under its reply.
- **Simple to deep.** One simple example the viewer instantly recognizes, then progressively richer ones (for a diagram app: a flow, a financial report, a research paper, a whole book). Do not open with a contrived or dull example.
- **Two-way editing.** Show the user drawing in the card, then the agent building on it, with the user's work left where it was.
- **The global entrypoint is a full page.** If the plugin declares a sidebar (global) entrypoint, show its icon in the host's sidebar; clicking it turns the whole main area into the app's list page, and opening an item edits it full page. It is not a narrow side panel.
- **Label the stage honestly.** The chat window is a demo host made for the video, not ChatGPT, Claude or Codex. Say so in the host itself and in the page's caption. Never imitate a real product's branding.
- **No dead air, no jumps.** Time the agent's writes so they appear promptly; zoom with many small, evenly spaced steps; check that new cards do not flash an unfitted frame.

## Narration and subtitles

- One subtitle per narrated line, **word for word**, in a dark band below the app so it never covers the UI.
- A line starts **after** the change it describes is on screen, or **with** an action it describes in the present tense ("Draw on it yourself."). Never narrate something that has not appeared yet.
- Title and end cards carry their own text, so they get voice without a subtitle.
- 10–15 short lines are enough; leave the rest to music and on-screen chat text.
- Disclose that the voice is synthetic and the music was generated.

## Recording recipe

- Run the plugin's real server (stdio) and give every card its own official MCP Apps `AppBridge` in a local host page. Mount each card from the result of a real tool call.
- The agent's edits go through the plugin's own tools (read, then patch with the latest revision). Before the agent reads, wait until the user's last stroke has autosaved, or the revision check correctly refuses the stale write and the take is ruined.
- Record with Playwright `recordVideo` at 1280×720. Draw a fake cursor in the host page (headless video has none) and move it with eased steps.
- Log the time each narration line starts (`cues.json`) and make each scene last at least as long as its clip; the mix places clips by those cues.
- Showcase drawings: write them as data (complete elements with stable IDs) in a few passes; size containers so text never clips; double-check facts, quotes and numbers, and mark made-up data as made up.

## Verify before showing anyone

- Contact sheet of the whole video (`ffmpeg -vf "fps=1/4,scale=400:-1,tile=4x6"`) for story and captions.
- Full-frame-rate strips around card entrances and zooms for jumps.
- `volumedetect` on a music-only and a voiced stretch: the voice should sit clearly above the bed (about −21 dB voiced vs −26 dB music only) and nothing should clip.
- The landing page at desktop and phone widths with no horizontal scroll.

## Cover and landing page style

The style the user chose ("design A"): warm paper (`#fdfcf8`), near-black heavy type (Bricolage Grotesque, plus Noto Sans SC for Chinese), one highlighter-yellow accent (`#ffd43b`) under a key phrase, and a real drawing from the app, slightly rotated, with a soft shadow. Avoid gradients and extra accent colors.

Keep the page short: hero (same layout as the cover), video, the simple-to-deep examples with one line each, three steps, install commands with copy buttons, and a one-line status in the footer that states what is and is not verified.

## Scripts

All take `--help`-style flags; see each file's docstring.

- [`scripts/tts.py`](scripts/tts.py): narration with Kokoro, English or Chinese (Chinese text goes through `misaki` G2P; Latin words such as product names are phonemized as English).
- [`scripts/music.py`](scripts/music.py): an original, quiet music bed of any length.
- [`scripts/mix.py`](scripts/mix.py): video + narration cues + music, ducked and limited, to MP4.
- [`scripts/build_site.py`](scripts/build_site.py): wraps a page fragment into a full HTML document and copies its media into a deployable folder.

## Publish to Cloudflare Pages

Only when the user explicitly asks. Prerequisites: a Cloudflare account, and either `npx wrangler login` on their machine or `CLOUDFLARE_API_TOKEN` (Pages edit permission) and `CLOUDFLARE_ACCOUNT_ID` in the environment. Never ask for the token in chat or write it to a file.

```sh
npx wrangler pages project create <project-name> --production-branch main   # once
npx wrangler pages deploy <output>/dist --project-name <project-name>
```

Pages serves `dist/index.html` at `/` and subfolders as paths (`dist/en/` at `/en/`). Each file must stay under 25 MiB; an H.264 video of about a minute and a half is typically 5–7 MB. Report the deployment URL that wrangler prints, and remind the user that the site is public.
