import { useState } from 'react'
import { cancelRequest, declineRequest, fmtDate, signedRpc } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

function statusTag(t, tr) {
  switch (tr.status) {
    case 'declined': return t('reqs.declined') + (tr.decline_reason ? ` — ${tr.decline_reason}` : '')
    case 'cancelled': return t('reqs.cancelled')
    case 'in_transit': return t('reqs.approved')
    case 'received': return t('reqs.received')
    case 'pending_return': return t('reqs.approved')
    case 'returned': return t('loan.returned')
    case 'waived': return t('loan.waived')
    default: return ''
  }
}

export default function Requests({ toFulfill, mine, branches, isAdmin, myEmail, onDone, onCancel, onNew }) {
  const { t, lang } = useT()
  const [openId, setOpenId] = useState(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'

  async function approve(tr) {
    setBusy(true)
    setError('')
    try {
      await signedRpc(myEmail, password, 'approve_request', { p_transfer_id: tr.id })
      onDone(`✓ ${tr.catalog.name} ×${tr.qty} → ${bname(tr.to_branch)}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function decline(tr) {
    const reason = window.prompt(t('reqs.declinePrompt', { i: tr.catalog.name, n: tr.qty, b: bname(tr.to_branch) }))
    if (reason === null) return
    setBusy(true)
    try {
      await declineRequest(tr.id, reason)
      onDone(`✕ ${t('reqs.declined')} — ${tr.catalog.name} ×${tr.qty}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function cancel(tr) {
    if (!window.confirm(t('reqs.cancelAsk', { i: tr.catalog.name, n: tr.qty, b: bname(tr.from_branch) }))) return
    setBusy(true)
    try {
      await cancelRequest(tr.id)
      onDone(`✕ ${t('reqs.cancelled')} — ${tr.catalog.name} ×${tr.qty}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const pending = mine.filter((tr) => tr.status === 'requested')
  const history = mine.filter((tr) => tr.status !== 'requested').slice(0, 10)

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>{t('back')}</button>
      <h1 className="h1 text-transfer">{t('reqs.title')}</h1>

      <button className="btn-big btn-transfer" onClick={onNew}>{t('reqs.new')}</button>

      <p className="sub" style={{ margin: '8px 0 0' }}>{t('reqs.toFulfill', { n: toFulfill.length })}</p>
      {toFulfill.length === 0 && <p className="sub">{t('reqs.noneToFulfill')}</p>}
      {toFulfill.map((tr) => (
        <div className="transit-card" key={tr.id}>
          <div className="transit-tag">{t('reqs.askedBy', { b: bname(tr.to_branch) })}</div>
          <div className="transit-name">
            {tr.catalog.name} × {tr.qty}
            {secondaryName(tr.catalog, lang) && (
              <span className="item-secondary" style={{ display: 'block' }}>{secondaryName(tr.catalog, lang)}</span>
            )}
          </div>
          <div className="transit-meta">
            {t('reqs.meta', { p: tr.requester?.display_name ?? '?' })} · {fmtDate(tr.requested_at)}
            {tr.note ? ` · ${tr.note}` : ''}
          </div>
          {openId !== tr.id ? (
            <div className="row-2btn" style={{ marginTop: 10 }}>
              <button className="btn-big btn-in" style={{ fontSize: '0.85rem', padding: 10 }}
                onClick={() => { setOpenId(tr.id); setError(''); setPassword('') }}>
                {t('reqs.approve')}
              </button>
              <button className="btn-big btn-ghost-big" style={{ fontSize: '0.85rem', padding: 10 }}
                disabled={busy} onClick={() => decline(tr)}>
                {t('reqs.decline')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              <input className="input" type="password" autoFocus autoComplete="current-password"
                placeholder={t('tr.pw')} value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <div className="alert-danger">{error}</div>}
              <div className="row-2btn">
                <button className="btn-big btn-ghost-big" style={{ padding: 10 }} onClick={() => setOpenId(null)}>
                  {t('cancel')}
                </button>
                <button className="btn-big btn-in" style={{ padding: 10 }} disabled={busy || !password}
                  onClick={() => approve(tr)}>
                  {busy ? '…' : t('reqs.confirmApprove')}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <p className="sub" style={{ margin: '8px 0 0' }}>{t('reqs.mine')}</p>
      {pending.length === 0 && history.length === 0 && <p className="sub">{t('reqs.noneMine')}</p>}
      {pending.map((tr) => (
        <div className="loan-card" key={tr.id}>
          <div className="loan-who">{t('reqs.askedFrom', { b: bname(tr.from_branch) })}</div>
          <div className="loan-item">
            {tr.catalog.name} × {tr.qty}
            {secondaryName(tr.catalog, lang) && (
              <span className="item-secondary" style={{ display: 'block' }}>{secondaryName(tr.catalog, lang)}</span>
            )}
          </div>
          <div className="transit-meta">{t('reqs.pending')} · {fmtDate(tr.requested_at)}</div>
          <button className="btn-big btn-ghost-big" style={{ marginTop: 10, fontSize: '0.85rem', padding: 10 }}
            disabled={busy} onClick={() => cancel(tr)}>
            {t('reqs.cancel')}
          </button>
        </div>
      ))}
      {history.map((tr) => (
        <div className="tx-row" key={tr.id}>
          <span className={'tx-ic ' + (['in_transit', 'received', 'pending_return', 'returned'].includes(tr.status) ? 'tx-in' : 'tx-out')}>
            {['in_transit', 'received', 'pending_return', 'returned'].includes(tr.status) ? '✓' : '✕'}
          </span>
          <span className="tx-body">
            <span className="tx-name">{bname(tr.from_branch)} · {tr.catalog.name} ×{tr.qty}</span>
            <span className="tx-meta">{statusTag(t, tr)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
