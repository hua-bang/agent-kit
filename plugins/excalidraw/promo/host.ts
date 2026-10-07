// Promo-only MCP Apps host: same official AppBridge as scripts/browser-host.ts, plus a theme switch.
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const iframe = document.querySelector('iframe')!;
const bridge = new AppBridge(null, { name: 'promo-host', version: '1' }, { serverTools: {} }, {
  hostContext: { theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline'], locale: (window as unknown as { locale?: string }).locale ?? 'zh-CN', containerDimensions: (window as unknown as { dims?: { width: number; height: number } }).dims ?? { width: 1152, height: 526 } },
});
const call = async (name: string, args = {}) => (await fetch('/tool', { method: 'POST', body: JSON.stringify({ name, arguments: args }) })).json();
bridge.oncalltool = params => call(params.name, params.arguments);
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: {} });
  await bridge.sendToolResult(await call('open_library'));
};
Object.assign(window, { setHostTheme: (theme: 'light' | 'dark') => bridge.sendHostContextChange({ theme }) });
await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
iframe.src = '/app?surface=library';
