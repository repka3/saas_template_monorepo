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

export const uploadAvatar: RequestHandler = (req, res, next) => {
  avatarUpload(req, res, (error) => {
    void (async () => {
      if (error && req.file) {
        await deleteUploadedFile(req.file.path)
      }

      next(error)
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
