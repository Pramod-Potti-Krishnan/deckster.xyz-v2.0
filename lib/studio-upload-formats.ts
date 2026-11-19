const DOCUMENT_FORMATS = '.pdf,.docx,.txt,.md,.xlsx,.csv,.pptx'
const IMAGE_FORMATS = '.png,.jpg,.jpeg,.gif,.webp'

export const STUDIO_UPLOAD_FORMAT_PROPS: { accept?: string } = {
  accept: process.env.NEXT_PUBLIC_STUDIO_UPLOAD_TEXT_FORMATS === 'true'
    ? `${DOCUMENT_FORMATS},.json,.xml,.yaml,.yml,${IMAGE_FORMATS},.py,.js,.ts,.java,.go,.rs`
    : `${DOCUMENT_FORMATS},${IMAGE_FORMATS}`,
}
