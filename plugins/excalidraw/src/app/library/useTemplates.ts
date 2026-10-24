import { useCallback, useEffect, useState } from 'react';
import { callTool } from '../host/bridge';
import type { TemplateSummary } from '../../shared/schemas';

/** The user's own templates, shared by the library and the editor. Loaded once connected, then on demand. */
export function useTemplates(connected: boolean) {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const refresh = useCallback(async () => {
    try { setTemplates((await callTool<{ templates: TemplateSummary[] }>('list_templates')).templates); }
    catch { /* Presets still work; the list stays as it was. */ }
  }, []);
  useEffect(() => { if (connected) void refresh(); }, [connected, refresh]);
  return { templates, refresh };
}
