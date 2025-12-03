import { NextRequest, NextResponse } from 'next/server'

/**
 * Mock AI Infographic Generation API
 *
 * TODO: Replace with actual AI infographic generation service
 */

// SVG templates for different infographic types
const INFOGRAPHIC_TEMPLATES: Record<string, (prompt: string) => string> = {
  timeline: (prompt) => `
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="timelineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#3b82f6"/>
          <stop offset="100%" style="stop-color:#8b5cf6"/>
        </linearGradient>
      </defs>
      <!-- Timeline line -->
      <line x1="50" y1="200" x2="750" y2="200" stroke="url(#timelineGrad)" stroke-width="4"/>
      <!-- Points -->
      <circle cx="150" cy="200" r="12" fill="#3b82f6"/>
      <circle cx="300" cy="200" r="12" fill="#10b981"/>
      <circle cx="450" cy="200" r="12" fill="#f59e0b"/>
      <circle cx="600" cy="200" r="12" fill="#ef4444"/>
      <!-- Labels -->
      <text x="150" y="240" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Phase 1</text>
      <text x="300" y="240" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Phase 2</text>
      <text x="450" y="240" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Phase 3</text>
      <text x="600" y="240" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Phase 4</text>
      <!-- Title -->
      <text x="400" y="60" text-anchor="middle" fill="#111827" font-size="20" font-weight="bold" font-family="system-ui">${escapeXml(prompt.slice(0, 40))}</text>
    </svg>
  `,

  process: (prompt) => `
    <svg viewBox="0 0 800 300" xmlns="http://www.w3.org/2000/svg">
      <!-- Process boxes -->
      <rect x="50" y="100" width="150" height="100" rx="8" fill="#3b82f6"/>
      <rect x="250" y="100" width="150" height="100" rx="8" fill="#10b981"/>
      <rect x="450" y="100" width="150" height="100" rx="8" fill="#f59e0b"/>
      <rect x="650" y="100" width="100" height="100" rx="8" fill="#ef4444"/>
      <!-- Arrows -->
      <polygon points="210,150 230,140 230,160" fill="#6b7280"/>
      <polygon points="410,150 430,140 430,160" fill="#6b7280"/>
      <polygon points="610,150 630,140 630,160" fill="#6b7280"/>
      <!-- Labels -->
      <text x="125" y="155" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Step 1</text>
      <text x="325" y="155" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Step 2</text>
      <text x="525" y="155" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Step 3</text>
      <text x="700" y="155" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Done</text>
      <!-- Title -->
      <text x="400" y="50" text-anchor="middle" fill="#111827" font-size="18" font-weight="bold" font-family="system-ui">${escapeXml(prompt.slice(0, 40))}</text>
    </svg>
  `,

  statistics: (prompt) => `
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
      <!-- Stat boxes -->
      <rect x="50" y="100" width="160" height="160" rx="12" fill="#3b82f6"/>
      <rect x="230" y="100" width="160" height="160" rx="12" fill="#10b981"/>
      <rect x="410" y="100" width="160" height="160" rx="12" fill="#f59e0b"/>
      <rect x="590" y="100" width="160" height="160" rx="12" fill="#8b5cf6"/>
      <!-- Numbers -->
      <text x="130" y="175" text-anchor="middle" fill="white" font-size="42" font-weight="bold" font-family="system-ui">85%</text>
      <text x="310" y="175" text-anchor="middle" fill="white" font-size="42" font-weight="bold" font-family="system-ui">2.5M</text>
      <text x="490" y="175" text-anchor="middle" fill="white" font-size="42" font-weight="bold" font-family="system-ui">147</text>
      <text x="670" y="175" text-anchor="middle" fill="white" font-size="42" font-weight="bold" font-family="system-ui">99%</text>
      <!-- Labels -->
      <text x="130" y="220" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Growth</text>
      <text x="310" y="220" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Users</text>
      <text x="490" y="220" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Countries</text>
      <text x="670" y="220" text-anchor="middle" fill="white" font-size="14" font-family="system-ui">Uptime</text>
      <!-- Title -->
      <text x="400" y="50" text-anchor="middle" fill="#111827" font-size="20" font-weight="bold" font-family="system-ui">${escapeXml(prompt.slice(0, 40))}</text>
    </svg>
  `,

  comparison: (prompt) => `
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
      <!-- Left side -->
      <rect x="50" y="80" width="340" height="280" rx="12" fill="#3b82f6" fill-opacity="0.1" stroke="#3b82f6" stroke-width="2"/>
      <text x="220" y="130" text-anchor="middle" fill="#3b82f6" font-size="24" font-weight="bold" font-family="system-ui">Option A</text>
      <text x="220" y="180" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Feature 1 included</text>
      <text x="220" y="210" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Feature 2 included</text>
      <text x="220" y="240" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">24/7 Support</text>
      <!-- Right side -->
      <rect x="410" y="80" width="340" height="280" rx="12" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="2"/>
      <text x="580" y="130" text-anchor="middle" fill="#10b981" font-size="24" font-weight="bold" font-family="system-ui">Option B</text>
      <text x="580" y="180" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">All features included</text>
      <text x="580" y="210" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Priority support</text>
      <text x="580" y="240" text-anchor="middle" fill="#374151" font-size="14" font-family="system-ui">Custom integration</text>
      <!-- VS -->
      <circle cx="400" cy="220" r="30" fill="#6b7280"/>
      <text x="400" y="228" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="system-ui">VS</text>
      <!-- Title -->
      <text x="400" y="40" text-anchor="middle" fill="#111827" font-size="20" font-weight="bold" font-family="system-ui">${escapeXml(prompt.slice(0, 40))}</text>
    </svg>
  `,

  hierarchy: (prompt) => `
    <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
      <!-- Top level -->
      <rect x="325" y="30" width="150" height="60" rx="8" fill="#3b82f6"/>
      <text x="400" y="68" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="system-ui">CEO</text>
      <!-- Lines -->
      <line x1="400" y1="90" x2="400" y2="130" stroke="#6b7280" stroke-width="2"/>
      <line x1="150" y1="130" x2="650" y2="130" stroke="#6b7280" stroke-width="2"/>
      <line x1="150" y1="130" x2="150" y2="160" stroke="#6b7280" stroke-width="2"/>
      <line x1="400" y1="130" x2="400" y2="160" stroke="#6b7280" stroke-width="2"/>
      <line x1="650" y1="130" x2="650" y2="160" stroke="#6b7280" stroke-width="2"/>
      <!-- Second level -->
      <rect x="75" y="160" width="150" height="50" rx="6" fill="#10b981"/>
      <rect x="325" y="160" width="150" height="50" rx="6" fill="#10b981"/>
      <rect x="575" y="160" width="150" height="50" rx="6" fill="#10b981"/>
      <text x="150" y="192" text-anchor="middle" fill="white" font-size="12" font-family="system-ui">Engineering</text>
      <text x="400" y="192" text-anchor="middle" fill="white" font-size="12" font-family="system-ui">Marketing</text>
      <text x="650" y="192" text-anchor="middle" fill="white" font-size="12" font-family="system-ui">Sales</text>
      <!-- Third level lines -->
      <line x1="150" y1="210" x2="150" y2="250" stroke="#6b7280" stroke-width="2"/>
      <line x1="400" y1="210" x2="400" y2="250" stroke="#6b7280" stroke-width="2"/>
      <line x1="650" y1="210" x2="650" y2="250" stroke="#6b7280" stroke-width="2"/>
      <!-- Third level -->
      <rect x="75" y="250" width="150" height="40" rx="4" fill="#f59e0b"/>
      <rect x="325" y="250" width="150" height="40" rx="4" fill="#f59e0b"/>
      <rect x="575" y="250" width="150" height="40" rx="4" fill="#f59e0b"/>
      <text x="150" y="277" text-anchor="middle" fill="white" font-size="11" font-family="system-ui">Team Lead</text>
      <text x="400" y="277" text-anchor="middle" fill="white" font-size="11" font-family="system-ui">Team Lead</text>
      <text x="650" y="277" text-anchor="middle" fill="white" font-size="11" font-family="system-ui">Team Lead</text>
    </svg>
  `,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, type = 'statistics', elementId } = body

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 700))

    // Get template generator
    const generator = INFOGRAPHIC_TEMPLATES[type] || INFOGRAPHIC_TEMPLATES.statistics
    const svgContent = generator(prompt)

    console.log(`[AI Infographic] Generated ${type} for: "${prompt.slice(0, 50)}..."`)

    return NextResponse.json({
      success: true,
      result: {
        svgContent,
        type,
        prompt
      }
    })
  } catch (error) {
    console.error('[AI Infographic] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate infographic' },
      { status: 500 }
    )
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
