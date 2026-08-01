import { useEffect, useState } from 'react'
import { fetchTransactions, fmtDate, isLow, setReorderPoint } from '../lib/data'

export default function ItemDetail({ item, isAdmin, onBack, onAction, canUndo, onUndo, onReorderSaved }) {
  const [txs, setTxs] = useState(null)
  const [editRp, setEditRp] = useState(false)
  const [rp, setRp] = useState(item.reorder_point ?? '')

  useEffect(() => {
    fetchTransactions({ itemId: item.id, limit: 50 }).then(setTxs).catch(() => setTxs([]))
  }, [item.id])

  async function saveRp() {
    const value = rp === '' ? null : Number(rp)
    await setReorderPoint(item.id, value)
    setEditRp(false)
    onReorderSaved?.()
  }

  return (
    <div className="screen">
      <button className="btn-back" onClick={onBack}>‹ Back</button>
      <div>
        <h1 className="h1">{item.catalog.name}</h1>
        <p className="sub">
          On hand:{' '}
          <b className={isLow(item) ? 'text-danger' : ''}>
            {Number(item.balance)} {item.catalog.unit}
          </b>
          {item.reorder_point != null && ` · reorder at ${Number(item.reorder_point)}`}
          {isAdmin && !editRp && (
            <button className="btn-undo" style={{ marginLeft: 8 }} onClick={() => setEditRp(true)}>
              {item.reorder_point != null ? 'Edit reorder' : 'Set reorder'}
            </button>
          )}
        </p>
        {isAdmin && editRp && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="input" type="number" min="0" style={{ maxWidth: 140 }}
              placeholder="Reorder point" value={rp} onChange={(e) => setRp(e.target.value)} />
            <button className="btn-undo" onClick={saveRp}>Save</button>
            <button className="btn-undo" onClick={() => { setEditRp(false); setRp(item.reorder_point ?? '') }}>Cancel</button>
          </div>
        )}
      </div>

      {isAdmin ? (
        <div className="row-2btn">
          <button className="btn-big btn-in" onClick={() => onAction('in', item)}>📥 In</button>
          <button className="btn-big btn-out" onClick={() => onAction('out', item)}>📤 Out</button>
        </div>
      ) : (
        <button className="btn-big btn-out" onClick={() => onAction('out', item)}>📤 Out</button>
      )}

      <p className="sub" style={{ marginBottom: 0 }}>History</p>
      {txs === null && <p className="sub">Loading…</p>}
      {txs?.length === 0 && <p className="sub">No history yet</p>}
      {txs?.map((tx) => (
        <div className={'tx-row' + (tx.voided ? ' tx-voided' : '')} key={tx.id}>
          <span className={'tx-ic ' + (tx.type === 'in' ? 'tx-in' : 'tx-out')}>
            {tx.type === 'in' ? '+' : '−'}
          </span>
          <span className="tx-body">
            <span className="tx-name">
              <b className="tx-qty">{tx.type === 'in' ? '+' : '−'}{Number(tx.qty)}</b>
              {tx.note ? ` · ${tx.note}` : ''}
              {tx.voided && <span className="tag-voided">undone</span>}
            </span>
            <span className="tx-meta">
              {fmtDate(tx.created_at)} · by {tx.author?.display_name ?? 'system'}
            </span>
          </span>
          {canUndo(tx) && (
            <button className="btn-undo" onClick={() => onUndo(tx)}>Undo</button>
          )}
        </div>
      ))}
    </div>
  )
}
