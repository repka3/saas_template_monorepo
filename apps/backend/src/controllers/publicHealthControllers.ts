import type { RequestHandler } from 'express'
import { BACKEND_ERROR, getFailResponseJson } from '../utils/responseUtils.js'

export const ping: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' })
}

export const health: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok' })
}


export const testErrorController: RequestHandler = (_req, res) => {
  const response = getFailResponseJson(_req,"TEST_ERROR", "This is a test error ment to be handled by frontend", {"add_infos":"This is a dummy error with additional infos information as json"})
  res.status(BACKEND_ERROR).json(response)
}
