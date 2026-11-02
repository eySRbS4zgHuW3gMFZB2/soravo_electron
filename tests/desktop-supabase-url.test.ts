import { describe, expect, it } from 'vitest'
import { validateSupabaseUrl } from '../src/renderer/src/auth/supabaseUrl'

describe('desktop Supabase URL validation', () => {
  it.each([
    ['https://project.example/path/', 'https://project.example/path'],
    ['http://localhost:54321', 'http://localhost:54321'],
    ['http://127.1:54321', 'http://127.0.0.1:54321'],
    ['http://127.9.8.7:54321', 'http://127.9.8.7:54321'],
    ['http://[::1]:54321', 'http://[::1]:54321'],
    ['https://[::1]:54321', 'https://[::1]:54321'],
    ['https://project.example/path?', 'https://project.example/path'],
    ['https://project.example/path#', 'https://project.example/path'],
    ['https://project.example/path%3Fsegment', 'https://project.example/path%3Fsegment'],
  ])('accepts and normalizes %s', (input, expected) => {
    expect(validateSupabaseUrl(input)).toBe(expected)
  })

  it.each([
    'http://example.com', 'http://localhost.example.com', 'http://128.0.0.1',
    'http://[::2]', 'https://[2001:db8::1]', 'https://[::ffff:127.0.0.1]',
    'https://user:password@example.com', 'ftp://localhost',
    'https://project.example/?tag=desktop', 'https://project.example/path#fragment',
    'http://localhost:54321/?x=1#part',
  ])('rejects unsafe URL %s', (input) => {
    expect(() => validateSupabaseUrl(input)).toThrow()
  })
})
