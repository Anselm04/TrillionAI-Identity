// Derived from Supabase LoginForm, Apache-2.0. Modified for shared client, native markup and server-gated navigation.
import { useState } from 'react'

import { supabase } from '../../supabase'

export function LoginForm({ onForgot, onSignUp }: { onForgot: () => void; onSignUp: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      setPassword('')
      // Parent verifies server authorization and MFA before redirecting.
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <h2>Sign in</h2>
      <label htmlFor="login-email">Email</label>
      <input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
      <label htmlFor="login-password">Password</label>
      <input id="login-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Sign in'}</button>
      <button type="button" onClick={onForgot}>Forgot your password?</button>
      <button type="button" onClick={onSignUp}>Create account</button>
    </form>
  )
}
