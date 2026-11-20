// Derived from Supabase SignUpForm, Apache-2.0. Modified for Identity validation, callback, markup and session handling.
import { useState } from 'react'

import { supabase } from '../../supabase'
import { validateRegistration } from '../../validation'

export function SignUpForm({ onSignIn }: { onSignIn: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isLoading) return
    const validationError = validateRegistration(email, password, repeatPassword)
    if (validationError) {
      setError(validationError)
      return
    }
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + '/verified' },
      })
      if (error) throw error
      if (data.session) {
        const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' })
        if (logoutError) throw logoutError
      }
      setPassword('')
      setRepeatPassword('')
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section>
      {success ? (
        <div role="status">
          <h2>Thank you for signing up!</h2>
          <p>Check your email to confirm your account before signing in.</p>
          <button type="button" onClick={onSignIn}>Sign in</button>
        </div>
      ) : (
        <form onSubmit={handleSignUp}>
          <h2>Create a new account</h2>
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} />
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
          <label htmlFor="signup-repeat">Repeat password</label>
          <input id="signup-repeat" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} />
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" disabled={isLoading}>{isLoading ? 'Creating an account...' : 'Sign up'}</button>
          <button type="button" onClick={onSignIn}>Already have an account? Sign in</button>
        </form>
      )}
    </section>
  )
}
