"use client"

// PASS2-PK-FOUR item 4: the only module the existing surfaces import for the template workspace. Flag
// NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE (exact "true", Studio shell only), default off.
// Each part is loaded lazily, and only when the flag is on AT BUILD TIME: the literal checks below let the bundler drop the imports, so
// a build with the flag off carries none of the workspace's code or CSS, and every export is a component that renders nothing.
// The call sites guard with the same flag as well, so with the flag off nothing here is even rendered.
import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import type { StudioTemplatePickerProps } from './picker'

const Nothing = () => null

export const StudioTemplateWorkspaceHeading: ComponentType =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'
    ? dynamic(() => import('./header').then(mod => mod.StudioTemplateWorkspaceHeading), { ssr: false })
    : Nothing

/** The top bar's actions slot; it also hosts the workspace itself (over the builder's stage) and the "Template ready" toasts. */
export const StudioTemplateWorkspaceHeaderActions: ComponentType =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'
    ? dynamic(() => import('./header').then(mod => mod.StudioTemplateWorkspaceHeaderActions), { ssr: false })
    : Nothing

export const StudioTemplatePicker: ComponentType<StudioTemplatePickerProps> =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'
    ? dynamic(() => import('./picker').then(mod => mod.StudioTemplatePicker), { ssr: false })
    : Nothing

export const StudioTemplateWorkspaceLibrary: ComponentType =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE === 'true'
    ? dynamic(() => import('./library').then(mod => mod.StudioTemplateWorkspaceLibrary), { ssr: false })
    : Nothing
