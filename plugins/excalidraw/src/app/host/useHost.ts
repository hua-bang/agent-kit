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

/** Shortest fixed height that still holds the inline card at its own size (header + editor). */
const INLINE_CARD_HEIGHT = 660;

/**
 * A host-fixed height (sidebar, fullscreen) means the editor should fit it, not grow past it.
 * An inline drawing card keeps its own height instead: the host sizes the frame from what the
 * card reports, so a tall frame never stretches the editor.
 */
function applyFill() {
  const context = bridge.getHostContext();
  const dimensions = context?.containerDimensions;
  const height = dimensions && 'height' in dimensions ? dimensions.height : undefined;
  const surface = document.querySelector('meta[name="excalidraw-surface"]')?.getAttribute('content') ?? 'drawing';
  const inlineCard = surface === 'drawing' && context?.displayMode !== 'fullscreen';
  const fill = context?.displayMode === 'fullscreen' || height !== undefined && (!inlineCard || height < INLINE_CARD_HEIGHT);
  document.documentElement.toggleAttribute('data-fill', fill);
  document.documentElement.toggleAttribute('data-inline', inlineCard && !fill);
}
