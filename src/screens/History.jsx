import { fmtDate } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function History({ txs, canUndo, onUndo }) {
  const { t, lang } = useT()
  return (
    <div className="screen">
      <h1 className="h1">{t('nav.history')}</h1>
      {txs === null && <p className="sub">{t('item.loading')}</p>}
      {txs?.length === 0 && <p className="sub">{t('home.none')}</p>}
      {txs?.map((tx) => (
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
              {fmtDate(tx.created_at)} · {t('by')} {tx.author?.display_name ?? 'system'}
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
