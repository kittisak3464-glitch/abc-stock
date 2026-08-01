import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Me({ profile, branch }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState(null) // {ok, text}
  const [busy, setBusy] = useState(false)

  async function changePassword(e) {
    e.preventDefault()
    if (pw.length < 6) return setMsg({ ok: false, text: 'Password must be at least 6 characters' })
    if (pw !== pw2) return setMsg({ ok: false, text: 'Passwords do not match' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg({ ok: false, text: error.message })
    else {
      setMsg({ ok: true, text: 'Password changed ✓' })
      setPw('')
      setPw2('')
    }
  }

  return (
    <div className="screen">
      <h1 className="h1">Me</h1>
      <div className="me-card">
        <div className="me-name">{profile.display_name}</div>
        <div className="sub">
          {profile.role === 'admin' && '👑 Admin · all branches'}
          {profile.role === 'owner' && '👁️ Owner · view only'}
          {profile.role === 'staff' && `Staff · ${branch?.name ?? ''}`}
        </div>
      </div>

      <form className="me-card" onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <b>Change password</b>
        <input
          className="input" type="password" placeholder="New password"
          autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}
        />
        <input
          className="input" type="password" placeholder="Repeat new password"
          autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)}
        />
        {msg && <div className={msg.ok ? 'alert-ok' : 'alert-danger'}>{msg.text}</div>}
        <button className="btn-big btn-accent" disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Change Password'}
        </button>
      </form>

      <button className="btn-big btn-ghost-big" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  )
}
