// Promo-only chat host: every drawing card is its own MCP App instance on the official AppBridge,
// mounted from the result of a real tool call, like an MCP Apps host renders a tool result inline.
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

type Theme = 'light' | 'dark';
const call = async (name: string, args: Record<string, unknown> = {}) =>
  (await fetch('/tool', { method: 'POST', body: JSON.stringify({ name, arguments: args }) })).json();
const bridges: AppBridge[] = [];
const locale = (window as unknown as { locale?: string }).locale ?? 'en-US';

/** Calls the tool, then shows its result in a new editor card inside `iframe`. Returns the drawing id. */
async function mountCard(iframe: HTMLIFrameElement, name: string, args: Record<string, unknown>, surface = 'drawing') {
  const result = await call(name, args);
  const rect = iframe.getBoundingClientRect();
  const bridge = new AppBridge(null, { name: 'demo-chat-host', version: '1' }, { serverTools: {} }, {
    hostContext: { theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline'], locale, containerDimensions: { width: Math.round(rect.width), height: Math.round(rect.height) } },
  });
  bridge.oncalltool = params => call(params.name, params.arguments);
  bridge.oninitialized = async () => {
    await bridge.sendToolInput({ arguments: args });
    await bridge.sendToolResult(result);
  };
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  iframe.src = `/app?surface=${surface}`;
  bridges.push(bridge);
  return result.structuredContent?.document?.plugin?.id as string;
}

/** The global entrypoint: the library opened from the host's sidebar, in a fixed-height panel. */
const mountSidebar = (iframe: HTMLIFrameElement) => mountCard(iframe, 'open_library', {}, 'library');

Object.assign(window, {
  mountCard,
  mountSidebar,
  setHostTheme: (theme: Theme) => Promise.all(bridges.map(b => b.sendHostContextChange({ theme }))),
});
