import { fmtDate, isLow } from '../lib/data'

export default function Home({ profile, branch, items, recent, incomingCount, loanCount, onAction, onGoLow, onTransfer, onIncoming, onLoans }) {
  const lowCount = items.filter(isLow).length
  return (
    <div className="screen">
      <div>
        <h1 className="h1">Hello, {profile.display_name} 👋</h1>
        <p className="sub">
          {profile.role === 'admin' ? '👑 Admin' : `Branch ${branch?.name ?? ''}`} ·{' '}
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <div className="statgrid">
        <div className="stat">
          <div className="stat-n">{items.length}</div>
          <div className="stat-l">Items</div>
        </div>
        <button className={'stat' + (lowCount ? ' stat-red' : '')} onClick={onGoLow}>
          <div className="stat-n">{lowCount}</div>
          <div className="stat-l">{lowCount ? 'Low stock — tap to view' : 'Low stock'}</div>
        </button>
      </div>

      {incomingCount > 0 && (
        <button className="incoming-banner" onClick={onIncoming}>
          📬 <b>{incomingCount} incoming</b> — tap to confirm receipt
        </button>
      )}

      <button className="btn-big btn-in" onClick={() => onAction('in')}>📥 Stock In</button>
      <button className="btn-big btn-out" onClick={() => onAction('out')}>📤 Stock Out</button>
      <div className="row-2btn">
        <button className="btn-big btn-transfer" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onTransfer}>
          🔁 Transfer
        </button>
        <button className="btn-big btn-ghost-big" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onLoans}>
          🤝 Loans{loanCount > 0 ? ` (${loanCount})` : ''}
        </button>
      </div>

      <div>
        <p className="sub" style={{ marginBottom: 6 }}>Recent activity</p>
        {recent.length === 0 && <p className="sub">No activity yet</p>}
        {recent.map((tx) => (
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
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
