"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileChip, UploadedFile } from '@/components/file-chip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import {
  Globe,
  Plus,
  SlidersHorizontal,
  Camera,
  Folder,
  Paperclip,
  ArrowUp,
  Loader2,
} from "lucide-react"
import { features } from '@/lib/config'
import type { ActionRequest } from "@/hooks/use-deckster-websocket-v2"

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
  isReady: boolean
  isLoadingSession: boolean
  connected: boolean
  connecting: boolean
  user: any
  currentSessionId: string | null
  onRequestSession: () => Promise<void>
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
  isReady,
  isLoadingSession,
  connected,
  connecting,
  user,
  currentSessionId,
  onRequestSession,
}: ChatInputProps) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 60), 120)
      textarea.style.height = `${newHeight}px`
    }
  }, [inputMessage])

  return (
    <div
      className={`p-3 border-t border-gray-100 bg-white transition-colors ${
        isDraggingFiles ? 'bg-purple-50 border-purple-200' : ''
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
            onFilesSelected(files)
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

      {/* File chips (when files attached) */}
      {features.enableFileUploads && uploadedFiles.length > 0 && !isDraggingFiles && (
        <div className="flex flex-wrap gap-2 mb-3">
          {uploadedFiles.map((file) => (
            <FileChip
              key={file.id}
              file={file}
              onRemove={() => onRemoveFile(file.id)}
            />
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAllFiles}
            className="text-[11px] text-gray-500 hover:text-gray-700 h-6 px-2"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Hidden file input for dropdown menu */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls,.csv,.pptx,.ppt,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.py,.js,.ts,.java,.go,.rs"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
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
        <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-700 font-medium text-xs">
              {pendingActionInput.action.label}
            </span>
            <span className="text-gray-500 text-[11px]">
              Type your input and press Enter
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancelAction}
            className="h-5 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-1.5"
          >
            Cancel
          </Button>
        </div>
      )}
      {/* Main input container - Claude style */}
      <form onSubmit={onSubmit}>
        <div className="relative bg-gray-50 rounded-xl border border-gray-200 focus-within:border-gray-300 focus-within:shadow-sm transition-all">
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
            className="w-full resize-none border-0 bg-transparent focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 pt-3 pb-14 min-h-[60px] max-h-[120px] text-xs placeholder:text-gray-400 overflow-y-auto"
            rows={1}
          />

          {/* Bottom toolbar inside input */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gray-50 rounded-b-xl">
            {/* Left: Action buttons */}
            <div className="flex items-center gap-1">
              {/* + Menu for attachments */}
              {features.enableFileUploads && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                      disabled={uploadedFiles.length >= 5}
                    >
                      <Plus className="h-4 w-4 text-gray-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem
                      onClick={async () => {
                        if (features.enableEarlySessionCreation && !currentSessionId) {
                          try {
                            await onRequestSession()
                          } catch {
                            return
                          }
                        }
                        fileInputRef.current?.click()
                      }}
                      className="gap-2 text-xs"
                    >
                      <Paperclip className="h-4 w-4" />
                      Upload a file
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-xs text-gray-400" disabled>
                      <Camera className="h-4 w-4" />
                      Take a screenshot
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-xs text-gray-400" disabled>
                      <Folder className="h-4 w-4" />
                      Use a project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Settings/Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <span className="text-xs">Research</span>
                    </div>
                    <Switch
                      checked={researchEnabled}
                      onCheckedChange={onResearchEnabledChange}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center justify-between px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <span className="text-xs">Web search</span>
                    </div>
                    <Switch
                      checked={webSearchEnabled}
                      onCheckedChange={onWebSearchEnabledChange}
                      className="scale-75"
                    />
                  </div>
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
                  : 'bg-purple-100 text-purple-300 cursor-not-allowed'
              }`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>

          {/* Only show loading overlay when actually loading session */}
          {isLoadingSession && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] rounded-xl flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
