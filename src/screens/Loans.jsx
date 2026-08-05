import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, signedRpc } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function Loans({ loans, resolved, branches, isAdmin, myBranchId, myEmail, onDone, onCancel }) {
  const { t, lang } = useT()
  const [openId, setOpenId] = useState(null)
  const [email, setEmail] = useState(myEmail)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'
  const route = (borrower, lender) => (
    <div className="loan-who">{t('loan.route', { a: '🏨 ' + bname(borrower), b: '🏨 ' + bname(lender) })}</div>
  )
  const inFilter = (tr) => branchFilter === 'all' || tr.from_branch === branchFilter || tr.to_branch === branchFilter

  const loansF = isAdmin ? loans.filter(inFilter) : loans
  const resolvedF = isAdmin ? resolved.filter(inFilter) : resolved
  const returning = loansF.filter((l) => l.status === 'return_in_transit')
  const pending = loansF.filter((l) => l.status === 'pending_return')

  function openForm(id) {
    setOpenId(id)
    setError('')
    setPassword('')
    setEmail(myEmail)
  }

  async function sendBack(tr) {
    setBusy(true)
    setError('')
    try {
      await signedRpc(email, password, 'send_loan_return', { p_transfer_id: tr.id })
      onDone(`${t('loan.sentBack')} ✓ ${tr.catalog.name} ×${tr.qty}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function confirmReturn(tr) {
    setBusy(true)
    setError('')
    try {
      await signedRpc(email, password, 'confirm_loan_return', { p_transfer_id: tr.id })
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
      <p className="sub" style={{ margin: 0 }}>{t('loan.sub', { n: loansF.length })}</p>

      {isAdmin && branches.length > 1 && (
        <div className="chiprow">
          <button className={'chip' + (branchFilter === 'all' ? ' chip-on' : '')} onClick={() => setBranchFilter('all')}>
            {t('stock.all')}
          </button>
          {branches.map((b) => (
            <button key={b.id} className={'chip' + (branchFilter === b.id ? ' chip-on' : '')}
              onClick={() => setBranchFilter(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {loansF.length === 0 && resolvedF.length === 0 && <p className="sub">{t('loan.none')}</p>}

      {returning.length > 0 && (
        <>
          <p className="sub" style={{ margin: '8px 0 0', fontWeight: 700 }}>{t('loan.returningTitle')}</p>
          {returning.map((tr) => {
            const canConfirm = isAdmin || myBranchId === tr.from_branch
            return (
              <div className="transit-card" key={tr.id}>
                {route(tr.to_branch, tr.from_branch)}
                <div className="transit-tag">{t('loan.returningTag')}</div>
                <div className="transit-name">
                  {tr.catalog.name} × {tr.qty}
                  {secondaryName(tr.catalog, lang) && (
                    <span className="item-secondary" style={{ display: 'block' }}>{secondaryName(tr.catalog, lang)}</span>
                  )}
                </div>
                <div className="transit-meta">
                  {t('inc.meta', { b: bname(tr.to_branch), p: tr.return_sender?.display_name ?? '?' })} · {fmtDate(tr.return_sent_at)}
                </div>
                {canConfirm ? (
                  openId !== tr.id ? (
                    <button className="btn-big btn-in" style={{ marginTop: 10 }} onClick={() => openForm(tr.id)}>
                      {t('loan.confirmReturn')}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      <input className="input" type="email" value={email} autoComplete="username"
                        onChange={(e) => setEmail(e.target.value)} placeholder={t('inc.email')} />
                      <input className="input" type="password" autoFocus autoComplete="current-password"
                        placeholder={t('loan.pw')} value={password} onChange={(e) => setPassword(e.target.value)} />
                      {error && <div className="alert-danger">{error}</div>}
                      <div className="row-2btn">
                        <button className="btn-big btn-ghost-big" style={{ padding: 10 }} onClick={() => setOpenId(null)}>
                          {t('cancel')}
                        </button>
                        <button className="btn-big btn-in" style={{ padding: 10 }} disabled={busy || !password}
                          onClick={() => confirmReturn(tr)}>
                          {busy ? '…' : t('loan.confirm')}
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="sub center" style={{ margin: '10px 0 0' }}>{t('loan.waitConfirm')}</p>
                )}
              </div>
            )
          })}
        </>
      )}

      {pending.length > 0 && (
        <>
          {returning.length > 0 && <p className="sub" style={{ margin: '8px 0 0', fontWeight: 700 }}>{t('loan.pendingTitle')}</p>}
          {pending.map((tr) => {
            const canSend = isAdmin || myBranchId === tr.to_branch
            return (
              <div className="loan-card" key={tr.id}>
                {route(tr.to_branch, tr.from_branch)}
                <div className="loan-item">
                  {tr.catalog.name} × {tr.qty}
                  {secondaryName(tr.catalog, lang) && (
                    <span className="item-secondary" style={{ display: 'block' }}>{secondaryName(tr.catalog, lang)}</span>
                  )}
                </div>
                <div className="transit-meta">
                  {tr.received_at ? t('loan.borrowed', { d: fmtDate(tr.received_at) }) : ''}
                  {tr.note ? ` · ${tr.note}` : ''}
                </div>
                {openId !== tr.id ? (
                  <div className="row-2btn" style={{ marginTop: 10 }}>
                    {canSend && (
                      <button className="btn-big btn-in" style={{ fontSize: '0.85rem', padding: 10 }}
                        onClick={() => openForm(tr.id)}>
                        {t('loan.return')}
                      </button>
                    )}
                    {isAdmin && (
                      <button className="btn-big btn-ghost-big" style={{ fontSize: '0.85rem', padding: 10 }}
                        disabled={busy} onClick={() => waive(tr)}>
                        {t('loan.waive')}
                      </button>
                    )}
                    {!canSend && !isAdmin && (
                      <p className="sub" style={{ margin: 0 }}>{t('loan.waitSend')}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    <p className="sub" style={{ margin: 0 }}>
                      {t('loan.desc', { n: tr.qty, i: tr.catalog.name, a: bname(tr.to_branch), b: bname(tr.from_branch) })}
                    </p>
                    <input className="input" type="email" value={email} autoComplete="username"
                      onChange={(e) => setEmail(e.target.value)} placeholder={t('inc.email')} />
                    <input className="input" type="password" autoFocus autoComplete="current-password"
                      placeholder={t('loan.pw')} value={password} onChange={(e) => setPassword(e.target.value)} />
                    {error && <div className="alert-danger">{error}</div>}
                    <div className="row-2btn">
                      <button className="btn-big btn-ghost-big" style={{ padding: 10 }} onClick={() => setOpenId(null)}>
                        {t('cancel')}
                      </button>
                      <button className="btn-big btn-in" style={{ padding: 10 }} disabled={busy || !password}
                        onClick={() => sendBack(tr)}>
                        {busy ? '…' : t('loan.confirm')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {resolvedF.length > 0 && (
        <>
          <p className="sub" style={{ margin: '8px 0 0' }}>{t('loan.resolved')}</p>
          {resolvedF.map((tr) => (
            <div className="tx-row" key={tr.id}>
              <span className={'tx-ic ' + (tr.status === 'returned' ? 'tx-in' : 'tx-out')}>
                {tr.status === 'returned' ? '↩' : '✕'}
              </span>
              <span className="tx-body">
                <span className="tx-name">
                  {t('loan.route', { a: '🏨 ' + bname(tr.to_branch), b: '🏨 ' + bname(tr.from_branch) })} · {tr.catalog.name} ×{tr.qty}
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
