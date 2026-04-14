import { describe, expect, it } from 'vitest'

import { buildPrismaPoolConfig } from '../src/lib/prisma.js'

describe('buildPrismaPoolConfig', () => {
  it('keeps the pool config minimal when no per-process limit is set', () => {
    expect(buildPrismaPoolConfig('postgresql://postgres:postgres@localhost:5432/saas_template')).toEqual({
      connectionString: 'postgresql://postgres:postgres@localhost:5432/saas_template',
    })
  })

  it('adds the configured max connections when a per-process limit is set', () => {
    expect(buildPrismaPoolConfig('postgresql://postgres:postgres@localhost:5432/saas_template', 6)).toEqual({
      connectionString: 'postgresql://postgres:postgres@localhost:5432/saas_template',
      max: 6,
    })
  })
})
