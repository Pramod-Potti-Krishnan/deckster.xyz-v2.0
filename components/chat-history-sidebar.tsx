"use client"

import React, { useState, useEffect } from 'react';
import { X, Plus, Search, CheckSquare, Trash2, Check } from 'lucide-react';
import { useChatSessions, SessionListItem as SessionType } from '@/hooks/use-chat-sessions';
import { SessionListItem } from './session-list-item';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

export interface ChatHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

export function ChatHistorySidebar({
  isOpen,
  onClose,
  currentSessionId,
  onSessionSelect,
  onNewChat
}: ChatHistorySidebarProps) {
  const { loadSessions, deleteSession, loading } = useChatSessions();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [totalSessionCount, setTotalSessionCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState({ current: 0, total: 0 });

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deletionSummary, setDeletionSummary] = useState({ count: 0 });

  // Load sessions when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadSessionsData();
    }
  }, [isOpen]);

  const loadSessionsData = async () => {
    const result = await loadSessions({ limit: 50, status: 'active' });
    if (result) {
      setSessions(result.sessions);
      setTotalSessionCount(result.pagination?.total || result.sessions.length);
    }
  };

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    const success = await deleteSession(sessionId);
    if (success) {
      // Clear sessionStorage cache for deleted session
      try {
        sessionStorage.removeItem(`deckster_session_${sessionId}`);
        sessionStorage.removeItem(`deckster_metadata_${sessionId}`);
        console.log(`🗑️ Cleared sessionStorage cache for deleted session: ${sessionId}`);
      } catch (error) {
        console.error('❌ Failed to clear sessionStorage:', error);
      }

      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));

      // If we deleted the current session, navigate to new chat
      if (sessionId === currentSessionId) {
        onNewChat();
      }

      // Show success toast
      toast({
        title: "Session deleted",
        description: "The session has been successfully deleted.",
      });
    } else {
      toast({
        title: "Delete failed",
        description: "Failed to delete session. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      // Exiting selection mode - clear selections
      setSelectedIds(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  // Handle individual session selection
  const handleSelectionChange = (sessionId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(sessionId);
      } else {
        newSet.delete(sessionId);
      }
      return newSet;
    });
  };

  // Select all visible (filtered) sessions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredSessions.map(s => s.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    setIsDeletingBulk(true);
    const idsToDelete = Array.from(selectedIds);
    let successCount = 0;
    let failedCount = 0;

    // Initialize progress tracking
    setDeletionProgress({ current: 0, total: idsToDelete.length });

    try {
      // Delete each session
      for (let i = 0; i < idsToDelete.length; i++) {
        const sessionId = idsToDelete[i];

        // Update progress before each deletion
        setDeletionProgress({ current: i + 1, total: idsToDelete.length });

        const success = await deleteSession(sessionId);
        if (success) {
          // Clear sessionStorage cache for deleted session
          try {
            sessionStorage.removeItem(`deckster_session_${sessionId}`);
            sessionStorage.removeItem(`deckster_metadata_${sessionId}`);
            console.log(`🗑️ Cleared sessionStorage cache for deleted session: ${sessionId}`);
          } catch (error) {
            console.error('❌ Failed to clear sessionStorage:', error);
          }
          successCount++;
        } else {
          failedCount++;
        }
      }

      // Update local state - remove successfully deleted sessions
      setSessions(prev => prev.filter(s => !selectedIds.has(s.id) || failedCount > 0));

      // If current session was deleted, navigate to new chat
      if (currentSessionId && selectedIds.has(currentSessionId)) {
        onNewChat();
      }

      // Clear selections and exit selection mode
      setSelectedIds(new Set());
      setIsSelectionMode(false);
      setShowBulkDeleteModal(false);

      // Show success modal instead of toast
      setDeletionSummary({ count: successCount });
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Delete failed",
        description: "An error occurred while deleting sessions.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.title?.toLowerCase().includes(query) ||
      session.messages?.[0]?.userText?.toLowerCase().includes(query)
    );
  });

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-900
          shadow-2xl z-50 transform transition-transform duration-300 ease-in-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xs font-semibold text-gray-900">Chat History</h2>
          <div className="flex items-center gap-2">
            {/* Select Mode Toggle */}
            <Button
              onClick={toggleSelectionMode}
              variant={isSelectionMode ? "default" : "ghost"}
              size="sm"
              className="h-6 text-[10px] px-2"
            >
              <CheckSquare className="w-3 h-3 mr-1" />
              {isSelectionMode ? 'Cancel' : 'Select'}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <Button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full h-7 text-[11px]"
            size="sm"
          >
            <Plus className="w-3 h-3 mr-1.5" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          {isSelectionMode ? (
            /* Select All Checkbox - visible in selection mode */
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={filteredSessions.length > 0 && selectedIds.size === filteredSessions.length}
                onCheckedChange={handleSelectAll}
                id="select-all"
              />
              <label
                htmlFor="select-all"
                className="text-[11px] font-medium cursor-pointer select-none"
              >
                Select All Visible ({selectedIds.size}/{filteredSessions.length})
              </label>
            </div>
          ) : (
            /* Search Input - visible in normal mode */
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-7 text-[11px]"
              />
            </div>
          )}
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-1.5">
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-[11px]">
              Loading sessions...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 text-center px-4">
              {searchQuery ? (
                <>
                  <p className="text-[11px]">No sessions found</p>
                  <p className="text-[10px] mt-1">Try a different search term</p>
                </>
              ) : (
                <>
                  <p className="text-[11px]">No chat history yet</p>
                  <p className="text-[10px] mt-1">Start a new chat to begin</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredSessions.map(session => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  onClick={() => {
                    onSessionSelect(session.id);
                    onClose();
                  }}
                  onDelete={handleDeleteSession}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(session.id)}
                  onSelectionChange={handleSelectionChange}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bulk Action Bar - appears when items selected */}
        {isSelectionMode && selectedIds.size > 0 && (
          <div className="px-3 py-2 border-t-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                {selectedIds.size} selected
              </p>
              <Button
                onClick={() => setShowBulkDeleteModal(true)}
                variant="destructive"
                size="sm"
                className="h-7 text-[11px]"
              >
                <Trash2 className="w-3 h-3 mr-1.5" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-[10px] text-gray-500 text-center">
            {sessions.length < totalSessionCount ? (
              <>Showing {sessions.length} of {totalSessionCount} sessions</>
            ) : (
              <>{filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}</>
            )}
          </p>
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={showBulkDeleteModal}
        onOpenChange={setShowBulkDeleteModal}
        onConfirm={handleBulkDelete}
        sessionTitles={Array.from(selectedIds).map(id => {
          const session = sessions.find(s => s.id === id);
          return session?.title || 'Untitled Session';
        })}
        isDeleting={isDeletingBulk}
        deletionProgress={deletionProgress}
      />

      {/* Success Modal */}
      <AlertDialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-2">
                <Check className="h-5 w-5 text-green-600 dark:text-green-500" />
              </div>
              <AlertDialogTitle>Sessions Deleted</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              Successfully deleted {deletionSummary.count} session{deletionSummary.count !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSuccessModal(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
