import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { RequestHandler } from 'express'
import { ERROR_CODES } from '@repo/contracts'
import multer, { type MulterError } from 'multer'

import { env } from '../lib/env.js'
import { HttpError } from '../lib/http-error.js'

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

/**
 * Magic-byte signatures for each allowed image type.
 * Keys are the MIME type; values are { offset, bytes } describing the
 * expected byte sequence at a fixed position in the file header.
 */
const FILE_SIGNATURES: Record<string, Array<{ offset: number; bytes: number[] }>> = {
  'image/jpeg': [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/webp': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
  ],
}

const avatarDir = path.resolve(env.UPLOADS_DIR, 'avatars')

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(avatarDir, { recursive: true }).then(
      () => cb(null, avatarDir),
      (err: NodeJS.ErrnoException) => cb(err, avatarDir),
    )
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype]

    if (!ext) {
      return cb(new Error('Unsupported file type'), '')
    }

    cb(null, `${randomUUID()}${ext}`)
  },
})

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype in ALLOWED_MIME_TYPES) {
    cb(null, true)
  } else {
    cb(new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'Unsupported avatar file type'))
  }
}

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_AVATAR_UPLOAD_BYTES,
    files: 1,
  },
}).single('avatar')

async function validateFileSignature(filePath: string, mimeType: string): Promise<boolean> {
  const sigs = FILE_SIGNATURES[mimeType]
  if (!sigs) return false

  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(filePath, 'r')
    const maxLen = Math.max(...sigs.map((s) => s.offset + s.bytes.length))
    const buf = Buffer.alloc(maxLen)
    await handle.read(buf, 0, maxLen, 0)

    return sigs.every((sig) => sig.bytes.every((expected, i) => buf[sig.offset + i] === expected))
  } catch {
    return false
  } finally {
    await handle?.close()
  }
}

export const uploadAvatar: RequestHandler = (req, res, next) => {
  avatarUpload(req, res, (error) => {
    void (async () => {
      if (error && req.file) {
        await deleteUploadedFile(req.file.path)
      }

      if (error) {
        next(error)
        return
      }

      if (req.file) {
        const valid = await validateFileSignature(req.file.path, req.file.mimetype)
        if (!valid) {
          await deleteUploadedFile(req.file.path)
          next(new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'File content does not match an allowed image type'))
          return
        }
      }

      next()
    })()
  })
}

export const deleteUploadedFile = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath)
  } catch {
    // best-effort cleanup
  }
}

export const isMulterError = (error: unknown): error is MulterError => error instanceof multer.MulterError

export { avatarDir }
