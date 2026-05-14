"use client"

import { useReducedMotion } from "framer-motion"

/**
 * Centralized prefers-reduced-motion gate. Wraps framer-motion's hook so the
 * whole HomepageV2 tree has a single swap point if the implementation needs
 * to change (e.g. switch to a feature flag or user preference).
 */
export function useReducedMotionSafe(): boolean {
  return useReducedMotion() ?? false
}
