import { useState } from 'react'
import { fmtDate, signedRpc } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function Incoming({ transfers, branches, myEmail, onDone, onCancel }) {
  const { t, lang } = useT()
  const [openId, setOpenId] = useState(null)
  const [email, setEmail] = useState(myEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'

  async function receive(tr) {
    setBusy(true)
    setError('')
    try {
      await signedRpc(email, password, 'receive_transfer', { p_transfer_id: tr.id })
      onDone(`✓ ${tr.catalog.name} +${tr.qty}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>{t('back')}</button>
      <h1 className="h1 text-transfer">{t('inc.title')}</h1>
      {transfers.length === 0 && <p className="sub">{t('inc.none')}</p>}
      {transfers.map((tr) => (
        <div className="transit-card" key={tr.id}>
          <div className="transit-tag">{t('inc.transit')}{tr.kind === 'loan' ? t('inc.loanTag') : ''}</div>
          <div className="transit-name">
            {tr.catalog.name} × {tr.qty}
            {secondaryName(tr.catalog, lang) && (
              <span className="item-secondary" style={{ display: 'block' }}>{secondaryName(tr.catalog, lang)}</span>
            )}
          </div>
          <div className="transit-meta">
            {t('inc.meta', { b: bname(tr.from_branch), p: tr.sender?.display_name ?? '?' })} · {fmtDate(tr.sent_at)}
          </div>
          {openId !== tr.id ? (
            <button className="btn-big btn-in" style={{ marginTop: 10 }}
              onClick={() => { setOpenId(tr.id); setError(''); setPassword('') }}>
              {t('inc.open')}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <input className="input" type="email" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)} placeholder={t('inc.email')} />
              <input className="input" type="password" autoFocus autoComplete="current-password"
                placeholder={t('inc.pw')} value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <div className="alert-danger">{error}</div>}
              <button className="btn-big btn-in" disabled={busy || !password} onClick={() => receive(tr)}>
                {busy ? t('inc.busy') : t('inc.btn', { n: tr.qty, i: tr.catalog.name })}
              </button>
              <p className="sub center" style={{ margin: 0 }}>{t('inc.wait')}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
