import { useEffect, useRef, useState } from 'react';
import { applyDocumentTheme, type McpUiHostContext, type McpUiTheme } from '@modelcontextprotocol/ext-apps';
import { bridge } from './bridge';
import { pickLocale, type Locale } from '../ui/i18n';

type Handlers = {
  toolResult(structuredContent: Record<string, unknown>): void;
  hostContextChanged(context: McpUiHostContext): void;
  connected(): void;
  failed(message: string): void;
};

/**
 * Connect to the MCP Apps host once, and follow its theme, locale and container size.
 * Handlers are read through a ref, so callers may pass fresh closures on every render.
 */
export function useHost(handlers: Handlers) {
  const on = useRef(handlers); on.current = handlers;
  const [connected, setConnected] = useState(false);
  const [hostLocale, setHostLocale] = useState<Locale>(() => pickLocale());
  const [theme, setTheme] = useState<McpUiTheme>(() => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffect(() => applyDocumentTheme(theme), [theme]);
  useEffect(() => {
    let mounted = true;
    bridge.ontoolresult = result => { if (!result.isError && result.structuredContent) on.current.toolResult(result.structuredContent); };
    bridge.onhostcontextchanged = context => {
      if (context.theme) setTheme(context.theme);
      if (context.locale) setHostLocale(pickLocale(context.locale));
      if (context.containerDimensions || context.displayMode) applyFill();
      on.current.hostContextChanged(context);
    };
    bridge.connect().then(() => {
      if (!mounted) return;
      const hostTheme = bridge.getHostContext()?.theme;
      if (hostTheme) setTheme(hostTheme);
      setHostLocale(pickLocale(bridge.getHostContext()?.locale));
      applyFill();
      setConnected(true);
      on.current.connected();
      // Host probe (EXCALIDRAW_DEBUG_LOG): record the full host context in the server's log.
      if (document.querySelector('meta[name="excalidraw-debug"]')) {
        const surface = document.querySelector('meta[name="excalidraw-surface"]')?.getAttribute('content') ?? 'drawing';
        void bridge.callServerTool({ name: 'debug_host_context', arguments: { surface, hostContext: bridge.getHostContext() ?? null } }).catch(() => {});
      }
    }).catch(e => on.current.failed(e.message));
    return () => { mounted = false; };
  }, []);
  return { connected, theme, hostLocale };
}

/** A host-fixed height (sidebar, fullscreen) means the editor should fit it, not grow past it. */
function applyFill() {
  const context = bridge.getHostContext();
  const fixed = !!context?.containerDimensions && 'height' in context.containerDimensions || context?.displayMode === 'fullscreen';
  document.documentElement.toggleAttribute('data-fill', fixed);
}
