import { useEffect, useState } from 'react'
import { adjustBalance, fetchTransactions, fmtDate, isLow, setReorderPoint } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function ItemDetail({ item, isAdmin, onBack, onAction, canUndo, onUndo, onReorderSaved, onAdjusted }) {
  const { t, lang } = useT()
  const sec = secondaryName(item.catalog, lang)
  const [txs, setTxs] = useState(null)
  const [txsError, setTxsError] = useState(false)
  const [editRp, setEditRp] = useState(false)
  const [rp, setRp] = useState(item.reorder_point ?? '')

  const [editAdjust, setEditAdjust] = useState(false)
  const [newBal, setNewBal] = useState('')
  const [reason, setReason] = useState('')
  const [adjBusy, setAdjBusy] = useState(false)
  const [adjError, setAdjError] = useState('')

  useEffect(() => {
    setTxs(null)
    setTxsError(false)
    fetchTransactions({ itemId: item.id, limit: 50 }).then(setTxs).catch(() => setTxsError(true))
  }, [item.id])

  async function saveRp() {
    const value = rp === '' ? null : Number(rp)
    await setReorderPoint(item.id, value)
    setEditRp(false)
    onReorderSaved?.()
  }

  async function clearRp() {
    await setReorderPoint(item.id, null)
    setRp('')
    setEditRp(false)
    onReorderSaved?.()
  }

  const diff = newBal === '' ? null : Number(newBal) - Number(item.balance)

  async function saveAdjust() {
    setAdjError('')
    if (diff === null || diff === 0) return setAdjError(t('item.adjustSame'))
    if (!reason.trim()) return setAdjError(t('item.adjustReasonReq'))
    const sign = diff > 0 ? '+' : '−'
    if (!window.confirm(t('item.adjustAsk', { sign, n: Math.abs(diff), u: item.catalog.unit }))) return
    setAdjBusy(true)
    try {
      await adjustBalance(item.id, Number(newBal), reason.trim())
      setEditAdjust(false)
      setNewBal('')
      setReason('')
      onAdjusted?.()
    } catch (e) {
      setAdjError(e.message)
    } finally {
      setAdjBusy(false)
    }
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={onBack}>{t('back')}</button>
      <div>
        <h1 className="h1">{item.catalog.name}</h1>
        {sec && <p className="item-secondary-title">{sec}</p>}
        <p className="sub">
          {t('onHand')}:{' '}
          <b className={isLow(item) ? 'text-danger' : ''}>
            {Number(item.balance)} {item.catalog.unit}
          </b>
          {item.reorder_point != null && ` · ${t('item.reorderAt', { n: Number(item.reorder_point) })}`}
          {isAdmin && !editRp && (
            <button className="btn-undo" style={{ marginLeft: 8 }} onClick={() => setEditRp(true)}>
              {item.reorder_point != null ? t('item.edit') : t('item.set')}
            </button>
          )}
        </p>
        {isAdmin && editRp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <p className="sub" style={{ margin: 0 }}>{t('item.rpHint')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" type="number" min="0" style={{ maxWidth: 140 }}
                placeholder={t('item.ph')} value={rp} onChange={(e) => setRp(e.target.value)} />
              <button className="btn-undo" onClick={saveRp}>{t('save')}</button>
              {item.reorder_point != null && (
                <button className="btn-undo" onClick={clearRp}>{t('item.rpClear')}</button>
              )}
              <button className="btn-undo" onClick={() => { setEditRp(false); setRp(item.reorder_point ?? '') }}>
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {item.catalog.active === false ? (
        <p className="sub">{t('item.inactiveNote')}</p>
      ) : isAdmin ? (
        <div className="row-2btn">
          <button className="btn-big btn-in" onClick={() => onAction('in', item)}>{t('item.in')}</button>
          <button className="btn-big btn-out" onClick={() => onAction('out', item)}>{t('item.out')}</button>
        </div>
      ) : (
        <button className="btn-big btn-out" onClick={() => onAction('out', item)}>{t('item.out')}</button>
      )}

      {isAdmin && !editAdjust && (
        <button className="btn-big btn-ghost-big" onClick={() => { setEditAdjust(true); setNewBal(String(Number(item.balance))); setAdjError('') }}>
          {t('item.adjust')}
        </button>
      )}

      {isAdmin && editAdjust && (
        <div className="me-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <b>{t('item.adjustTitle')}</b>
          <p className="sub" style={{ margin: 0 }}>
            {t('item.adjustCurrent', { n: Number(item.balance), u: item.catalog.unit })}
          </p>
          <input className="input" type="number" min="0" placeholder={t('item.adjustNew')}
            value={newBal} onChange={(e) => setNewBal(e.target.value)} />
          {diff !== null && diff !== 0 && (
            <p className={'sub ' + (diff > 0 ? 'text-in' : 'text-out')} style={{ margin: 0, fontWeight: 700 }}>
              {t('item.adjustDiff', { sign: diff > 0 ? '+' : '−', n: Math.abs(diff), u: item.catalog.unit })}
            </p>
          )}
          <input className="input" placeholder={t('item.adjustReason')}
            value={reason} onChange={(e) => setReason(e.target.value)} />
          {adjError && <div className="alert-danger">{adjError}</div>}
          <div className="row-2btn">
            <button className="btn-big btn-ghost-big" style={{ padding: 10 }}
              onClick={() => { setEditAdjust(false); setNewBal(''); setReason(''); setAdjError('') }}>
              {t('cancel')}
            </button>
            <button className="btn-big btn-accent" style={{ padding: 10 }} disabled={adjBusy} onClick={saveAdjust}>
              {adjBusy ? t('rec.saving') : t('item.adjustSave')}
            </button>
          </div>
        </div>
      )}

      <p className="sub" style={{ marginBottom: 0 }}>{t('item.history')}</p>
      {txsError && <div className="alert-danger">{t('err.load')}</div>}
      {txs === null && !txsError && <p className="sub">{t('item.loading')}</p>}
      {txs?.length === 0 && <p className="sub">{t('item.none')}</p>}
      {txs?.map((tx) => (
        <div className={'tx-row' + (tx.voided ? ' tx-voided' : '')} key={tx.id}>
          <span className={'tx-ic ' + (tx.type === 'in' ? 'tx-in' : 'tx-out')}>
            {tx.type === 'in' ? '+' : '−'}
          </span>
          <span className="tx-body">
            <span className="tx-name">
              <b className="tx-qty">{tx.type === 'in' ? '+' : '−'}{Number(tx.qty)}</b>
              {tx.voided && <span className="tag-voided">{t('tag.undone')}</span>}
            </span>
            <span className="tx-meta">
              {fmtDate(tx.created_at, lang)} · {t('by')} {tx.author?.display_name ?? 'system'}
            </span>
            {tx.note && <span className="tx-note">📝 {tx.note}</span>}
          </span>
          {canUndo(tx) && (
            <button className="btn-undo" onClick={() => onUndo(tx)}>{t('undo')}</button>
          )}
        </div>
      ))}
    </div>
  )
}
