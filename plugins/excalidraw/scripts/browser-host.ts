import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const iframe = document.querySelector('iframe')!;
const params = new URLSearchParams(location.search);
const id = params.get('drawing');
const bridge = new AppBridge(null, { name: 'local-test-host', version: '1' }, { serverTools: {}, updateModelContext: { text: {} } }, {
  hostContext: { theme: 'light', displayMode: 'inline', availableDisplayModes: ['inline'], locale: params.get('locale') ?? 'zh-CN' },
});
const call = async (name: string, args = {}) => (await fetch('/tool', { method: 'POST', body: JSON.stringify({ name, arguments: args }) })).json();
bridge.oncalltool = params => call(params.name, params.arguments);
// Record what the view reports to the model, so the smoke test can assert on it.
bridge.onupdatemodelcontext = async params => { Object.assign(window, { modelContext: params }); return {}; };
// What an OpenAI host sends when the user removes the context attachment.
Object.assign(window, { removeModelContext: () => bridge.sendHostContextChange({ 'openai/modelContext': null } as never) });
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: id ? { id } : {} });
  await bridge.sendToolResult(await call(id ? 'open_drawing' : 'open_library', id ? { id } : {}));
};
// Test-only injection of host notifications to verify card identity isolation.
Object.assign(window, { deliverResult: (result: Parameters<typeof bridge.sendToolResult>[0]) => bridge.sendToolResult(result) });
await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
iframe.src = id ? '/app?surface=drawing' : '/app?surface=library';
