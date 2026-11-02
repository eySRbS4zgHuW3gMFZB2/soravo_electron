import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { DESKTOP_SESSION_STORAGE_KEY, supabase } from './supabaseClient'
import { createInitialSessionGuard } from './desktopAuthPrimitives'
import { desktopSecureStorage } from './storage'

type User = { id: string; email?: string | null; email_confirmed_at?: string | null }
type Session = { access_token: string; refresh_token?: string; user: User } | null

interface AuthContextValue {
  session: Session
  user: User | null
  loading: boolean
  error: string | null
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  resetPassword(email: string): Promise<void>
  signOut(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const guard = createInitialSessionGuard()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') {
        if (mounted && guard.shouldApplyInitialSession()) {
          setSession(nextSession as Session)
          setLoading(false)
        }
        return
      }
      guard.markAuthEvent()
      if (!mounted) return
      setSession(nextSession as Session)
      setError(null)
      setLoading(false)
    })

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted || !guard.shouldApplyInitialSession()) return
      if (sessionError) {
        setError('Could not restore the saved desktop session from secure storage.')
      } else {
        setSession(data.session as Session)
        setError(null)
      }
      setLoading(false)
    }).catch(() => {
      if (!mounted || !guard.shouldApplyInitialSession()) return
      setError('Could not restore the saved desktop session from secure storage.')
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); throw error }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); throw error }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) { setError(error.message); throw error }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    let signOutError: unknown = null
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) signOutError = error
    } catch (caught) {
      signOutError = caught
    }

    let storageError: unknown = null
    const clearStoredSession = async () => {
      await desktopSecureStorage.removeItem(DESKTOP_SESSION_STORAGE_KEY)
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
        await navigator.locks.request(`lock:${DESKTOP_SESSION_STORAGE_KEY}`, { mode: 'exclusive' }, clearStoredSession)
      } else {
        await clearStoredSession()
      }
    } catch (caught) {
      storageError = caught
      setError('Could not clear the desktop session from secure storage.')
    }

    setSession(null)
    if (signOutError && storageError) throw new AggregateError([signOutError, storageError], 'Sign out failed')
    if (signOutError) throw signOutError
    if (storageError) throw storageError
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user || null, loading, error, signIn, signUp, resetPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}