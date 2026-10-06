import { App } from '@modelcontextprotocol/ext-apps';
export const bridge = new App({ name: 'Agentic Excalidraw', version: '0.1.0' }, {});
export async function callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await bridge.callServerTool({ name, arguments: args });
  if (result.isError) throw new Error(result.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') || '工具调用失败');
  if (!result.structuredContent) throw new Error('工具没有返回结构化数据');
  return result.structuredContent as T;
}
