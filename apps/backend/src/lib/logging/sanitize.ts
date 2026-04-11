const SENSITIVE_KEY_PATTERN = /password|token|secret|cookie|authorization|session|creditcard|ssn|cvv/i

const MAX_DEPTH = 10

const sanitizeValue = (value: unknown, depth: number): unknown => {
  if (depth > MAX_DEPTH) return '[DEPTH_LIMIT]'

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1))
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = '[REDACTED]'
      } else {
        result[key] = sanitizeValue(val, depth + 1)
      }
    }
    return result
  }

  return value
}

export const sanitizeForLog = (obj: unknown): unknown => sanitizeValue(obj, 0)
