// Both the renderer and its CSP use the URL validated by the Vite config.
export function validateSupabaseUrl(value: string): string {
  const url = new URL(value)
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('VITE_SUPABASE_URL must use HTTPS or loopback HTTP, without credentials, query or fragment')
  }
  // Empty ? or # delimiters must not capture a subsequently appended path.
  url.search = ''
  url.hash = ''
  return url.href.replace(/\/$/, '')
}
