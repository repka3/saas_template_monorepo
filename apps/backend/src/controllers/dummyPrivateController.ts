import type { RequestHandler } from 'express'

export const getDummyPrivate: RequestHandler = (_req, res) => {
  res.status(200).json({
    status: 'ok',
    access: 'authenticated',
  })
}

export const getDummySuperadmin: RequestHandler = (_req, res) => {
  res.status(200).json({
    status: 'ok',
    access: 'superadmin',
  })
}
