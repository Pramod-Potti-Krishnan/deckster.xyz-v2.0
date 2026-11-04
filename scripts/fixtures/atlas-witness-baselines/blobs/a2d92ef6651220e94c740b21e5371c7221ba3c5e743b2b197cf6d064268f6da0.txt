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
  blueprint_generation_method?: TemplateBlueprintGenerationMethod | null;
  blueprint_enrichment_status?: 'queued' | 'running' | 'complete' | 'failed' | 'skipped' | string | null;
  blueprint_enrichment_error?: string | null;
  blueprint_enriched_at?: string | null;
  source_fact_manifest?: Record<string, unknown> | null;
  template_purity_status?: 'pending' | 'clean' | 'failed' | 'skipped' | string | null;
  template_purity_error?: string | null;
  template_purified_at?: string | null;
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

export type TemplateSelection = Pick<
  SavedTemplate,
  | 'id'
  | 'name'
  | 'blueprint_generation_method'
  | 'blueprint_enrichment_status'
  | 'blueprint_enrichment_error'
  | 'template_purity_status'
  | 'template_purity_error'
>;

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
  blueprint_enrichment_status?: 'queued' | 'running' | 'complete' | 'failed' | 'skipped' | string | null;
  blueprint_enrichment_error?: string | null;
  blueprint_enriched_at?: string | null;
  source_fact_manifest?: Record<string, unknown> | null;
  template_purity_status?: 'pending' | 'clean' | 'failed' | 'skipped' | string | null;
  template_purity_error?: string | null;
  template_purified_at?: string | null;
}

export interface TemplateEnrichmentResult {
  id: string;
  blueprint_enrichment_status?: 'queued' | 'running' | 'complete' | 'failed' | 'skipped' | string | null;
  blueprint_enrichment_error?: string | null;
  blueprint_enriched_at?: string | null;
  template_purity_status?: 'pending' | 'clean' | 'failed' | 'skipped' | string | null;
  template_purity_error?: string | null;
  template_purified_at?: string | null;
}

export type TemplateGenerationStatus = ReturnType<typeof templateGenerationStatus>;

export interface TemplateStatusWatchOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onUpdate?: (snapshot: TemplateSnapshot, status: TemplateGenerationStatus) => void;
  onReady?: (snapshot: TemplateSnapshot) => void;
  onFailed?: (snapshot: TemplateSnapshot, status: TemplateGenerationStatus) => void;
  onTimeout?: (snapshot: TemplateSnapshot | null) => void;
}

const TEMPLATE_STATUS_POLL_INTERVAL_MS = 5000;
const TEMPLATE_STATUS_MAX_POLL_ATTEMPTS = 24;

export function isTemplateGenerationReady(template: TemplateSelection | TemplateSnapshot | null | undefined): boolean {
  if (!template) return false;
  const snapshot = template as TemplateSnapshot;
  const method = template.blueprint_generation_method ?? snapshot.template_blueprint?.generation_method ?? null;
  const status = template.blueprint_enrichment_status ?? null;
  const purity = template.template_purity_status ?? null;
  if (method === 'deterministic_fallback') return false;
  return method === 'llm' && status === 'complete' && purity === 'clean';
}

export function templateGenerationStatus(
  template: TemplateSelection | TemplateSnapshot | null | undefined,
): 'ready' | 'optimizing' | 'failed' | 'needs_cleanup' | 'needs_optimization' {
  if (isTemplateGenerationReady(template)) return 'ready';
  if (!template) return 'needs_optimization';
  const snapshot = template as TemplateSnapshot;
  const method = template.blueprint_generation_method ?? snapshot.template_blueprint?.generation_method ?? null;
  const status = template.blueprint_enrichment_status ?? null;
  const purity = template.template_purity_status ?? null;
  if (purity === 'failed') return 'needs_cleanup';
  if (status === 'failed') return 'failed';
  if (status === 'queued' || status === 'running') return 'optimizing';
  if (method === 'llm' && status === 'complete' && purity !== 'clean') return 'needs_cleanup';
  return 'needs_optimization';
}

export function templateGenerationStatusLabel(
  template: TemplateSelection | TemplateSnapshot | null | undefined,
): 'Ready' | 'Optimizing' | 'Failed' | 'Needs cleanup' | 'Needs optimization' {
  const status = templateGenerationStatus(template);
  if (status === 'ready') return 'Ready';
  if (status === 'optimizing') return 'Optimizing';
  if (status === 'failed') return 'Failed';
  if (status === 'needs_cleanup') return 'Needs cleanup';
  return 'Needs optimization';
}

export function templateGenerationUnavailableReason(
  template: TemplateSelection | TemplateSnapshot | null | undefined,
): string {
  if (!template) return 'Select a template first.';
  const status = templateGenerationStatus(template);
  if (status === 'failed') {
    return 'Template optimization failed; review is available, generation unlocks after re-saving or re-optimizing.';
  }
  if (status === 'needs_cleanup') {
    return 'Template needs cleanup before generation; review is available, generation unlocks after re-optimizing or editing the template.';
  }
  if (status === 'needs_optimization') {
    return 'Template needs optimization before generation; review is available now.';
  }
  return 'Template is still being optimized; review is available, generation unlocks when enrichment completes.';
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

  const fetchTemplate = useCallback(async (
    id: string,
    options: { trackLoading?: boolean } = {},
  ): Promise<TemplateSnapshot | null> => {
    const trackLoading = options.trackLoading !== false;
    if (trackLoading) setLoading(true);
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
      if (trackLoading) setLoading(false);
    }
  }, []);

  const getTemplate = useCallback(async (id: string): Promise<TemplateSnapshot | null> => (
    fetchTemplate(id, { trackLoading: true })
  ), [fetchTemplate]);

  const watchTemplateStatus = useCallback((
    id: string,
    options: TemplateStatusWatchOptions = {},
  ): (() => void) => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSnapshot: TemplateSnapshot | null = null;
    const intervalMs = options.intervalMs ?? TEMPLATE_STATUS_POLL_INTERVAL_MS;
    const maxAttempts = options.maxAttempts ?? TEMPLATE_STATUS_MAX_POLL_ATTEMPTS;

    const stop = () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const poll = async (attempt: number) => {
      const snapshot = await fetchTemplate(id, { trackLoading: false });
      if (cancelled) return;

      if (snapshot) {
        lastSnapshot = snapshot;
        const status = templateGenerationStatus(snapshot);
        options.onUpdate?.(snapshot, status);

        if (isTemplateGenerationReady(snapshot)) {
          options.onReady?.(snapshot);
          stop();
          return;
        }

        if (status === 'failed' || status === 'needs_cleanup') {
          options.onFailed?.(snapshot, status);
          stop();
          return;
        }
      }

      if (attempt >= maxAttempts) {
        options.onTimeout?.(lastSnapshot);
        stop();
        return;
      }

      timer = setTimeout(() => void poll(attempt + 1), intervalMs);
    };

    timer = setTimeout(() => void poll(1), intervalMs);
    return stop;
  }, [fetchTemplate]);

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

  const reoptimizeTemplate = useCallback(async (id: string): Promise<TemplateEnrichmentResult | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}/enrich`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || `template optimization failed: HTTP ${res.status}`);
      }
      return data as TemplateEnrichmentResult;
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
    watchTemplateStatus,
    saveTemplate,
    deleteTemplate,
    updateTemplateBlueprint,
    reoptimizeTemplate,
  };
}
