import { useState, useCallback } from 'react';

/** A saved Template Builder template (picker list item from Director). */
export interface SavedTemplate {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  usage_count?: number;
  slide_count?: number;
}

export interface TemplatesResponse {
  templates: SavedTemplate[];
  count: number;
}

export interface SaveTemplateResult {
  id: string;
  name: string;
  slide_count: number;
  created_at?: string | null;
}

/**
 * Template Builder client hook (mirrors use-chat-sessions). Talks to the
 * /api/templates Next.js proxy, which forwards to Director CRUD. See
 * TEMPLATE_PLAN.md §5 (C2).
 */
export function useTemplates() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const listTemplates = useCallback(async (): Promise<TemplatesResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/templates', { cache: 'no-store' });
      if (!res.ok) throw new Error(`list failed: HTTP ${res.status}`);
      const data = await res.json();
      return { templates: data.templates ?? [], count: data.count ?? 0 };
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Save the agreed deck of the given session as a template. Director builds the
   * content-free snapshot from that session (strawman + captured frozen plans).
   */
  const saveTemplate = useCallback(async (args: {
    name: string;
    sourceSessionId: string;
    description?: string;
  }): Promise<SaveTemplateResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: args.name,
          description: args.description ?? null,
          source_session_id: args.sourceSessionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `save failed: HTTP ${res.status}`);
      }
      return data as SaveTemplateResult;
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, listTemplates, saveTemplate, deleteTemplate };
}
