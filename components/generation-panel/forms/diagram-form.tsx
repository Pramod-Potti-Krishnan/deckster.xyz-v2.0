'use client'

import { useState, useCallback, useEffect } from 'react'
import { ElementContext } from '../types'
import {
  DiagramFormData,
  TextLabsDiagramSubtype,
  CodeDisplayConfig,
  KanbanConfig,
  GanttConfig,
  ChevronConfig,
  IdeaBoardConfig,
  CloudArchitectureConfig,
  LogicalArchitectureConfig,
  DataArchitectureConfig,
  TEXT_LABS_ELEMENT_DEFAULTS,
} from '@/types/textlabs'
import { PromptInput } from '../shared/prompt-input'
import { ToggleRow } from '../shared/toggle-row'
import { ZIndexInput } from '../shared/z-index-input'

const DEFAULTS = TEXT_LABS_ELEMENT_DEFAULTS.DIAGRAM

const DIAGRAM_SUBTYPES: { value: TextLabsDiagramSubtype; label: string }[] = [
  { value: 'CODE_DISPLAY', label: 'Code Block' },
  { value: 'KANBAN_BOARD', label: 'Kanban Board' },
  { value: 'GANTT_CHART', label: 'Gantt Chart' },
  { value: 'CHEVRON_MATURITY', label: 'Maturity Roadmap' },
  { value: 'IDEA_BOARD', label: 'Idea Board' },
  { value: 'CLOUD_ARCHITECTURE', label: 'Cloud Architecture' },
  { value: 'LOGICAL_ARCHITECTURE', label: 'System Architecture' },
  { value: 'DATA_ARCHITECTURE', label: 'ER Diagram' },
]

const POSITION_PRESETS = [
  { value: 'full_content', label: 'Full' },
  { value: 'left_half', label: 'Left Half' },
  { value: 'right_half', label: 'Right Half' },
  { value: 'left_third', label: 'Left Third' },
  { value: 'center_third', label: 'Center Third' },
  { value: 'right_third', label: 'Right Third' },
]

const LANGUAGES = [
  'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'c', 'cpp', 'csharp',
  'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'bash', 'yaml', 'json', 'xml',
]

const COLOR_THEMES: { value: CodeDisplayConfig['color_theme']; label: string }[] = [
  { value: 'github_dark', label: 'GitHub Dark' },
  { value: 'github_light', label: 'GitHub Light' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'nord', label: 'Nord' },
]

const PROMPT_PLACEHOLDERS: Record<TextLabsDiagramSubtype, string> = {
  CODE_DISPLAY: 'e.g., Python function to calculate fibonacci sequence',
  KANBAN_BOARD: 'e.g., Sprint board for mobile app development with tasks',
  GANTT_CHART: 'e.g., Q1 2025 product launch timeline with milestones',
  CHEVRON_MATURITY: 'e.g., Digital transformation roadmap from legacy to cloud-native',
  IDEA_BOARD: 'e.g., Feature prioritization for next quarter releases',
  CLOUD_ARCHITECTURE: 'e.g., Microservices architecture on AWS with ECS, RDS, and ElastiCache',
  LOGICAL_ARCHITECTURE: 'e.g., E-commerce platform system architecture with payment processing',
  DATA_ARCHITECTURE: 'e.g., User management database with roles and permissions',
}

interface DiagramFormProps {
  onSubmit: (formData: DiagramFormData) => void
  registerSubmit: (fn: () => void) => void
  isGenerating: boolean
  elementContext?: ElementContext | null
}

export function DiagramForm({ onSubmit, registerSubmit, isGenerating, elementContext }: DiagramFormProps) {
  const [prompt, setPrompt] = useState('')
  const [subtype, setSubtype] = useState<TextLabsDiagramSubtype>('CODE_DISPLAY')
  const [advancedModified, setAdvancedModified] = useState(false)
  const [zIndex, setZIndex] = useState(DEFAULTS.zIndex)

  // Code Display state
  const [language, setLanguage] = useState('python')
  const [colorTheme, setColorTheme] = useState<CodeDisplayConfig['color_theme']>('github_dark')
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [showCopyButton, setShowCopyButton] = useState(true)
  const [cornerStyle, setCornerStyle] = useState<'rounded' | 'square'>('rounded')
  const [codeSize, setCodeSize] = useState<'full' | 'half' | 'third'>('full')
  const [codePosition, setCodePosition] = useState<'left' | 'center' | 'right'>('left')

  // Kanban state
  const [columnCount, setColumnCount] = useState(4)
  const [kanbanTheme, setKanbanTheme] = useState<'default' | 'dark' | 'minimal'>('default')
  const [kanbanPreset, setKanbanPreset] = useState('full_content')

  // Gantt state
  const [ganttTimeUnit, setGanttTimeUnit] = useState<'days' | 'weeks' | 'months' | 'quarters'>('weeks')
  const [ganttTheme, setGanttTheme] = useState<'default' | 'dark' | 'minimal'>('default')
  const [ganttPreset, setGanttPreset] = useState('full_content')

  // Chevron state
  const [numStages, setNumStages] = useState(5)
  const [chevronTheme, setChevronTheme] = useState<'default' | 'dark' | 'minimal'>('default')
  const [chevronTimeUnit, setChevronTimeUnit] = useState<'months' | 'quarters' | 'years'>('quarters')
  const [chevronPreset, setChevronPreset] = useState('full_content')

  // Idea Board state
  const [axisPreset, setAxisPreset] = useState<'impact_urgency' | 'impact_effort' | 'risk_reward' | 'custom'>('impact_urgency')
  const [ideaTheme, setIdeaTheme] = useState<'default' | 'dark' | 'minimal'>('default')
  const [ideaPreset, setIdeaPreset] = useState('full_content')

  // Cloud Architecture state
  const [provider, setProvider] = useState<'aws' | 'gcp' | 'azure'>('aws')
  const [showLayers, setShowLayers] = useState(true)
  const [cloudPreset, setCloudPreset] = useState('full_content')

  // Logical Architecture state
  const [logicalPreset, setLogicalPreset] = useState('full_content')

  // Data Architecture state
  const [showDataTypes, setShowDataTypes] = useState(true)
  const [showNullable, setShowNullable] = useState(true)
  const [dataPreset, setDataPreset] = useState('full_content')

  const buildDiagramConfig = useCallback((): Partial<
    CodeDisplayConfig | KanbanConfig | GanttConfig | ChevronConfig |
    IdeaBoardConfig | CloudArchitectureConfig | LogicalArchitectureConfig | DataArchitectureConfig
  > => {
    switch (subtype) {
      case 'CODE_DISPLAY': {
        let positionPreset = 'full_content'
        if (codeSize === 'half') {
          positionPreset = codePosition === 'right' ? 'right_half' : 'left_half'
        } else if (codeSize === 'third') {
          if (codePosition === 'right') positionPreset = 'right_third'
          else if (codePosition === 'center') positionPreset = 'center_third'
          else positionPreset = 'left_third'
        }
        return {
          language,
          color_theme: colorTheme,
          text_size: textSize,
          show_line_numbers: showLineNumbers,
          show_copy_button: showCopyButton,
          corner_style: cornerStyle,
          position_preset: positionPreset,
        } satisfies Partial<CodeDisplayConfig>
      }
      case 'KANBAN_BOARD':
        return { column_count: columnCount, theme: kanbanTheme, position_preset: kanbanPreset } satisfies Partial<KanbanConfig>
      case 'GANTT_CHART':
        return { time_unit: ganttTimeUnit, theme: ganttTheme, position_preset: ganttPreset } satisfies Partial<GanttConfig>
      case 'CHEVRON_MATURITY':
        return { num_stages: numStages, theme: chevronTheme, time_unit: chevronTimeUnit, position_preset: chevronPreset } satisfies Partial<ChevronConfig>
      case 'IDEA_BOARD':
        return { axis_preset: axisPreset, theme: ideaTheme, position_preset: ideaPreset } satisfies Partial<IdeaBoardConfig>
      case 'CLOUD_ARCHITECTURE':
        return { provider, show_layers: showLayers, position_preset: cloudPreset } satisfies Partial<CloudArchitectureConfig>
      case 'LOGICAL_ARCHITECTURE':
        return { position_preset: logicalPreset } satisfies Partial<LogicalArchitectureConfig>
      case 'DATA_ARCHITECTURE':
        return { show_data_types: showDataTypes, show_nullable: showNullable, position_preset: dataPreset } satisfies Partial<DataArchitectureConfig>
    }
  }, [subtype, language, colorTheme, textSize, showLineNumbers, showCopyButton, cornerStyle, codeSize, codePosition, columnCount, kanbanTheme, kanbanPreset, ganttTimeUnit, ganttTheme, ganttPreset, numStages, chevronTheme, chevronTimeUnit, chevronPreset, axisPreset, ideaTheme, ideaPreset, provider, showLayers, cloudPreset, logicalPreset, showDataTypes, showNullable, dataPreset])

  const handleSubmit = useCallback(() => {
    const formData: DiagramFormData = {
      componentType: subtype,
      prompt: prompt || `Generate a ${subtype.toLowerCase().replace(/_/g, ' ')}`,
      count: 1,
      layout: 'horizontal',
      advancedModified,
      z_index: zIndex,
      diagramConfig: buildDiagramConfig(),
    }
    onSubmit(formData)
  }, [prompt, subtype, advancedModified, zIndex, buildDiagramConfig, onSubmit])

  useEffect(() => {
    registerSubmit(handleSubmit)
  }, [registerSubmit, handleSubmit])

  return (
    <div className="space-y-4">
      {/* Diagram Subtype Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700">Diagram Type</label>
        <select
          value={subtype}
          onChange={(e) => {
            setSubtype(e.target.value as TextLabsDiagramSubtype)
            setAdvancedModified(true)
          }}
          className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {DIAGRAM_SUBTYPES.map(st => (
            <option key={st.value} value={st.value}>{st.label}</option>
          ))}
        </select>
      </div>

      {/* Prompt */}
      <PromptInput
        value={prompt}
        onChange={setPrompt}
        placeholder={PROMPT_PLACEHOLDERS[subtype]}
        disabled={isGenerating}
      />

      {/* Subtype-specific options */}
      <div className="space-y-3">
          {subtype === 'CODE_DISPLAY' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Language</label>
                <select
                  value={language}
                  onChange={(e) => { setLanguage(e.target.value); setAdvancedModified(true) }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {LANGUAGES.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Theme</label>
                <select
                  value={colorTheme}
                  onChange={(e) => { setColorTheme(e.target.value as CodeDisplayConfig['color_theme']); setAdvancedModified(true) }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {COLOR_THEMES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <ToggleRow
                label="Text Size"
                field="text_size"
                value={textSize}
                options={[
                  { value: 'small', label: 'Small' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'large', label: 'Large' },
                ]}
                onChange={(_, v) => { setTextSize(v as 'small' | 'medium' | 'large'); setAdvancedModified(true) }}
              />
              <div className="grid grid-cols-2 gap-3">
                <ToggleRow
                  label="Line Numbers"
                  field="show_line_numbers"
                  value={showLineNumbers ? 'true' : 'false'}
                  options={[
                    { value: 'true', label: 'Show' },
                    { value: 'false', label: 'Hide' },
                  ]}
                  onChange={(_, v) => { setShowLineNumbers(v === 'true'); setAdvancedModified(true) }}
                />
                <ToggleRow
                  label="Copy Button"
                  field="show_copy_button"
                  value={showCopyButton ? 'true' : 'false'}
                  options={[
                    { value: 'true', label: 'Show' },
                    { value: 'false', label: 'Hide' },
                  ]}
                  onChange={(_, v) => { setShowCopyButton(v === 'true'); setAdvancedModified(true) }}
                />
              </div>
              <ToggleRow
                label="Corners"
                field="corner_style"
                value={cornerStyle}
                options={[
                  { value: 'rounded', label: 'Rounded' },
                  { value: 'square', label: 'Square' },
                ]}
                onChange={(_, v) => { setCornerStyle(v as 'rounded' | 'square'); setAdvancedModified(true) }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Size</label>
                  <select
                    value={codeSize}
                    onChange={(e) => { setCodeSize(e.target.value as 'full' | 'half' | 'third'); setAdvancedModified(true) }}
                    className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900"
                  >
                    <option value="full">Full</option>
                    <option value="half">Half</option>
                    <option value="third">Third</option>
                  </select>
                </div>
                {codeSize !== 'full' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700">Position</label>
                    <select
                      value={codePosition}
                      onChange={(e) => { setCodePosition(e.target.value as 'left' | 'center' | 'right'); setAdvancedModified(true) }}
                      className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900"
                    >
                      <option value="left">Left</option>
                      {codeSize === 'third' && <option value="center">Center</option>}
                      <option value="right">Right</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {subtype === 'KANBAN_BOARD' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Columns</label>
                <select
                  value={columnCount}
                  onChange={(e) => { setColumnCount(Number(e.target.value)); setAdvancedModified(true) }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900"
                >
                  {[2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <ThemeSelect value={kanbanTheme} onChange={(v) => { setKanbanTheme(v); setAdvancedModified(true) }} />
              <PositionPresetSelect value={kanbanPreset} onChange={(v) => { setKanbanPreset(v); setAdvancedModified(true) }} />
            </>
          )}

          {subtype === 'GANTT_CHART' && (
            <>
              <ToggleRow
                label="Time Unit"
                field="time_unit"
                value={ganttTimeUnit}
                options={[
                  { value: 'days', label: 'Days' },
                  { value: 'weeks', label: 'Weeks' },
                  { value: 'months', label: 'Months' },
                  { value: 'quarters', label: 'Quarters' },
                ]}
                onChange={(_, v) => { setGanttTimeUnit(v as GanttConfig['time_unit']); setAdvancedModified(true) }}
              />
              <ThemeSelect value={ganttTheme} onChange={(v) => { setGanttTheme(v); setAdvancedModified(true) }} />
              <PositionPresetSelect value={ganttPreset} onChange={(v) => { setGanttPreset(v); setAdvancedModified(true) }} />
            </>
          )}

          {subtype === 'CHEVRON_MATURITY' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Stages</label>
                <select
                  value={numStages}
                  onChange={(e) => { setNumStages(Number(e.target.value)); setAdvancedModified(true) }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900"
                >
                  {[3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <ToggleRow
                label="Time Unit"
                field="time_unit"
                value={chevronTimeUnit}
                options={[
                  { value: 'months', label: 'Months' },
                  { value: 'quarters', label: 'Quarters' },
                  { value: 'years', label: 'Years' },
                ]}
                onChange={(_, v) => { setChevronTimeUnit(v as ChevronConfig['time_unit']); setAdvancedModified(true) }}
              />
              <ThemeSelect value={chevronTheme} onChange={(v) => { setChevronTheme(v); setAdvancedModified(true) }} />
              <PositionPresetSelect value={chevronPreset} onChange={(v) => { setChevronPreset(v); setAdvancedModified(true) }} />
            </>
          )}

          {subtype === 'IDEA_BOARD' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Axis Preset</label>
                <select
                  value={axisPreset}
                  onChange={(e) => { setAxisPreset(e.target.value as IdeaBoardConfig['axis_preset']); setAdvancedModified(true) }}
                  className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900"
                >
                  <option value="impact_urgency">Impact / Urgency</option>
                  <option value="impact_effort">Impact / Effort</option>
                  <option value="risk_reward">Risk / Reward</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <ThemeSelect value={ideaTheme} onChange={(v) => { setIdeaTheme(v); setAdvancedModified(true) }} />
              <PositionPresetSelect value={ideaPreset} onChange={(v) => { setIdeaPreset(v); setAdvancedModified(true) }} />
            </>
          )}

          {subtype === 'CLOUD_ARCHITECTURE' && (
            <>
              <ToggleRow
                label="Provider"
                field="provider"
                value={provider}
                options={[
                  { value: 'aws', label: 'AWS' },
                  { value: 'gcp', label: 'GCP' },
                  { value: 'azure', label: 'Azure' },
                ]}
                onChange={(_, v) => { setProvider(v as CloudArchitectureConfig['provider']); setAdvancedModified(true) }}
              />
              <ToggleRow
                label="Show Layers"
                field="show_layers"
                value={showLayers ? 'true' : 'false'}
                options={[
                  { value: 'true', label: 'Yes' },
                  { value: 'false', label: 'No' },
                ]}
                onChange={(_, v) => { setShowLayers(v === 'true'); setAdvancedModified(true) }}
              />
              <PositionPresetSelect value={cloudPreset} onChange={(v) => { setCloudPreset(v); setAdvancedModified(true) }} />
            </>
          )}

          {subtype === 'LOGICAL_ARCHITECTURE' && (
            <PositionPresetSelect value={logicalPreset} onChange={(v) => { setLogicalPreset(v); setAdvancedModified(true) }} />
          )}

          {subtype === 'DATA_ARCHITECTURE' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ToggleRow
                  label="Data Types"
                  field="show_data_types"
                  value={showDataTypes ? 'true' : 'false'}
                  options={[
                    { value: 'true', label: 'Show' },
                    { value: 'false', label: 'Hide' },
                  ]}
                  onChange={(_, v) => { setShowDataTypes(v === 'true'); setAdvancedModified(true) }}
                />
                <ToggleRow
                  label="Nullable"
                  field="show_nullable"
                  value={showNullable ? 'true' : 'false'}
                  options={[
                    { value: 'true', label: 'Show' },
                    { value: 'false', label: 'Hide' },
                  ]}
                  onChange={(_, v) => { setShowNullable(v === 'true'); setAdvancedModified(true) }}
                />
              </div>
              <PositionPresetSelect value={dataPreset} onChange={(v) => { setDataPreset(v); setAdvancedModified(true) }} />
            </>
          )}
      </div>

      {/* Z-Index */}
      <ZIndexInput
        value={zIndex}
        onChange={setZIndex}
        onAdvancedModified={() => setAdvancedModified(true)}
      />
    </div>
  )
}

// Shared sub-components for diagram options
function ThemeSelect({ value, onChange }: { value: 'default' | 'dark' | 'minimal'; onChange: (v: 'default' | 'dark' | 'minimal') => void }) {
  return (
    <ToggleRow
      label="Theme"
      field="theme"
      value={value}
      options={[
        { value: 'default', label: 'Default' },
        { value: 'dark', label: 'Dark' },
        { value: 'minimal', label: 'Minimal' },
      ]}
      onChange={(_, v) => onChange(v as 'default' | 'dark' | 'minimal')}
    />
  )
}

function PositionPresetSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700">Position</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
      >
        {POSITION_PRESETS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </div>
  )
}

DiagramForm.displayName = 'DiagramForm'
