export const ERROR_CODES = {
  VALIDATION_ERROR: 'validation_error',
  INVALID_JSON: 'invalid_json',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  NOT_FOUND: 'not_found',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  CONFLICT: 'conflict',
  INTERNAL_SERVER_ERROR: 'internal_server_error',
  RATE_LIMITED: 'rate_limited',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    requestId?: string
  }
}
