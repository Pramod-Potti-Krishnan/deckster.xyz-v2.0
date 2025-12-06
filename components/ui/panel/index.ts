// Panel Design System Components
// A Keynote-inspired component library for format panels

export { PanelSection } from './section'
export { ControlRow } from './control-row'
export { ButtonGroup } from './button-group'
export { Toggle } from './toggle'
export { Stepper } from './stepper'
export { PanelInput } from './input'
export { PanelSelect } from './select'
export { Divider } from './divider'
export { IconButton } from './icon-button'

// Design Tokens (for reference)
export const PANEL_TOKENS = {
  spacing: {
    xs: '4px',   // space-1: tight internal
    sm: '8px',   // space-2: component internal
    md: '12px',  // space-3: between controls
    lg: '16px',  // space-4: section padding
    xl: '20px',  // space-5: section gaps
  },
  heights: {
    control: '28px',  // Standard control height
    toggle: '20px',   // Toggle switch height
    header: '44px',   // Panel header height
    tab: '32px',      // Tab container height
  },
  typography: {
    '2xs': '9px',   // Helper text
    xs: '10px',     // Labels, hints
    sm: '11px',     // Controls, buttons
    md: '12px',     // Primary content
    lg: '13px',     // Section titles
  },
} as const
