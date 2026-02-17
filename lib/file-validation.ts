export const FILE_VALIDATION = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25 MB
  MAX_FILES_PER_SESSION: 5,

  // Comprehensive list of supported MIME types
  SUPPORTED_TYPES: [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'application/rtf',

    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/tab-separated-values',

    // Presentations
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Data formats
    'application/json',
    'application/xml',
    'text/xml',
    'application/x-yaml',
    'text/yaml',

    // Code files
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript',
    'text/x-python',
    'text/x-java',
    'text/x-go',
    'text/x-rust',

    // Images (for OCR)
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp'
  ]
}

export interface FileValidationError {
  code: 'SIZE_EXCEEDED' | 'INVALID_TYPE' | 'TOO_MANY_FILES' | 'EMPTY_FILE'
  message: string
  fileName: string
}

export function validateFile(file: File): FileValidationError | null {
  // Check file size
  if (file.size === 0) {
    return {
      code: 'EMPTY_FILE',
      message: 'File is empty',
      fileName: file.name
    }
  }

  if (file.size > FILE_VALIDATION.MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1)
    return {
      code: 'SIZE_EXCEEDED',
      message: `File size (${sizeMB} MB) exceeds 25 MB limit`,
      fileName: file.name
    }
  }

  // File type validation is permissive - backend will do strict validation
  // We allow all types here since Gemini supports many formats

  return null
}

export function validateFileList(
  files: File[],
  currentFileCount: number
): FileValidationError[] {
  const errors: FileValidationError[] = []

  // Check total file count
  if (currentFileCount + files.length > FILE_VALIDATION.MAX_FILES_PER_SESSION) {
    errors.push({
      code: 'TOO_MANY_FILES',
      message: `Maximum ${FILE_VALIDATION.MAX_FILES_PER_SESSION} files per session (currently ${currentFileCount})`,
      fileName: 'Multiple files'
    })
    return errors
  }

  // Validate each file
  files.forEach(file => {
    const error = validateFile(file)
    if (error) {
      errors.push(error)
    }
  })

  return errors
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
