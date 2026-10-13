export const FILE_TYPE = {
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document',
} as const

export type FileType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE]
