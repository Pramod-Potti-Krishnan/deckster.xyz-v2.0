"use client"

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { Users, Target, Clock } from 'lucide-react'

// ============================================================================
// Type Definitions
// ============================================================================

export type AudienceType =
  | 'kids_young'      // Ages 6-10
  | 'kids_older'      // Ages 10-14
  | 'high_school'     // Ages 14-18
  | 'college'         // Ages 18-22
  | 'professional'    // Working professionals
  | 'executive'       // C-suite, leadership

export type PurposeType =
  | 'inform'          // Share information
  | 'educate'         // Teach concepts
  | 'persuade'        // Convince/sell
  | 'entertain'       // Engage/amuse
  | 'inspire'         // Motivate/uplift
  | 'report'          // Present findings

export interface ContentContext {
  audience_type: AudienceType
  purpose_type: PurposeType
  duration_minutes: number
}

export interface ContentContextFormProps {
  value: ContentContext
  onChange: (context: ContentContext) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}

// ============================================================================
// Configuration
// ============================================================================

export const DEFAULT_CONTENT_CONTEXT: ContentContext = {
  audience_type: 'professional',
  purpose_type: 'inform',
  duration_minutes: 15
}

const AUDIENCE_OPTIONS: { value: AudienceType; label: string; description: string; icon: string }[] = [
  { value: 'kids_young', label: 'Kids (6-10)', description: 'Simple words, fun tone', icon: '🧒' },
  { value: 'kids_older', label: 'Kids (10-14)', description: 'Age-appropriate, engaging', icon: '👦' },
  { value: 'high_school', label: 'High School', description: 'Educational, relatable', icon: '🎓' },
  { value: 'college', label: 'College', description: 'Academic, detailed', icon: '📚' },
  { value: 'professional', label: 'Professionals', description: 'Business-appropriate', icon: '👔' },
  { value: 'executive', label: 'Executives', description: 'Concise, data-driven', icon: '💼' },
]

const PURPOSE_OPTIONS: { value: PurposeType; label: string; description: string; icon: string }[] = [
  { value: 'inform', label: 'Inform', description: 'Share facts and updates', icon: '📋' },
  { value: 'educate', label: 'Educate', description: 'Teach new concepts', icon: '📖' },
  { value: 'persuade', label: 'Persuade', description: 'Convince or sell', icon: '🎯' },
  { value: 'entertain', label: 'Entertain', description: 'Engage and amuse', icon: '🎭' },
  { value: 'inspire', label: 'Inspire', description: 'Motivate action', icon: '✨' },
  { value: 'report', label: 'Report', description: 'Present findings', icon: '📊' },
]

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60]

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }
  return '60+ min'
}

function getAudienceOption(value: AudienceType) {
  return AUDIENCE_OPTIONS.find(opt => opt.value === value)
}

function getPurposeOption(value: PurposeType) {
  return PURPOSE_OPTIONS.find(opt => opt.value === value)
}

// ============================================================================
// Main Component
// ============================================================================

export function ContentContextForm({
  value,
  onChange,
  disabled = false,
  compact = false,
  className,
}: ContentContextFormProps) {
  const handleAudienceChange = (audience_type: AudienceType) => {
    onChange({ ...value, audience_type })
  }

  const handlePurposeChange = (purpose_type: PurposeType) => {
    onChange({ ...value, purpose_type })
  }

  const handleDurationChange = (values: number[]) => {
    onChange({ ...value, duration_minutes: values[0] })
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Audience Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <Label className={cn("text-sm font-medium", compact && "text-xs")}>
            Who is your audience?
          </Label>
        </div>
        <Select
          value={value.audience_type}
          onValueChange={(v) => handleAudienceChange(v as AudienceType)}
          disabled={disabled}
        >
          <SelectTrigger className={cn("w-full", compact && "h-9")}>
            <SelectValue>
              {getAudienceOption(value.audience_type) && (
                <span className="flex items-center gap-2">
                  <span>{getAudienceOption(value.audience_type)?.icon}</span>
                  <span>{getAudienceOption(value.audience_type)?.label}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <span>{option.icon}</span>
                  <div>
                    <div className="font-medium">{option.label}</div>
                    {!compact && (
                      <div className="text-xs text-gray-500">{option.description}</div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Purpose Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-500" />
          <Label className={cn("text-sm font-medium", compact && "text-xs")}>
            What&apos;s the purpose?
          </Label>
        </div>
        <Select
          value={value.purpose_type}
          onValueChange={(v) => handlePurposeChange(v as PurposeType)}
          disabled={disabled}
        >
          <SelectTrigger className={cn("w-full", compact && "h-9")}>
            <SelectValue>
              {getPurposeOption(value.purpose_type) && (
                <span className="flex items-center gap-2">
                  <span>{getPurposeOption(value.purpose_type)?.icon}</span>
                  <span>{getPurposeOption(value.purpose_type)?.label}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PURPOSE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <span>{option.icon}</span>
                  <div>
                    <div className="font-medium">{option.label}</div>
                    {!compact && (
                      <div className="text-xs text-gray-500">{option.description}</div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Duration Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <Label className={cn("text-sm font-medium", compact && "text-xs")}>
              Presentation length
            </Label>
          </div>
          <span className={cn(
            "font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded",
            compact ? "text-xs" : "text-sm"
          )}>
            {formatDuration(value.duration_minutes)}
          </span>
        </div>

        <Slider
          value={[value.duration_minutes]}
          onValueChange={handleDurationChange}
          min={5}
          max={60}
          step={5}
          disabled={disabled}
          className="w-full"
        />

        {!compact && (
          <div className="flex justify-between text-xs text-gray-400">
            <span>5 min</span>
            <span>30 min</span>
            <span>60 min</span>
          </div>
        )}

        {/* Quick presets */}
        {!compact && (
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => onChange({ ...value, duration_minutes: preset })}
                disabled={disabled}
                className={cn(
                  "px-2 py-1 text-xs rounded-md transition-colors",
                  value.duration_minutes === preset
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {preset} min
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Display Components (for showing current context)
// ============================================================================

interface ContentContextDisplayProps {
  context: ContentContext
  className?: string
}

export function ContentContextDisplay({ context, className }: ContentContextDisplayProps) {
  const audience = getAudienceOption(context.audience_type)
  const purpose = getPurposeOption(context.purpose_type)

  return (
    <div className={cn("flex items-center gap-3 text-sm", className)}>
      <span className="flex items-center gap-1">
        {audience?.icon} {audience?.label}
      </span>
      <span className="text-gray-300">|</span>
      <span className="flex items-center gap-1">
        {purpose?.icon} {purpose?.label}
      </span>
      <span className="text-gray-300">|</span>
      <span className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" /> {formatDuration(context.duration_minutes)}
      </span>
    </div>
  )
}

export function ContentContextSummary({ context, className }: ContentContextDisplayProps) {
  const audience = getAudienceOption(context.audience_type)
  const purpose = getPurposeOption(context.purpose_type)

  return (
    <div className={cn("text-sm text-gray-600", className)}>
      {audience?.label}, {purpose?.label}, {formatDuration(context.duration_minutes)}
    </div>
  )
}
