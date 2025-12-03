import { NextRequest, NextResponse } from 'next/server'

/**
 * Mock AI Chart Data Generation API
 *
 * TODO: Replace with actual AI data generation service
 */

// Chart color palettes
const CHART_PALETTES: Record<string, string[]> = {
  default: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
  professional: ['#1e3a5f', '#3d5a80', '#98c1d9', '#e0fbfc', '#ee6c4d'],
  vibrant: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
  pastel: ['#a8d8ea', '#aa96da', '#fcbad3', '#ffffd2', '#b5ead7'],
  monochrome: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560'],
}

// Sample data generators for different chart types
const SAMPLE_DATA_GENERATORS: Record<string, (prompt: string, colors: string[]) => any> = {
  bar: (prompt, colors) => ({
    type: 'bar',
    data: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [{
        label: prompt.slice(0, 30),
        data: [randomValue(), randomValue(), randomValue(), randomValue()],
        backgroundColor: colors.slice(0, 4),
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        title: { display: true, text: prompt.slice(0, 40) }
      }
    }
  }),

  line: (prompt, colors) => ({
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: prompt.slice(0, 30),
        data: generateTrendData(6),
        borderColor: colors[0],
        backgroundColor: colors[0] + '33',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    }
  }),

  pie: (prompt, colors) => ({
    type: 'pie',
    data: {
      labels: ['Category A', 'Category B', 'Category C', 'Category D'],
      datasets: [{
        data: [randomValue(), randomValue(), randomValue(), randomValue()],
        backgroundColor: colors.slice(0, 4),
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: prompt.slice(0, 40) }
      }
    }
  }),

  doughnut: (prompt, colors) => ({
    type: 'doughnut',
    data: {
      labels: ['Segment 1', 'Segment 2', 'Segment 3', 'Segment 4', 'Segment 5'],
      datasets: [{
        data: [randomValue(), randomValue(), randomValue(), randomValue(), randomValue()],
        backgroundColor: colors.slice(0, 5),
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    }
  }),
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, chartType = 'bar', colorPalette = 'default', elementId } = body

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 600))

    // Get colors
    const colors = CHART_PALETTES[colorPalette] || CHART_PALETTES.default

    // Generate chart config
    const generator = SAMPLE_DATA_GENERATORS[chartType] || SAMPLE_DATA_GENERATORS.bar
    const chartConfig = generator(prompt, colors)

    console.log(`[AI Chart] Generated ${chartType} chart for: "${prompt.slice(0, 50)}..."`)

    return NextResponse.json({
      success: true,
      result: {
        chartConfig,
        chartType,
        colorPalette
      }
    })
  } catch (error) {
    console.error('[AI Chart] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate chart data' },
      { status: 500 }
    )
  }
}

function randomValue(): number {
  return Math.floor(Math.random() * 90) + 10
}

function generateTrendData(count: number): number[] {
  const data: number[] = []
  let value = Math.floor(Math.random() * 50) + 25
  for (let i = 0; i < count; i++) {
    value = Math.max(10, Math.min(100, value + (Math.random() - 0.4) * 20))
    data.push(Math.floor(value))
  }
  return data
}
