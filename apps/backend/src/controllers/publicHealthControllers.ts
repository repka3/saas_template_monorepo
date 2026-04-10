import type { RequestHandler } from 'express'

export const ping: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' })
}

export const health: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' })
}
