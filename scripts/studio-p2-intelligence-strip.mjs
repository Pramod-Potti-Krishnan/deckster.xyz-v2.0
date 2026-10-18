// INT-03/04/07 (NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE): the exact text this change adds to components/studio-personal/intelligence-workspace.tsx, as
// [text with the change, base text]. scripts/test-studio-p2-intelligence.mjs proves stripping gives back the base file byte for byte and that every
// added text is behind the flag.
export const BASE_COMMIT = 'fbc77c0430099ec7e11a188307ee5521b6937719'
export const FILE = 'components/studio-personal/intelligence-workspace.tsx'
export const CHANGES = [
  [
    `import "./intelligence-polish.css"\nimport "./studio-p2-intelligence.css"\nimport { NARRATION_VOICES, DEFAULT_VOICE_ID } from "@/lib/narration/voices"\nimport { STUDIO_P2_INTELLIGENCE_ENABLED as p2Int, choiceOriginLabel, recommendedOptionLabel, voiceModelName, voiceOptionLabel, voiceProvider } from "@/lib/studio-p2-intelligence"\n`,
    `import "./intelligence-polish.css"\n`,
  ],
  [
    `  const [restored, setRestored] = useState(false)\n  // INT-03 (p2Int): the narration voice in this draft; kept in memory for this visit, never saved or applied.\n  const [voiceChoice, setVoiceChoice] = useState("default")\n  const changed = taskIds.filter(task => draft[task] !== "default").length\n`,
    `  const [restored, setRestored] = useState(false)\n  const changed = taskIds.filter(task => draft[task] !== "default").length\n`,
  ],
  [
    `          <div className="sp-section-heading"><h2 id="sp-tasks-heading">Your models, by task</h2>{p2Int && (changed || voiceChoice !== "default") ? <button type="button" className="sp-p2-int-reset" onClick={() => { setDraft(defaultDraft()); setVoiceChoice("default"); setFeedback("Draft reset to recommendations.") }}><RotateCcw size={13} aria-hidden="true" />Reset to recommendations</button> : <span>{changed ? \`\${changed} draft change\${changed === 1 ? "" : "s"}\` : "Catalog starting points"}</span>}</div>\n`,
    `          <div className="sp-section-heading"><h2 id="sp-tasks-heading">Your models, by task</h2><span>{changed ? \`\${changed} draft change\${changed === 1 ? "" : "s"}\` : "Catalog starting points"}</span></div>\n`,
  ],
  [
    `              <div className="sp-task-row" data-active={activeTask === id} key={id} data-model-task={id} data-p2-int={p2Int ? "true" : undefined}>\n`,
    `              <div className="sp-task-row" data-active={activeTask === id} key={id} data-model-task={id}>\n`,
  ],
  [
    `                </button>\n                {p2Int && <div className="sp-p2-int-current"><strong>{selected.name}</strong><small>{selected.provider} · {choiceOriginLabel(draft[id] === "default")}</small></div>}\n                <div className="sp-task-choice">\n`,
    `                </button>\n                <div className="sp-task-choice">\n`,
  ],
  [
    `                    <option value="default">{p2Int ? recommendedOptionLabel(modelFor(id, "default").name) : <>Prototype starting point · {modelFor(id, "default").name}</>}</option>\n`,
    `                    <option value="default">Prototype starting point · {modelFor(id, "default").name}</option>\n`,
  ],
  [
    `                  {!p2Int && <span>{selected.provider} <span aria-hidden="true">·</span> {draft[id] === "default" ? "Prototype starting point" : "Local design choice"}</span>}\n`,
    `                  <span>{selected.provider} <span aria-hidden="true">·</span> {draft[id] === "default" ? "Prototype starting point" : "Local design choice"}</span>\n`,
  ],
  [
    `          {p2Int ? <VoiceNarrationRow choice={voiceChoice} onChoose={value => { setVoiceChoice(value); setFeedback(\`Voice & Narration: \${value === "default" ? "the recommended voice" : NARRATION_VOICES.find(voice => voice.id === value)?.name ?? "the recommended voice"} selected in this draft.\`) }} />\n          : polish ? <div className="sp-later-row">`,
    `          {polish ? <div className="sp-later-row">`,
  ],
  [
    `<div className="sp-action-buttons">{!p2Int && <><button className="sp-button" type="button" disabled={!changed} onClick={() => { setDraft(defaultDraft()); setFeedback("Draft reset to catalog starting points.") }}><RotateCcw size={14} aria-hidden="true" /> Reset draft</button><button className="sp-button sp-button-save" type="button" disabled aria-describedby={polish ? "sp-model-note" : "sp-model-save-note"}>Apply to Deckster</button></>}</div>`,
    `<div className="sp-action-buttons"><button className="sp-button" type="button" disabled={!changed} onClick={() => { setDraft(defaultDraft()); setFeedback("Draft reset to catalog starting points.") }}><RotateCcw size={14} aria-hidden="true" /> Reset draft</button><button className="sp-button sp-button-save" type="button" disabled aria-describedby={polish ? "sp-model-note" : "sp-model-save-note"}>Apply to Deckster</button></div>`,
  ],
  [
    `/** INT-03 (p2Int): Voice & Narration as a fifth row: the real narration voices in a draft select. Nothing is saved, applied or played. */
function VoiceNarrationRow({ choice, onChoose }: { choice: string; onChoose: (value: string) => void }) {
  const recommended = NARRATION_VOICES.find(voice => voice.id === DEFAULT_VOICE_ID) ?? NARRATION_VOICES[0]
  const current = choice === "default" ? recommended : NARRATION_VOICES.find(voice => voice.id === choice) ?? recommended
  return (
    <div className="sp-task-row" data-p2-int="true" data-model-task="voice_narration">
      <div className="sp-task-inspect sp-p2-int-static">
        <span className="sp-task-icon"><AudioLines size={20} strokeWidth={1.6} aria-hidden="true" /></span>
        <span><strong>Voice &amp; Narration</strong><small>Presentation narration · Voice selection</small></span>
      </div>
      <div className="sp-p2-int-current"><strong>{current.name}</strong><small>{voiceProvider(current.model)} · {choiceOriginLabel(choice === "default")}</small></div>
      <div className="sp-task-choice">
        <label className="sr-only" htmlFor="sp-model-voice_narration">Voice &amp; Narration voice</label>
        <select id="sp-model-voice_narration" value={choice} onChange={event => onChoose(event.target.value)}>
          <option value="default">{recommendedOptionLabel(\`\${recommended.name} · \${voiceModelName(recommended.model)}\`)}</option>
          {NARRATION_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voiceOptionLabel(voice)}</option>)}
        </select>
      </div>
    </div>
  )
}

/** Flag on: the one status pill that replaces the header chip in Design preview.`,
    `/** Flag on: the one status pill that replaces the header chip in Design preview.`,
  ],
]

export function stripP2Intelligence(text) {
  return CHANGES.reduce((out, [added, base]) => out.replace(added, () => base), text)
}
