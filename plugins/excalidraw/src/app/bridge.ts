import { App } from '@modelcontextprotocol/ext-apps';
import { messagesFor, pickLocale } from './i18n';
export const bridge = new App({ name: 'Agentic Excalidraw', version: '0.1.0' }, {});
export async function callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const t = messagesFor(pickLocale(bridge.getHostContext()?.locale));
  const result = await bridge.callServerTool({ name, arguments: args });
  if (result.isError) throw new Error(result.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') || t.toolFailed);
  if (!result.structuredContent) throw new Error(t.noStructuredData);
  return result.structuredContent as T;
}
