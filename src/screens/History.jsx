import { useEffect, useState } from 'react'
import { fetchTransactions, fmtDate } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

// Supabase caps a single request at 1000 rows by default
const HISTORY_LIMIT = 1000

export default function History({ branchId, txs: recentTxs, canUndo, onUndo }) {
  const { t, lang } = useT()
  const [txs, setTxs] = useState(null)
  const [search, setSearch] = useState('')

  // Re-fetch when the app's recent list refreshes (poll / after undo) so this stays current
  useEffect(() => {
    if (!branchId) return
    fetchTransactions({ branchId, limit: HISTORY_LIMIT }).then(setTxs).catch(console.error)
  }, [branchId, recentTxs])

  const q = search.trim().toLowerCase()
  const shown = q
    ? txs?.filter((tx) => {
        const c = tx.items.catalog
        const hay = [c.name, c.name_th, c.name_zh, c.name_my, tx.note, tx.author?.display_name, fmtDate(tx.created_at, lang)]
        return hay.some((s) => s && String(s).toLowerCase().includes(q))
      })
    : txs

  return (
    <div className="screen">
      <h1 className="h1">{t('nav.history')}</h1>
      <input className="input" placeholder={t('history.search')} value={search}
        onChange={(e) => setSearch(e.target.value)} />
      {txs === null && <p className="sub">{t('item.loading')}</p>}
      {shown?.length === 0 && <p className="sub">{t('home.none')}</p>}
      {shown?.map((tx) => (
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
          {canUndo(tx) && (
            <button className="btn-undo" onClick={() => onUndo(tx)}>{t('undo')}</button>
          )}
        </div>
      ))}
    </div>
  )
}
