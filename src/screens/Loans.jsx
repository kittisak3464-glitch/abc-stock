import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, signedRpc } from '../lib/data'

export default function Loans({ loans, resolved, branches, isAdmin, myEmail, onDone, onCancel }) {
  const [openId, setOpenId] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'

  async function markReturned(t) {
    setBusy(true)
    setError('')
    try {
      await signedRpc(myEmail, password, 'return_loan', { p_transfer_id: t.id })
      onDone(`Loan returned ✓ ${t.catalog.name} ×${t.qty}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function waive(t) {
    if (!window.confirm(`Waive this loan? ${bname(t.to_branch)} will NOT return ${t.catalog.name} ×${t.qty}.`)) return
    setBusy(true)
    const { error } = await supabase.rpc('waive_loan', { p_transfer_id: t.id })
    if (error) { setError(error.message); setBusy(false) }
    else onDone(`Loan waived ✓ ${t.catalog.name} ×${t.qty}`)
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>‹ Back</button>
      <h1 className="h1 text-out">🤝 Loans</h1>
      <p className="sub" style={{ margin: 0 }}>Cross-group borrowing · outstanding: {loans.length}</p>

      {loans.length === 0 && <p className="sub">No outstanding loans 🎉</p>}
      {loans.map((t) => (
        <div className="loan-card" key={t.id}>
          <div className="loan-who">{bname(t.to_branch)} owes {bname(t.from_branch)}</div>
          <div className="loan-item">{t.catalog.name} × {t.qty}</div>
          <div className="transit-meta">
            {t.received_at ? `Borrowed ${fmtDate(t.received_at)}` : ''}
            {t.note ? ` · ${t.note}` : ''}
          </div>
          {openId !== t.id ? (
            <div className="row-2btn" style={{ marginTop: 10 }}>
              <button className="btn-big btn-in" style={{ fontSize: '0.85rem', padding: 10 }}
                onClick={() => { setOpenId(t.id); setError(''); setPassword('') }}>
                ↩ Mark Returned
              </button>
              {isAdmin && (
                <button className="btn-big btn-ghost-big" style={{ fontSize: '0.85rem', padding: 10 }}
                  disabled={busy} onClick={() => waive(t)}>
                  ✕ Waive 👑
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <p className="sub" style={{ margin: 0 }}>
                Returns {t.qty} {t.catalog.name} from {bname(t.to_branch)} back to {bname(t.from_branch)}
              </p>
              <input className="input" type="password" autoFocus autoComplete="current-password"
                placeholder="🔒 Your password to confirm return"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <div className="alert-danger">{error}</div>}
              <div className="row-2btn">
                <button className="btn-big btn-ghost-big" style={{ padding: 10 }} onClick={() => setOpenId(null)}>Cancel</button>
                <button className="btn-big btn-in" style={{ padding: 10 }} disabled={busy || !password}
                  onClick={() => markReturned(t)}>
                  {busy ? '…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {resolved.length > 0 && (
        <>
          <p className="sub" style={{ margin: '8px 0 0' }}>Recently resolved</p>
          {resolved.map((t) => (
            <div className="tx-row" key={t.id}>
              <span className={'tx-ic ' + (t.status === 'returned' ? 'tx-in' : 'tx-out')}>
                {t.status === 'returned' ? '↩' : '✕'}
              </span>
              <span className="tx-body">
                <span className="tx-name">
                  {bname(t.to_branch)} → {bname(t.from_branch)} · {t.catalog.name} ×{t.qty}
                </span>
                <span className="tx-meta">{t.status === 'returned' ? 'Returned' : 'Waived by admin'}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
