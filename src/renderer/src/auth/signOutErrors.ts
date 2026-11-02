// Local credentials are gone, but Supabase did not confirm sign-out.
export class DesktopRemoteSignOutError extends Error {
  constructor(cause: unknown) {
    super('Desktop session cleared, but Supabase sign-out failed', { cause })
    this.name = 'DesktopRemoteSignOutError'
  }
}
