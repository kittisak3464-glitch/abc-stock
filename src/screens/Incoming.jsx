import { useState } from 'react'
import { fmtDate, signedRpc } from '../lib/data'

export default function Incoming({ transfers, branches, myEmail, onDone, onCancel }) {
  const [openId, setOpenId] = useState(null)
  const [email, setEmail] = useState(myEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'

  async function receive(t) {
    setBusy(true)
    setError('')
    try {
      await signedRpc(email, password, 'receive_transfer', { p_transfer_id: t.id })
      onDone(`Received ✓ ${t.catalog.name} +${t.qty}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>‹ Back</button>
      <h1 className="h1 text-transfer">📬 Incoming</h1>
      {transfers.length === 0 && <p className="sub">Nothing on the way</p>}
      {transfers.map((t) => (
        <div className="transit-card" key={t.id}>
          <div className="transit-tag">🚚 IN TRANSIT{t.kind === 'loan' ? ' · LOAN' : ''}</div>
          <div className="transit-name">{t.catalog.name} × {t.qty}</div>
          <div className="transit-meta">
            From {bname(t.from_branch)} · sent by {t.sender?.display_name ?? '?'} · {fmtDate(t.sent_at)}
          </div>
          {openId !== t.id ? (
            <button className="btn-big btn-in" style={{ marginTop: 10 }} onClick={() => { setOpenId(t.id); setError(''); setPassword('') }}>
              Confirm Received
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <input className="input" type="email" value={email} autoComplete="username"
                onChange={(e) => setEmail(e.target.value)} placeholder="Receiver email" />
              <input className="input" type="password" autoFocus autoComplete="current-password"
                placeholder="🔒 Your password to sign as RECEIVER"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <div className="alert-danger">{error}</div>}
              <button className="btn-big btn-in" disabled={busy || !password} onClick={() => receive(t)}>
                {busy ? 'Confirming…' : `Confirm +${t.qty} ${t.catalog.name}`}
              </button>
              <p className="sub center" style={{ margin: 0 }}>
                Not received yet? Leave it — nothing is added until you sign
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
