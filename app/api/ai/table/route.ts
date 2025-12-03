import { NextRequest, NextResponse } from 'next/server'

/**
 * Mock AI Table Data Generation API
 *
 * TODO: Replace with actual AI table generation service
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, rows = 4, cols = 3, hasHeaderRow = true, elementId } = body

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 400))

    // Generate sample table HTML
    const tableHtml = generateTableHtml(prompt, rows, cols, hasHeaderRow)

    console.log(`[AI Table] Generated ${rows}x${cols} table for: "${prompt.slice(0, 50)}..."`)

    return NextResponse.json({
      success: true,
      result: {
        tableHtml,
        rows,
        cols,
        hasHeaderRow,
        prompt
      }
    })
  } catch (error) {
    console.error('[AI Table] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate table data' },
      { status: 500 }
    )
  }
}

function generateTableHtml(prompt: string, rows: number, cols: number, hasHeaderRow: boolean): string {
  const sampleHeaders = ['Name', 'Category', 'Value', 'Status', 'Date', 'Notes', 'ID', 'Type', 'Score', 'Level']
  const sampleData = [
    ['Product A', 'Electronics', '$299', 'Active', '2024-01-15', 'Premium', 'P001', 'Hardware', '95%', 'High'],
    ['Product B', 'Software', '$149', 'Pending', '2024-02-20', 'Standard', 'P002', 'SaaS', '87%', 'Medium'],
    ['Product C', 'Services', '$499', 'Active', '2024-03-10', 'Enterprise', 'P003', 'Consulting', '92%', 'High'],
    ['Product D', 'Hardware', '$199', 'Inactive', '2024-01-25', 'Basic', 'P004', 'Device', '78%', 'Low'],
    ['Product E', 'Cloud', '$399', 'Active', '2024-04-05', 'Pro', 'P005', 'Platform', '89%', 'Medium'],
  ]

  let html = '<table style="width:100%;border-collapse:collapse;font-family:system-ui;">'

  // Header row
  if (hasHeaderRow) {
    html += '<thead><tr style="background:#3b82f6;color:white;">'
    for (let c = 0; c < cols; c++) {
      html += `<th style="padding:12px;text-align:left;border:1px solid #e5e7eb;">${sampleHeaders[c % sampleHeaders.length]}</th>`
    }
    html += '</tr></thead>'
  }

  // Body rows
  html += '<tbody>'
  const dataRows = hasHeaderRow ? rows - 1 : rows
  for (let r = 0; r < dataRows; r++) {
    const bgColor = r % 2 === 0 ? '#ffffff' : '#f9fafb'
    html += `<tr style="background:${bgColor};">`
    for (let c = 0; c < cols; c++) {
      html += `<td style="padding:10px;border:1px solid #e5e7eb;">${sampleData[r % sampleData.length][c % sampleData[0].length]}</td>`
    }
    html += '</tr>'
  }
  html += '</tbody></table>'

  return html
}
