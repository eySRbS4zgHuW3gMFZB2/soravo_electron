import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

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
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) { setSession(data.session as Session); setLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s as Session)
    })
    return () => { mounted = false; subscription.unsubscribe() }
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
    await supabase.auth.signOut()
    setSession(null)
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
