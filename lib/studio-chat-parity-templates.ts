/**
 * CHAT-PARITY, TEMPLATES group (rows 65 / 67 / 76, and 70 / 75 behind their paid sub-flags; NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES): the
 * executors of Director's template requests. Each calls the click path's own function, handed in by the Builder page as `deps.templates`:
 *  - select_template (row 65): the template picker's own select (the page's handleSelectTemplate with the picker's selection record), so the
 *    next user_message carries template_id as a picked template does; refused while build selections are locked.
 *  - composer_template_action (row 67): the composer library dialog's own action (Use original / Rebuild from own content / New topic): the
 *    page opens the dialog with the request and the dialog runs it on its next render, exactly as the composer popup's pick does. Each
 *    opens a NEW deck (Director sends it after its session_directive new_session, DIRECTOR-2 point 5).
 *  - rename_template (row 76): the Templates page's own renameTemplate (hooks/use-templates.ts, the manage flag's PATCH route).
 *  - save_template (row 70, paid: the save starts a composer optimisation) and optimize_template (row 75, paid): the Save Template dialog's
 *    own saveTemplate and the Templates page's own reoptimizeTemplate, each after a Studio confirm; blocked while their sub-flag is off.
 * Rows 66 and 72 have no live Studio click path at this head and are not actions (lib/studio-chat-parity.ts).
 */

import { templateGenerationStatus, type SavedTemplate, type SaveTemplateResult, type TemplateEnrichmentResult, type TemplateRenameResult, type TemplatesResponse, type TemplateSelection } from '@/hooks/use-templates'
import type { ComposerLibraryRequest, ComposerTemplateAction } from '@/lib/studio-composer-popups'
import type { ComposerTemplate } from '@/lib/composer-library'
import { chatParityPaidBlocked, chatParityResult, chatParityTemplateArgs, type ChatParityRequest, type ChatParityResultData } from '@/lib/studio-chat-parity'

/** What the page hands the template executors: the click paths' own functions and reads. */
export interface ChatParityTemplateDeps {
  listTemplates: () => Promise<TemplatesResponse | null>
  saveTemplate: (args: { name: string; sourceSessionId: string; sourcePresentationId?: string | null }) => Promise<SaveTemplateResult | null>
  reoptimizeTemplate: (id: string) => Promise<TemplateEnrichmentResult | null>
  renameTemplate: (id: string, name: string) => Promise<TemplateRenameResult>
  /** The picker's own select (handleSelectTemplate); `selectionLocked` is the lock it refuses under (templateSelectionLockedRef). */
  select: (template: TemplateSelection) => void
  selectionLocked: () => boolean
  /** The composer library (null where it is not enabled): its list and the dialog's own runner, with the actions its flags offer. */
  composer: { list: () => Promise<ComposerTemplate[]>; run: (request: ComposerLibraryRequest) => void; actions: () => ComposerTemplateAction[] } | null
  /** The Save Template dialog's own source: the session and the completed deck (null when there is none). */
  saveSource: () => { sessionId: string | null; presentationId: string | null }
  /** A Studio confirm for a paid action: the user's yes / no (no answer within the toast's life reads as no). */
  confirm: (title: string, description: string, label: string) => Promise<boolean>
}

type Result = ChatParityResultData
const fail = (id: string, code: Parameters<typeof chatParityResult>[2]) => chatParityResult(id, 'failed', code)

/** The picker's own selection record for a saved template (components/builder/template-picker.tsx toSelection). */
export function templateSelectionOf(template: SavedTemplate): TemplateSelection {
  return {
    id: template.id,
    name: template.name,
    blueprint_generation_method: template.blueprint_generation_method,
    blueprint_enrichment_status: template.blueprint_enrichment_status,
    blueprint_enrichment_error: template.blueprint_enrichment_error,
    template_purity_status: template.template_purity_status,
    template_purity_error: template.template_purity_error,
  }
}

async function findTemplate(deps: ChatParityTemplateDeps, id: string): Promise<SavedTemplate | null> {
  const list = await deps.listTemplates()
  return list?.templates.find(template => template.id === id) ?? null
}

/** Runs one template request (the action is one of CHAT_PARITY_ACTIONS.templates) to a known status. */
export async function runChatParityTemplateAction(request: ChatParityRequest, deps: ChatParityTemplateDeps): Promise<Result> {
  const id = request.requestId
  const args = chatParityTemplateArgs(request.action, request.args)
  if (!args) return fail(id, 'invalid_args')
  if (chatParityPaidBlocked(args.action)) return fail(id, 'flag_off')
  switch (args.action) {
    case 'select_template': {
      const template = await findTemplate(deps, args.template_id)
      if (!template) return fail(id, 'not_found')
      if (deps.selectionLocked()) return fail(id, 'locked')
      deps.select(templateSelectionOf(template))
      return chatParityResult(id, 'done', null, { template_id: template.id, name: template.name })
    }
    case 'composer_template_action': {
      if (!deps.composer) return fail(id, 'flag_off')
      if (!deps.composer.actions().includes(args.composer_action)) return fail(id, 'flag_off')
      const template = (await deps.composer.list()).find(item => item.id === args.template_id)
      if (!template) return fail(id, 'not_found')
      deps.composer.run({ action: args.composer_action, template })
      return chatParityResult(id, 'done', null, { template_id: template.id, action: args.composer_action })
    }
    case 'rename_template': {
      if (!(await findTemplate(deps, args.template_id))) return fail(id, 'not_found')
      const result = await deps.renameTemplate(args.template_id, args.name)
      if (result.ok) return chatParityResult(id, 'done', null, { template_id: result.template.id, name: typeof result.template.name === 'string' && result.template.name ? result.template.name : args.name })
      return fail(id, result.reason === 'unavailable' ? 'flag_off' : result.reason === 'gone' ? 'not_found' : result.reason === 'taken' ? 'name_taken' : result.reason === 'invalid' ? 'invalid_args' : 'write_failed')
    }
    case 'save_template': {
      const source = deps.saveSource()
      if (!source.sessionId || !source.presentationId) return fail(id, 'no_deck')
      const yes = await deps.confirm('Save this deck as a template?', `"${args.name}" will be saved and optimised for reuse (a paid composer job).`, 'Save template')
      if (!yes) return chatParityResult(id, 'dismissed', 'declined')
      const result = await deps.saveTemplate({ name: args.name, sourceSessionId: source.sessionId, sourcePresentationId: source.presentationId })
      if (!result?.id) return fail(id, 'write_failed')
      return chatParityResult(id, 'done', null, { template_id: result.id, name: result.name ?? args.name })
    }
    case 'optimize_template': {
      const template = await findTemplate(deps, args.template_id)
      if (!template) return fail(id, 'not_found')
      const status = templateGenerationStatus(templateSelectionOf(template))
      if (status === 'ready' || status === 'optimizing') return fail(id, 'already_ready')
      const yes = await deps.confirm('Optimise this template?', `"${template.name}" will be optimised for reuse (a paid composer job).`, 'Optimise')
      if (!yes) return chatParityResult(id, 'dismissed', 'declined')
      const result = await deps.reoptimizeTemplate(template.id)
      if (!result) return fail(id, 'write_failed')
      return chatParityResult(id, 'done', null, { template_id: template.id, name: template.name })
    }
  }
}
