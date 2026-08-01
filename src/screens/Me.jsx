import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { LANGS, useT } from '../lib/i18n'

export default function Me({ profile, branch }) {
  const { lang, t, setLang } = useT()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function changePassword(e) {
    e.preventDefault()
    if (pw.length < 6) return setMsg({ ok: false, text: t('me.pwShort') })
    if (pw !== pw2) return setMsg({ ok: false, text: t('me.pwMismatch') })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg({ ok: false, text: error.message })
    else {
      setMsg({ ok: true, text: t('me.pwChanged') })
      setPw('')
      setPw2('')
    }
  }

  return (
    <div className="screen">
      <h1 className="h1">{t('me.title')}</h1>
      <div className="me-card">
        <div className="me-name">{profile.display_name}</div>
        <div className="sub">
          {profile.role === 'admin' && t('me.adminSub')}
          {profile.role === 'owner' && t('me.owner')}
          {profile.role === 'staff' && `${t('me.staff')} · ${branch?.name ?? ''}`}
        </div>
      </div>

      <div className="me-card">
        <b>🌐 {t('me.language')}</b>
        <div className="chiprow" style={{ marginTop: 10 }}>
          {LANGS.map((l) => (
            <button key={l.code} className={'chip' + (lang === l.code ? ' chip-on' : '')}
              onClick={() => setLang(l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <form className="me-card" onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <b>{t('me.changePw')}</b>
        <input className="input" type="password" placeholder={t('me.newPw')}
          autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" placeholder={t('me.repeatPw')}
          autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {msg && <div className={msg.ok ? 'alert-ok' : 'alert-danger'}>{msg.text}</div>}
        <button className="btn-big btn-accent" disabled={busy} type="submit">
          {busy ? t('rec.saving') : t('me.changePw')}
        </button>
      </form>

      <button className="btn-big btn-ghost-big" onClick={() => supabase.auth.signOut()}>
        {t('me.signOut')}
      </button>
    </div>
  )
}
