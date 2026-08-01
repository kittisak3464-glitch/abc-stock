import { fmtDate } from '../lib/data'

export default function History({ txs, canUndo, onUndo }) {
  return (
    <div className="screen">
      <h1 className="h1">History</h1>
      {txs === null && <p className="sub">Loading…</p>}
      {txs?.length === 0 && <p className="sub">No activity yet</p>}
      {txs?.map((tx) => (
        <div className={'tx-row' + (tx.voided ? ' tx-voided' : '')} key={tx.id}>
          <span className={'tx-ic ' + (tx.type === 'in' ? 'tx-in' : 'tx-out')}>
            {tx.type === 'in' ? '+' : '−'}
          </span>
          <span className="tx-body">
            <span className="tx-name">
              {tx.items.catalog.name}{' '}
              <b className="tx-qty">{tx.type === 'in' ? '+' : '−'}{Number(tx.qty)}</b>
              {tx.voided && <span className="tag-voided">undone</span>}
            </span>
            <span className="tx-meta">
              {fmtDate(tx.created_at)} · by {tx.author?.display_name ?? 'system'}
              {tx.note ? ` · ${tx.note}` : ''}
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
