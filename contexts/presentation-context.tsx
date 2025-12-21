'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  Slide,
  PresentationMetadata,
  ChatData,
  ProgressInfo,
  DirectorMessage
} from '@/lib/types/websocket-types';
import {
  PresentationPhase,
  AgentStatus,
  PresentationStructure
} from '@/lib/types/director-messages';
import { ContentContext } from '@/components/content-context-form';

// State interface
export interface PresentationState {
  // Session info
  sessionId: string | null;
  presentationId: string | null;

  // Presentation data
  slides: Slide[];
  currentSlideIndex: number;
  presentationMetadata: PresentationMetadata | null;
  structure: PresentationStructure | null;

  // Content context (audience, purpose, time)
  contentContext: ContentContext | null;
  hasGeneratedContent: boolean;

  // Chat and messages
  chatMessages: ChatData[];
  directorMessages: DirectorMessage[];

  // Progress and status
  phase: PresentationPhase | null;
  progress: ProgressInfo | null;
  agentStatuses: AgentStatus[];
  isProcessing: boolean;

  // UI state
  selectedSlideId: string | null;
  editingSlideId: string | null;
  isDirty: boolean;

  // Error state
  error: string | null;
}

// Initial state
const initialState: PresentationState = {
  sessionId: null,
  presentationId: null,
  slides: [],
  currentSlideIndex: 0,
  presentationMetadata: null,
  structure: null,
  contentContext: null,
  hasGeneratedContent: false,
  chatMessages: [],
  directorMessages: [],
  phase: null,
  progress: null,
  agentStatuses: [],
  isProcessing: false,
  selectedSlideId: null,
  editingSlideId: null,
  isDirty: false,
  error: null
};

// Action types
export type PresentationAction =
  | { type: 'SET_SESSION'; payload: { sessionId: string; presentationId?: string } }
  | { type: 'SET_PRESENTATION_ID'; payload: string }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatData }
  | { type: 'ADD_DIRECTOR_MESSAGE'; payload: DirectorMessage }
  | { type: 'UPDATE_SLIDES'; payload: { slides: Slide[]; metadata?: PresentationMetadata } }
  | { type: 'UPDATE_SLIDE'; payload: { slideId: string; updates: Partial<Slide> } }
  | { type: 'SET_CURRENT_SLIDE'; payload: number }
  | { type: 'SET_STRUCTURE'; payload: PresentationStructure }
  | { type: 'SET_CONTENT_CONTEXT'; payload: ContentContext }
  | { type: 'SET_HAS_GENERATED_CONTENT'; payload: boolean }
  | { type: 'UPDATE_PROGRESS'; payload: ProgressInfo }
  | { type: 'UPDATE_PHASE'; payload: PresentationPhase }
  | { type: 'UPDATE_AGENT_STATUS'; payload: AgentStatus }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SELECT_SLIDE'; payload: string | null }
  | { type: 'EDIT_SLIDE'; payload: string | null }
  | { type: 'SET_DIRTY'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' }
  | { type: 'RESTORE_STATE'; payload: Partial<PresentationState> };

// Reducer
function presentationReducer(
  state: PresentationState,
  action: PresentationAction
): PresentationState {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        sessionId: action.payload.sessionId,
        presentationId: action.payload.presentationId || state.presentationId
      };

    case 'SET_PRESENTATION_ID':
      return {
        ...state,
        presentationId: action.payload
      };

    case 'ADD_CHAT_MESSAGE':
      // Round 24 Fix: Improved deduplication logic that handles missing IDs
      const messageExists = state.chatMessages.some(msg => {
        // Only check ID-based duplicates if BOTH have IDs
        if (msg.id && action.payload.id) {
          return msg.id === action.payload.id;
        }
        
        // For messages without IDs, check content + timestamp + type
        // This prevents the undefined === undefined issue
        return msg.content?.message === action.payload.content?.message && 
               msg.timestamp === action.payload.timestamp &&
               msg.type === action.payload.type;
      });
      
      if (messageExists) {
        console.log('[Round 24 Fix] Duplicate message detected, skipping:', {
          messageId: action.payload.id,
          hasId: !!action.payload.id,
          content: action.payload.content?.message?.substring(0, 50) + '...',
          type: action.payload.type
        });
        return state; // Don't add duplicate
      }
      
      console.log('[Round 24 Fix] Adding new chat message:', {
        messageId: action.payload.id,
        hasId: !!action.payload.id,
        currentCount: state.chatMessages.length,
        totalAfterAdd: state.chatMessages.length + 1
      });
      
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload]
      };

    case 'ADD_DIRECTOR_MESSAGE':
      return {
        ...state,
        directorMessages: [...state.directorMessages, action.payload]
      };

    case 'UPDATE_SLIDES':
      return {
        ...state,
        slides: action.payload.slides,
        presentationMetadata: action.payload.metadata || state.presentationMetadata,
        isDirty: true
      };

    case 'UPDATE_SLIDE':
      return {
        ...state,
        slides: (state.slides || []).map(slide =>
          slide.slide_id === action.payload.slideId
            ? { ...slide, ...action.payload.updates }
            : slide
        ),
        isDirty: true
      };

    case 'SET_CURRENT_SLIDE':
      return {
        ...state,
        currentSlideIndex: action.payload
      };

    case 'SET_STRUCTURE':
      return {
        ...state,
        structure: action.payload
      };

    case 'SET_CONTENT_CONTEXT':
      return {
        ...state,
        contentContext: action.payload
      };

    case 'SET_HAS_GENERATED_CONTENT':
      return {
        ...state,
        hasGeneratedContent: action.payload
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.payload
      };

    case 'UPDATE_PHASE':
      return {
        ...state,
        phase: action.payload
      };

    case 'UPDATE_AGENT_STATUS':
      return {
        ...state,
        agentStatuses: state.agentStatuses.map(agent =>
          agent.agentId === action.payload.agentId
            ? action.payload
            : agent
        ).concat(
          state.agentStatuses.find(a => a.agentId === action.payload.agentId)
            ? []
            : [action.payload]
        )
      };

    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload
      };

    case 'SELECT_SLIDE':
      return {
        ...state,
        selectedSlideId: action.payload
      };

    case 'EDIT_SLIDE':
      return {
        ...state,
        editingSlideId: action.payload
      };

    case 'SET_DIRTY':
      return {
        ...state,
        isDirty: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };

    case 'RESET_STATE':
      return initialState;

    case 'RESTORE_STATE':
      return {
        ...state,
        ...action.payload
      };

    default:
      return state;
  }
}

// Context
const PresentationContext = createContext<{
  state: PresentationState;
  dispatch: React.Dispatch<PresentationAction>;
} | undefined>(undefined);

// Provider component
export function PresentationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(presentationReducer, initialState);

  return (
    <PresentationContext.Provider value={{ state, dispatch }}>
      {children}
    </PresentationContext.Provider>
  );
}

// Custom hook to use the context
export function usePresentation() {
  const context = useContext(PresentationContext);
  if (context === undefined) {
    throw new Error('usePresentation must be used within a PresentationProvider');
  }
  return context;
}

// Selector hooks for common state selections
export function usePresentationSlides() {
  const { state } = usePresentation();
  return state.slides;
}

export function useCurrentSlide() {
  const { state } = usePresentation();
  return (state.slides && Array.isArray(state.slides) && state.slides[state.currentSlideIndex]) || null;
}

export function usePresentationPhase() {
  const { state } = usePresentation();
  return state.phase;
}

export function usePresentationProgress() {
  const { state } = usePresentation();
  return state.progress;
}

export function useChatMessages() {
  const { state } = usePresentation();
  return state.chatMessages;
}

export function useContentContext() {
  const { state } = usePresentation();
  return state.contentContext;
}

export function useHasGeneratedContent() {
  const { state } = usePresentation();
  return state.hasGeneratedContent;
}