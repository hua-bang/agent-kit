import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const iframe = document.querySelector('iframe')!;
const id = new URLSearchParams(location.search).get('drawing');
const bridge = new AppBridge(null, { name: 'local-test-host', version: '1' }, { serverTools: {} }, {
  hostContext: { theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline'], locale: 'zh-CN' },
});
const call = async (name: string, args = {}) => (await fetch('/tool', { method: 'POST', body: JSON.stringify({ name, arguments: args }) })).json();
bridge.oncalltool = params => call(params.name, params.arguments);
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: id ? { id } : {} });
  await bridge.sendToolResult(await call(id ? 'open_drawing' : 'open_library', id ? { id } : {}));
};
// Test-only injection of host notifications to verify card identity isolation.
Object.assign(window, { deliverResult: (result: Parameters<typeof bridge.sendToolResult>[0]) => bridge.sendToolResult(result) });
await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
iframe.src = id ? '/app?surface=drawing' : '/app?surface=library';
