import { format } from 'date-fns'

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const trimToNull = (value: string) => {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

export const trimToUndefined = (value: string) => {
  const trimmed = value.trim()

  return trimmed === '' ? undefined : trimmed
}

export const formatDateTime = (value: string) => {
  const date = new Date(value)

  if (Number.isNaN(date.valueOf())) {
    return value
  }

  return format(date, 'PP p')
}

export const generateTemporaryPassword = (length = 16) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
  const values = crypto.getRandomValues(new Uint32Array(length))

  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

export const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value)
}

export const buildVisiblePages = (page: number, totalPages: number) => {
  if (totalPages <= 0) {
    return []
  }

  const values = new Set<number>([1, page - 1, page, page + 1, totalPages])
  const sorted = [...values].filter((value) => value >= 1 && value <= totalPages).sort((left, right) => left - right)
  const visible: Array<number | 'ellipsis'> = []

  for (const value of sorted) {
    const previous = visible.at(-1)

    if (typeof previous === 'number' && value - previous > 1) {
      visible.push('ellipsis')
    }

    visible.push(value)
  }

  return visible
}
