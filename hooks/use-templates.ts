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
  source_session_id?: string | null;
  source_presentation_id?: string | null;
}

export interface TemplateSlot {
  slot_id: string;
  name?: string;
  element_type?: string | null;
  slide_index: number;
  slide_title?: string;
  slide_subtitle?: string | null;
  narrative_role?: string;
  key_message?: string;
  content_type?: string;
  canvas_type?: string | null;
  chart_subtype?: string | null;
  infographic_subtype?: string | null;
  text_subtype?: string | null;
  diagram_subtype?: string | null;
  abstract_intent?: string | null;
  overrides?: Record<string, unknown>;
  [key: string]: unknown;
}

export type TemplateBlueprintScopeLevel = 'period' | 'sibling' | 'category' | 'structure';
export type TemplateBlueprintFixedness = 'constant' | 'variable' | 'locked_media';
export type TemplateBlueprintGenerationMethod = 'llm' | 'deterministic_fallback';
export type TemplateBlueprintPopulationPolicy = 'flexible' | 'strict';
export type TemplateBlueprintLockPolicy = 'lock_exact' | 'regenerate';
export type TemplateBlueprintMissingDataPolicy = 'ask_user' | 'assume_and_continue' | 'reuse_prior_as_placeholder';

export interface TemplateBlueprintScope {
  level: TemplateBlueprintScopeLevel;
  label?: string | null;
}

export interface TemplateAtomContract {
  kind: 'text' | 'metric' | 'chart' | 'diagram' | 'infographic' | 'image' | 'table' | 'kanban' | 'unknown';
  abstraction_instruction?: string | null;
  required_data?: string[];
  missing_data_policy?: TemplateBlueprintMissingDataPolicy | null;
  reusable_slots?: Record<string, unknown>;
  fixed_visual_rules?: Record<string, unknown>;
}

export interface TemplateBlueprintElement {
  element_key: string;
  source_element_id?: string | null;
  spec_id?: string | null;
  atom_type?: string | null;
  semantic_role?: string | null;
  purpose: string;
  storyline_link?: string | null;
  content_intent?: string | null;
  required_input?: string | null;
  population_rule?: string | null;
  lock_policy?: TemplateBlueprintLockPolicy | null;
  fixedness: TemplateBlueprintFixedness;
  visual_constants?: Record<string, unknown> | null;
  abstraction_scope?: TemplateBlueprintScope | null;
  atom_contract?: TemplateAtomContract | null;
}

export interface TemplateBlueprintSlide {
  slide_index: number;
  slide_title?: string | null;
  title_intent?: string | null;
  subtitle_intent?: string | null;
  purpose: string;
  storyline?: string | null;
  proof_goal?: string | null;
  narrative_role?: string | null;
  reuse_instruction?: string | null;
  required_inputs?: string[];
  population_policy: TemplateBlueprintPopulationPolicy;
  design_constants?: Record<string, unknown> | null;
  abstraction_scope?: TemplateBlueprintScope | null;
  elements: TemplateBlueprintElement[];
}

export interface TemplateBlueprint {
  version: 1;
  generation_method: TemplateBlueprintGenerationMethod;
  deck_purpose?: string | null;
  deck_reuse_instruction?: string | null;
  abstraction_scope?: TemplateBlueprintScope | null;
  slides: TemplateBlueprintSlide[];
}

export interface TemplateSnapshot extends SavedTemplate {
  user_id?: string;
  presentation_brief?: string;
  deck_arc?: string | null;
  slide_style_preset?: string | null;
  strawman_frozen?: Record<string, unknown>;
  slots?: TemplateSlot[];
  frozen_plan?: Array<Record<string, unknown>>;
  template_blueprint?: TemplateBlueprint | null;
  [key: string]: unknown;
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
  blueprint_generation_method?: TemplateBlueprintGenerationMethod;
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

  const getTemplate = useCallback(async (id: string): Promise<TemplateSnapshot | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `get failed: HTTP ${res.status}`);
      }
      return data as TemplateSnapshot;
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
    sourcePresentationId?: string | null;
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
          source_presentation_id: args.sourcePresentationId ?? null,
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

  const updateTemplateBlueprint = useCallback(async (
    id: string,
    blueprint: TemplateBlueprint,
  ): Promise<TemplateSnapshot | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}/blueprint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_blueprint: blueprint }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `blueprint update failed: HTTP ${res.status}`);
      }
      return data as TemplateSnapshot;
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    listTemplates,
    getTemplate,
    saveTemplate,
    deleteTemplate,
    updateTemplateBlueprint,
  };
}
