import { fmtDate, isLow } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function Home({ profile, branch, items, recent, incomingCount, returningCount, requestCount, onAction, onGoLow, onTransfer, onIncoming, onLoans, onRequests, onUsage, onRestock }) {
  const { t, lang } = useT()
  const lowCount = items.filter((i) => i.catalog.active !== false).filter(isLow).length
  return (
    <div className="screen">
      <div>
        <h1 className="h1">{t('home.hello', { name: profile.display_name })}</h1>
        <p className="sub">
          {profile.role === 'admin' ? t('home.admin') : t('home.branch', { name: branch?.name ?? '' })} ·{' '}
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      <div className="statgrid">
        <div className="stat">
          <div className="stat-n">{items.length}</div>
          <div className="stat-l">{t('home.items')}</div>
        </div>
        <button className={'stat' + (lowCount ? ' stat-red' : '')} onClick={onGoLow}>
          <div className="stat-n">{lowCount}</div>
          <div className="stat-l">{lowCount ? t('home.lowTap') : t('home.low')}</div>
        </button>
      </div>

      {incomingCount > 0 && (
        <button className="incoming-banner" onClick={onIncoming}>
          {t('home.incoming', { n: incomingCount })}
        </button>
      )}

      {requestCount > 0 && (
        <button className="request-banner" onClick={onRequests}>
          {t('home.requestBanner', { n: requestCount })}
        </button>
      )}

      {returningCount > 0 && (
        <button className="return-banner" onClick={onLoans}>
          {t('home.returning', { n: returningCount })}
        </button>
      )}

      {profile.role === 'admin' && (
        <button className="btn-big btn-in" onClick={() => onAction('in')}>{t('home.stockIn')}</button>
      )}
      <button className="btn-big btn-out" onClick={() => onAction('out')}>{t('home.stockOut')}</button>
      <div className="row-2btn">
        <button className="btn-big btn-transfer" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onTransfer}>
          {t('home.transfer')}
        </button>
        <button className="btn-big btn-ghost-big" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onLoans}>
          {t('home.loans')}
        </button>
      </div>
      <div className="row-2btn">
        <button className="btn-big btn-ghost-big" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onRequests}>
          {t('home.requests')}
        </button>
        <button className="btn-big btn-ghost-big" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onIncoming}>
          {t('home.incomingNav')}
        </button>
      </div>
      <div className="row-2btn">
        <button className="btn-big btn-ghost-big" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onUsage}>
          {t('adm.usage')}
        </button>
        <button className="btn-big btn-ghost-big" style={{ padding: 12, fontSize: '0.92rem' }} onClick={onRestock}>
          {t('adm.restock')}
        </button>
      </div>

      <div>
        <p className="sub" style={{ marginBottom: 6 }}>{t('home.recent')}</p>
        {recent.length === 0 && <p className="sub">{t('home.none')}</p>}
        {recent.map((tx) => (
          <div className={'tx-row' + (tx.voided ? ' tx-voided' : '')} key={tx.id}>
            <span className={'tx-ic ' + (tx.type === 'in' ? 'tx-in' : 'tx-out')}>
              {tx.type === 'in' ? '+' : '−'}
            </span>
            <span className="tx-body">
              <span className="tx-name">
                {tx.items.catalog.name}{' '}
                <b className="tx-qty">{tx.type === 'in' ? '+' : '−'}{Number(tx.qty)}</b>
                {tx.voided && <span className="tag-voided">{t('tag.undone')}</span>}
              </span>
              {secondaryName(tx.items.catalog, lang) && (
                <span className="item-secondary">{secondaryName(tx.items.catalog, lang)}</span>
              )}
              <span className="tx-meta">
                {fmtDate(tx.created_at, lang)} · {t('by')} {tx.author?.display_name ?? 'system'}
              </span>
              {tx.note && <span className="tx-note">📝 {tx.note}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
