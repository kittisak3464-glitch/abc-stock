import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, signedRpc } from '../lib/data'
import { useT } from '../lib/i18n'

export default function Loans({ loans, resolved, branches, isAdmin, myEmail, onDone, onCancel }) {
  const { t } = useT()
  const [openId, setOpenId] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'

  async function markReturned(tr) {
    setBusy(true)
    setError('')
    try {
      await signedRpc(myEmail, password, 'return_loan', { p_transfer_id: tr.id })
      onDone(`${t('loan.returned')} ✓ ${tr.catalog.name} ×${tr.qty}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function waive(tr) {
    if (!window.confirm(t('loan.ask', { b: bname(tr.to_branch), i: tr.catalog.name, n: tr.qty }))) return
    setBusy(true)
    const { error } = await supabase.rpc('waive_loan', { p_transfer_id: tr.id })
    if (error) { setError(error.message); setBusy(false) }
    else onDone(`${t('loan.waived')} ✓ ${tr.catalog.name} ×${tr.qty}`)
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>{t('back')}</button>
      <h1 className="h1 text-out">{t('loan.title')}</h1>
      <p className="sub" style={{ margin: 0 }}>{t('loan.sub', { n: loans.length })}</p>

      {loans.length === 0 && <p className="sub">{t('loan.none')}</p>}
      {loans.map((tr) => (
        <div className="loan-card" key={tr.id}>
          <div className="loan-who">{t('loan.owes', { a: bname(tr.to_branch), b: bname(tr.from_branch) })}</div>
          <div className="loan-item">{tr.catalog.name} × {tr.qty}</div>
          <div className="transit-meta">
            {tr.received_at ? t('loan.borrowed', { d: fmtDate(tr.received_at) }) : ''}
            {tr.note ? ` · ${tr.note}` : ''}
          </div>
          {openId !== tr.id ? (
            <div className="row-2btn" style={{ marginTop: 10 }}>
              <button className="btn-big btn-in" style={{ fontSize: '0.85rem', padding: 10 }}
                onClick={() => { setOpenId(tr.id); setError(''); setPassword('') }}>
                {t('loan.return')}
              </button>
              {isAdmin && (
                <button className="btn-big btn-ghost-big" style={{ fontSize: '0.85rem', padding: 10 }}
                  disabled={busy} onClick={() => waive(tr)}>
                  {t('loan.waive')}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <p className="sub" style={{ margin: 0 }}>
                {t('loan.desc', { n: tr.qty, i: tr.catalog.name, a: bname(tr.to_branch), b: bname(tr.from_branch) })}
              </p>
              <input className="input" type="password" autoFocus autoComplete="current-password"
                placeholder={t('loan.pw')} value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <div className="alert-danger">{error}</div>}
              <div className="row-2btn">
                <button className="btn-big btn-ghost-big" style={{ padding: 10 }} onClick={() => setOpenId(null)}>
                  {t('cancel')}
                </button>
                <button className="btn-big btn-in" style={{ padding: 10 }} disabled={busy || !password}
                  onClick={() => markReturned(tr)}>
                  {busy ? '…' : t('loan.confirm')}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {resolved.length > 0 && (
        <>
          <p className="sub" style={{ margin: '8px 0 0' }}>{t('loan.resolved')}</p>
          {resolved.map((tr) => (
            <div className="tx-row" key={tr.id}>
              <span className={'tx-ic ' + (tr.status === 'returned' ? 'tx-in' : 'tx-out')}>
                {tr.status === 'returned' ? '↩' : '✕'}
              </span>
              <span className="tx-body">
                <span className="tx-name">
                  {bname(tr.to_branch)} → {bname(tr.from_branch)} · {tr.catalog.name} ×{tr.qty}
                </span>
                <span className="tx-meta">{tr.status === 'returned' ? t('loan.returned') : t('loan.waived')}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
