// Derived from Supabase UpdatePasswordForm, Apache-2.0. Modified for validation and global session revocation.
import { useState } from 'react'

import { supabase } from '../../supabase'

export function UpdatePasswordForm({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [updated, setUpdated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    if (!updated && (password.length < 12 || password.length > 128 || password !== confirmation)) {
      setError('Passwords must match and contain 12–128 characters')
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      if (!updated) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setUpdated(true)
        setPassword('')
        setConfirmation('')
      }
      const { error: logoutError } = await supabase.auth.signOut({ scope: 'global' })
      if (logoutError) throw Error('Password updated; session revocation not confirmed. Retry sign out.')
      onComplete()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleForgotPassword}>
      <h2>Reset your password</h2>
      {!updated && <>
        <label htmlFor="reset-password">New password</label>
        <input id="reset-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
        <label htmlFor="reset-confirmation">Confirm password</label>
        <input id="reset-confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} />
      </>}
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : updated ? 'Retry sign out' : 'Save new password'}</button>
    </form>
  )
}
