"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileChip, UploadedFile } from '@/components/file-chip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import {
  Globe,
  SlidersHorizontal,
  Paperclip,
  ArrowUp,
  Loader2,
  Search,
  Sparkles,
  Brain,
  LayoutTemplate,
  Palette,
  X,
} from "lucide-react"
import { config, features } from '@/lib/config'
import {
  FALLBACK_THEME_PRESETS,
  isValidThemeHex,
  normalizeThemePresetId,
  type BuildThemeSelection,
  type ThemePresetSummary,
} from '@/lib/theme-builder'
import type { ActionRequest } from "@/hooks/use-deckster-websocket-v2"
import { TemplatePicker } from './template-picker'

const TEXTAREA_MIN_HEIGHT = 96
const TEXTAREA_MAX_HEIGHT = 220

export interface ChatInputProps {
  inputMessage: string
  onInputChange: (value: string) => void
  onSubmit: (e?: React.FormEvent) => void
  uploadedFiles: UploadedFile[]
  onFilesSelected: (files: File[]) => void
  onRemoveFile: (fileId: string) => void
  onClearAllFiles: () => void
  pendingActionInput: {
    action: ActionRequest['payload']['actions'][0]
    messageId: string
    timestamp: number
  } | null
  onCancelAction: () => void
  researchEnabled: boolean
  onResearchEnabledChange: (enabled: boolean) => void
  webSearchEnabled: boolean
  onWebSearchEnabledChange: (enabled: boolean) => void
  extendedGenerationEnabled: boolean
  onExtendedGenerationEnabledChange: (enabled: boolean) => void
  knowledgeGraphEnabled: boolean
  onKnowledgeGraphEnabledChange: (enabled: boolean) => void
  showKnowledgeGraphToggle: boolean
  isReady: boolean
  isLoadingSession: boolean
  connected: boolean
  connecting: boolean
  user: any
  currentSessionId: string | null
  onRequestSession: () => Promise<void>
  // Template Builder (reuse): in-chat picker beside the attach button
  templateBuilderEnabled?: boolean
  activeTemplate?: { id: string; name: string } | null
  onSelectTemplate?: (template: { id: string; name: string }) => void
  onClearTemplate?: () => void
  buildTheme: BuildThemeSelection
  onBuildThemeChange: (theme: BuildThemeSelection) => void
}

export function ChatInput({
  inputMessage,
  onInputChange,
  onSubmit,
  uploadedFiles,
  onFilesSelected,
  onRemoveFile,
  onClearAllFiles,
  pendingActionInput,
  onCancelAction,
  researchEnabled,
  onResearchEnabledChange,
  webSearchEnabled,
  onWebSearchEnabledChange,
  extendedGenerationEnabled,
  onExtendedGenerationEnabledChange,
  knowledgeGraphEnabled,
  onKnowledgeGraphEnabledChange,
  showKnowledgeGraphToggle,
  isReady,
  isLoadingSession,
  connected,
  connecting,
  user,
  currentSessionId,
  onRequestSession,
  templateBuilderEnabled,
  activeTemplate,
  onSelectTemplate,
  onClearTemplate,
  buildTheme,
  onBuildThemeChange,
}: ChatInputProps) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [themePresets, setThemePresets] = useState<ThemePresetSummary[]>(FALLBACK_THEME_PRESETS)
  const [themePresetsLoading, setThemePresetsLoading] = useState(false)
  const [themePresetsError, setThemePresetsError] = useState<string | null>(null)
  const [brandHexDraft, setBrandHexDraft] = useState(buildTheme.primary_hex || '#1e40af')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(Math.max(textarea.scrollHeight, TEXTAREA_MIN_HEIGHT), TEXTAREA_MAX_HEIGHT)
      textarea.style.height = `${newHeight}px`
    }
  }, [inputMessage])

  useEffect(() => {
    let cancelled = false
    async function loadPresets() {
      setThemePresetsLoading(true)
      setThemePresetsError(null)
      try {
        const baseUrl = config.api.themeBuilderUrl.replace(/\/$/, '')
        const response = await fetch(`${baseUrl}/api/v1/themes/presets`)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const presets = await response.json()
        if (!cancelled && Array.isArray(presets) && presets.length > 0) {
          setThemePresets(presets)
        }
      } catch (error) {
        if (!cancelled) {
          setThemePresets(FALLBACK_THEME_PRESETS)
          setThemePresetsError(error instanceof Error ? error.message : 'Unable to load presets')
        }
      } finally {
        if (!cancelled) {
          setThemePresetsLoading(false)
        }
      }
    }
    loadPresets()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (buildTheme.primary_hex) {
      setBrandHexDraft(buildTheme.primary_hex)
    }
  }, [buildTheme.primary_hex])

  const activePreset = buildTheme.mode === 'preset'
    ? themePresets.find((preset) => preset.preset_id === buildTheme.preset_id)
    : undefined
  const activeThemeLabel = buildTheme.mode === 'preset'
    ? activePreset?.name || buildTheme.preset_id || 'Preset'
    : buildTheme.mode === 'custom'
      ? `Brand ${buildTheme.primary_hex || ''}`
      : 'Auto theme'

  const handlePresetChange = (presetId: string) => {
    if (presetId === 'auto') {
      onBuildThemeChange({ mode: 'auto' })
      return
    }
    const normalized = normalizeThemePresetId(presetId)
    if (normalized) {
      onBuildThemeChange({ mode: 'preset', preset_id: normalized })
    }
  }

  const handleBrandHexChange = (value: string) => {
    const normalized = value.startsWith('#') ? value : `#${value}`
    setBrandHexDraft(normalized)
    if (isValidThemeHex(normalized)) {
      onBuildThemeChange({ mode: 'custom', primary_hex: normalized.toLowerCase() })
    }
  }

  return (
    <div
      className={`p-3 border-t border-gray-100 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900 ${
        isDraggingFiles ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-700' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (features.enableFileUploads) setIsDraggingFiles(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDraggingFiles(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDraggingFiles(false)
        if (features.enableFileUploads) {
          const files = Array.from(e.dataTransfer.files)
          if (files.length > 0) {
            onRequestSession().then(() => {
              onFilesSelected(files)
            }).catch((error) => {
              console.error('[ChatInput] Session creation failed for drag-and-drop:', error)
            })
          }
        }
      }}
    >
      {/* Drop zone indicator */}
      {isDraggingFiles && (
        <div className="mb-3 p-4 border-2 border-dashed border-purple-300 rounded-lg bg-purple-50 text-center">
          <p className="text-xs text-purple-600 font-medium">Drop files here to attach</p>
        </div>
      )}

      {/* Hidden file input for upload button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.gif,.webp,.py,.js,.ts,.java,.go,.rs"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          console.log(`[ChatInput] File input onChange fired, ${files.length} file(s)`, files.map(f => f.name))
          if (files.length > 0) {
            onFilesSelected(files)
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }}
        className="hidden"
      />

      {/* Action Input Banner */}
      {pendingActionInput && (
        <div className="mb-2 p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 dark:text-slate-200 font-medium text-xs">
              {pendingActionInput.action.label}
            </span>
            <span className="text-gray-500 dark:text-slate-400 text-[11px]">
              Type your input and press Enter
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancelAction}
            className="h-5 text-[11px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 dark:bg-slate-700 px-1.5"
          >
            Cancel
          </Button>
        </div>
      )}
      {/* Template Builder: locked-in template indicator */}
      {activeTemplate && (
        <div className="mb-2 px-2 py-1.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 text-xs font-medium min-w-0">
            <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Template locked: {activeTemplate.name}</span>
          </div>
          <button
            type="button"
            onClick={() => onClearTemplate?.()}
            className="ml-2 shrink-0 text-purple-500 hover:text-purple-700 dark:hover:text-purple-200"
            title="Clear template"
            aria-label="Clear template"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {buildTheme.mode !== 'auto' && (
        <div className="mb-2 px-2 py-1.5 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 text-xs font-medium min-w-0">
            <Palette className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Theme locked: {activeThemeLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => onBuildThemeChange({ mode: 'auto' })}
            className="ml-2 shrink-0 text-sky-500 hover:text-sky-700 dark:hover:text-sky-200"
            title="Clear theme"
            aria-label="Clear theme"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main input container - Claude style */}
      <form onSubmit={onSubmit}>
        <div className="relative bg-gray-50 rounded-xl border border-gray-200 focus-within:border-gray-300 focus-within:shadow-sm transition-all dark:bg-slate-800 dark:border-slate-700 dark:focus-within:border-slate-600">
          {/* File chips live inside the composer so the input grows with them */}
          {features.enableFileUploads && uploadedFiles.length > 0 && !isDraggingFiles && (
            <div className="max-h-24 overflow-y-auto border-b border-gray-200/70 px-3 py-2">
              <div className="flex flex-wrap items-start gap-2">
                {uploadedFiles.map((file) => (
                  <FileChip
                    key={file.id}
                    file={file}
                    onRemove={() => onRemoveFile(file.id)}
                    variant="icon"
                  />
                ))}
                {uploadedFiles.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={onClearAllFiles}
                    className="h-5 w-fit px-1.5 text-[10px] text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:text-slate-200"
                  >
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit()
              }
              if (e.key === 'Escape' && pendingActionInput) {
                e.preventDefault()
                onCancelAction()
              }
            }}
            placeholder={
              !user
                ? "Authenticating..."
                : isLoadingSession
                ? "Loading..."
                : !connected && !connecting
                  ? "Disconnected - send to reconnect"
                  : connecting
                    ? "Connecting..."
                    : pendingActionInput
                      ? "Type your changes... (ESC to cancel)"
                      : "Message Director..."
            }
            disabled={!user || isLoadingSession}
            className="w-full resize-none border-0 bg-transparent focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 pt-3 pb-14 min-h-[96px] max-h-[220px] text-xs placeholder:text-gray-400 dark:text-slate-500 overflow-y-auto dark:text-slate-100 dark:placeholder:text-slate-500"
            rows={1}
          />

          {/* Bottom toolbar inside input */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gray-50 rounded-b-xl dark:bg-slate-800">
            {/* Left: Action buttons */}
            <div className="flex items-center gap-1">
              {/* Direct file upload */}
              {features.enableFileUploads && (
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg p-1.5 text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-200 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploadedFiles.length >= 5}
                  onClick={async () => {
                    try {
                      await onRequestSession()
                    } catch {
                      return
                    }
                    fileInputRef.current?.click()
                  }}
                  title="Upload a file"
                  aria-label="Upload a file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              )}

              {/* Template Builder: reuse a saved template (sibling of attach) */}
              {templateBuilderEnabled && onSelectTemplate && (
                <TemplatePicker onSelect={onSelectTemplate} disabled={!user || isLoadingSession} />
              )}

              {/* Build-time Theme Builder selection */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`flex items-center justify-center rounded-lg p-1.5 transition-colors ${
                      buildTheme.mode === 'auto'
                        ? 'text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                        : 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900'
                    }`}
                    title={activeThemeLabel}
                    aria-label="Build theme"
                    disabled={!user || isLoadingSession}
                  >
                    <Palette className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-2">
                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 text-[11px] font-medium text-gray-600 dark:text-slate-300">
                        Build theme
                      </div>
                      <select
                        value={buildTheme.mode === 'preset' ? buildTheme.preset_id || 'auto' : 'auto'}
                        onChange={(event) => handlePresetChange(event.target.value)}
                        className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        disabled={themePresetsLoading}
                      >
                        <option value="auto">Auto / default</option>
                        {themePresets.map((preset) => (
                          <option key={preset.preset_id} value={preset.preset_id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-medium text-gray-600 dark:text-slate-300">
                        Brand color
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={isValidThemeHex(brandHexDraft) ? brandHexDraft : '#1e40af'}
                          onChange={(event) => handleBrandHexChange(event.target.value)}
                          className="h-8 w-9 rounded border border-gray-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
                          aria-label="Brand color"
                        />
                        <input
                          value={brandHexDraft}
                          onChange={(event) => handleBrandHexChange(event.target.value)}
                          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 font-mono text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="#1e40af"
                          aria-label="Brand hex color"
                        />
                      </div>
                    </div>
                    {themePresetsError && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-300">
                        Using local preset list
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings/Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                      <span className="text-xs">Deep Research</span>
                    </div>
                    <Switch
                      checked={researchEnabled}
                      onCheckedChange={onResearchEnabledChange}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                      <span className="text-xs">Web search</span>
                    </div>
                    <Switch
                      checked={webSearchEnabled}
                      onCheckedChange={onWebSearchEnabledChange}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                      <span className="text-xs">Extended</span>
                    </div>
                    <Switch
                      checked={extendedGenerationEnabled}
                      onCheckedChange={onExtendedGenerationEnabledChange}
                      className="scale-75"
                    />
                  </div>
                  {showKnowledgeGraphToggle && (
                    <div className="flex items-center justify-between px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                        <span className="text-xs">Knowledge graph</span>
                      </div>
                      <Switch
                        checked={knowledgeGraphEnabled}
                        onCheckedChange={onKnowledgeGraphEnabledChange}
                        className="scale-75"
                      />
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: Send button - rounded square with up arrow */}
            <button
              type="submit"
              disabled={!isReady || !inputMessage.trim()}
              className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                inputMessage.trim()
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-purple-100 text-purple-300 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>

          {/* Only show loading overlay when actually loading session */}
          {isLoadingSession && (
            <div className="absolute inset-0 bg-white dark:bg-slate-900/50 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-gray-600 dark:text-slate-300" />
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
