// Prisma formats whitespace and moves model-level attributes. Preserve their
// model ownership and all quoted values while ignoring only those differences.
export function schemaTokens(source) {
  const ordered = source.replace(/generator\s+client\s*\{[^}]*\}/, '')
    .replace(/(model\s+\w+\s*\{)([\s\S]*?)(^\})/gm, (_match, start, body, end) => {
      const lines = body.split('\n')
      const attributes = lines.filter(line => /^\s*@@/.test(line)).sort((a, b) => a.trim().localeCompare(b.trim()))
      return `${start}${lines.filter(line => !/^\s*@@/.test(line)).join('\n')}\n${attributes.join('\n')}\n${end}`
    })
  return (ordered.match(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|[^\s"]/g) || []).filter(token => !token.startsWith('//')).join('')
}
