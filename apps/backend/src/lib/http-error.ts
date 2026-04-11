import type { ErrorCode } from '@repo/contracts'

// Domain-specific error codes must be registered here, not invented inline.
export const DOMAIN_ERROR_CODES = {
  TEST_ERROR: 'TEST_ERROR',
} as const

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[keyof typeof DOMAIN_ERROR_CODES]
export type HttpErrorCode = ErrorCode | DomainErrorCode

export class HttpError extends Error {
  statusCode: number
  code: HttpErrorCode
  details?: Record<string, unknown>

  constructor(statusCode: number, code: HttpErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}
