import { describe, expect, it } from 'vitest'

import { resolveAssetUrl } from './api-client'

describe('resolveAssetUrl', () => {
  it('returns undefined for empty avatar values', () => {
    expect(resolveAssetUrl(undefined)).toBeUndefined()
    expect(resolveAssetUrl(null)).toBeUndefined()
    expect(resolveAssetUrl('   ')).toBeUndefined()
  })

  it('keeps local upload paths root-relative', () => {
    expect(resolveAssetUrl('/uploads/avatars/x.png')).toBe('/uploads/avatars/x.png')
  })

  it('leaves absolute urls unchanged', () => {
    expect(resolveAssetUrl('https://bucket.s3.amazonaws.com/x.png')).toBe('https://bucket.s3.amazonaws.com/x.png')
  })
})
