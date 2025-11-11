"use client"

import React from 'react';
import { SessionListItem as SessionListItemType } from '@/hooks/use-chat-sessions';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';

export interface SessionListItemProps {
  session: SessionListItemType;
  isActive?: boolean;
  onClick?: () => void;
  onDelete?: (sessionId: string) => void;
}

export function SessionListItem({ session, isActive = false, onClick, onDelete }: SessionListItemProps) {
  // Get last message preview
  const lastMessage = session.messages?.[0];
  const lastMessagePreview = lastMessage?.userText ||
    (lastMessage?.messageType === 'chat_message' ?
      (lastMessage.payload as any)?.text?.substring(0, 60) :
      null);

  // Format timestamp
  const timeAgo = session.lastMessageAt
    ? formatDistanceToNow(new Date(session.lastMessageAt), { addSuffix: true })
    : formatDistanceToNow(new Date(session.createdAt), { addSuffix: true });

  // Get stage indicator
  const stageLabel = getStageLabel(session.currentStage);

  // Handle delete with confirmation
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick

    if (window.confirm(`Delete "${session.title || 'Untitled Session'}"?\n\nThis action cannot be undone.`)) {
      onDelete?.(session.id);
    }
  };

  return (
    <div
      className={`
        relative w-full p-4 rounded-lg transition-all group
        ${isActive ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : 'border-l-4 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'}
      `}
    >
      {/* Clickable session area */}
      <button
        onClick={onClick}
        className="w-full text-left"
      >
        {/* Title */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm line-clamp-1 flex-1">
            {session.title || 'Untitled Session'}
          </h3>
          <div className="flex items-center gap-1">
            {session.isFavorite && (
              <span className="text-yellow-500 text-xs">⭐</span>
            )}
          </div>
        </div>

        {/* Last message preview */}
        {lastMessagePreview && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {lastMessagePreview}...
          </p>
        )}

        {/* Footer: Stage + Timestamp */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${getStageColor(session.currentStage)}`} />
            {stageLabel}
          </span>
          <span>{timeAgo}</span>
        </div>
      </button>

      {/* Delete button (appears on hover) */}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 p-1.5 rounded-md
            bg-white dark:bg-gray-800 shadow-sm
            text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
            opacity-0 group-hover:opacity-100 transition-opacity
            border border-gray-200 dark:border-gray-700"
          title="Delete session"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function getStageLabel(stage: number): string {
  switch (stage) {
    case 1: return 'Starting';
    case 2: return 'Planning';
    case 3: return 'Outlining';
    case 4: return 'Preview Ready';
    case 5: return 'Refining';
    case 6: return 'Complete';
    default: return 'Unknown';
  }
}

function getStageColor(stage: number): string {
  switch (stage) {
    case 1:
    case 2: return 'bg-gray-400';
    case 3: return 'bg-yellow-400';
    case 4: return 'bg-blue-400';
    case 5: return 'bg-purple-400';
    case 6: return 'bg-green-400';
    default: return 'bg-gray-300';
  }
}
