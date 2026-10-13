function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function directImageSource(value: unknown): string | null {
  const candidate = stringValue(value)
  return candidate && /^(?:https:\/\/|data:image\/)/i.test(candidate) ? candidate : null
}

function imageUrlFromHtml(value: string): string | null {
  const match = value.match(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
  return stringValue(match?.[1] ?? match?.[2] ?? match?.[3])
}

export function existingImageSource(existingElement: unknown): string | null {
  if (!existingElement || typeof existingElement !== 'object' || Array.isArray(existingElement)) {
    return directImageSource(existingElement)
  }
  const record = existingElement as Record<string, unknown>
  for (const candidate of [
    record.image_url,
    record.imageUrl,
    record.src,
  ]) {
    const value = directImageSource(candidate)
    if (value) return value
  }

  const content = record.content
  if (typeof content === 'string') {
    return imageUrlFromHtml(content) ?? directImageSource(content)
  }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const contentRecord = content as Record<string, unknown>
    for (const candidate of [
      contentRecord.image_url,
      contentRecord.imageUrl,
      contentRecord.src,
    ]) {
      const value = directImageSource(candidate)
      if (value) return value
    }
    const html = stringValue(contentRecord.html)
    if (html) return imageUrlFromHtml(html)
  }
  const html = stringValue(record.html)
  return html ? imageUrlFromHtml(html) : null
}

export function imageEditPreflightError(
  operation: unknown,
  existingElement: unknown,
): string | null {
  if (operation !== 'edit') return null
  return existingImageSource(existingElement)
    ? null
    : 'The current image could not be read for editing. The original was left unchanged. Reload the slide and try again.'
}
