"use client"

import { useState, useEffect, useCallback } from 'react'
import { X, RotateCcw, Clock, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Version {
  version_id: string
  created_at: string
  created_by: string
  change_summary?: string
  presentation_id: string
}

interface VersionHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  viewerOrigin: string
}

export function VersionHistoryPanel({
  isOpen,
  onClose,
  iframeRef,
  viewerOrigin
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [currentVersionId, setCurrentVersionId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch versions when panel opens
  const fetchVersions = useCallback(() => {
    if (!iframeRef.current) {
      setError('Presentation not ready')
      return
    }

    setLoading(true)
    setError(null)

    iframeRef.current.contentWindow?.postMessage({
      command: 'getVersionHistory'
    }, viewerOrigin)
  }, [iframeRef, viewerOrigin])

  // Fetch versions when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchVersions()
    }
  }, [isOpen, fetchVersions])

  // Listen for postMessage responses
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from viewer origin
      if (event.origin !== viewerOrigin) return

      const { command, success, error: errorMsg } = event.data

      if (command === 'getVersionHistory') {
        setLoading(false)
        if (success) {
          setVersions(event.data.versions || [])
          setCurrentVersionId(event.data.currentVersionId || '')
          setError(null)
        } else {
          setError(errorMsg || 'Failed to fetch versions')
        }
      }

      if (command === 'restoreVersion') {
        setRestoring(null)
        if (!success) {
          setError(errorMsg || 'Failed to restore version')
        }
        // Note: Page will reload on success if reload=true was set
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [viewerOrigin])

  const handleRestore = useCallback((versionId: string) => {
    if (versionId === currentVersionId) {
      return
    }

    if (!confirm('Restore this version? Current state will be backed up.')) {
      return
    }

    if (!iframeRef.current) {
      setError('Presentation not ready')
      return
    }

    setRestoring(versionId)
    setError(null)

    iframeRef.current.contentWindow?.postMessage({
      command: 'restoreVersion',
      params: {
        versionId,
        createBackup: true,
        reload: true
      }
    }, viewerOrigin)
  }, [iframeRef, viewerOrigin, currentVersionId])

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Relative time for recent versions
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    // Full date for older versions
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getAuthorLabel = (createdBy: string) => {
    switch (createdBy) {
      case 'user':
        return 'Manual save'
      case 'auto-save':
        return 'Auto-saved'
      case 'system':
        return 'System'
      case 'restore':
        return 'Restored backup'
      default:
        return createdBy
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600" />
          <h2 className="text-sm font-semibold text-gray-800">Version History</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
          title="Close"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading versions...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchVersions}
              className="mt-2 text-xs text-red-700 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Version list */}
        {!loading && versions.length > 0 && (
          <div className="divide-y divide-gray-100">
            {versions.map((version, index) => {
              const isCurrent = version.version_id === currentVersionId
              const isRestoring = restoring === version.version_id

              return (
                <div
                  key={version.version_id}
                  className={cn(
                    "px-4 py-3 transition-colors",
                    isCurrent ? "bg-blue-50" : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Time and badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {formatDate(version.created_at)}
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">
                            Current
                          </span>
                        )}
                      </div>

                      {/* Author */}
                      <div className="flex items-center gap-1 mt-1">
                        <User className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {getAuthorLabel(version.created_by)}
                        </span>
                      </div>

                      {/* Summary if available */}
                      {version.change_summary && (
                        <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                          {version.change_summary}
                        </p>
                      )}
                    </div>

                    {/* Restore button */}
                    {!isCurrent && (
                      <button
                        onClick={() => handleRestore(version.version_id)}
                        disabled={isRestoring}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                          isRestoring
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        )}
                        title="Restore this version"
                      >
                        {isRestoring ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && versions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Clock className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No version history available</p>
            <p className="text-xs text-gray-400 mt-1">
              Versions are created when you save changes
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500">
          Restoring a version creates a backup of your current state first.
        </p>
      </div>
    </div>
  )
}
