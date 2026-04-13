import { describe, expect, it } from 'vitest'

import { normalizePublicAssetUrl } from './api-client'

describe('normalizePublicAssetUrl', () => {
  it('returns undefined for empty avatar values', () => {
    expect(normalizePublicAssetUrl(undefined)).toBeUndefined()
    expect(normalizePublicAssetUrl(null)).toBeUndefined()
    expect(normalizePublicAssetUrl('   ')).toBeUndefined()
  })

  it('keeps same-origin public upload paths unchanged', () => {
    expect(normalizePublicAssetUrl('/uploads/avatars/x.png')).toBe('/uploads/avatars/x.png')
  })

  it('leaves absolute urls unchanged', () => {
    expect(normalizePublicAssetUrl('https://bucket.s3.amazonaws.com/x.png')).toBe('https://bucket.s3.amazonaws.com/x.png')
  })
})
