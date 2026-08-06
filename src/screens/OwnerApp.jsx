import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllItems, fetchBranches, fetchTransactions, fmtDate, isLow } from '../lib/data'
import { LANGS, secondaryName, useT } from '../lib/i18n'
import DailyUsage from './DailyUsage'

function txLabel(t, tx) {
  const note = tx.note ?? ''
  const sent = note.match(/^Sent to (.+)$/)
  const recv = note.match(/^Received from (.+)$/)
  if (sent) return t('own.sent', { b: sent[1] })
  if (recv) return t('own.recv', { b: recv[1] })
  return tx.type === 'in' ? t('own.restocked') : t('own.used')
}

export default function OwnerApp() {
  const { lang, t, setLang } = useT()
  const [branches, setBranches] = useState([])
  const [items, setItems] = useState([])
  const [branch, setBranch] = useState(null)
  const [filter, setFilter] = useState('all')
  const [item, setItem] = useState(null)
  const [txs, setTxs] = useState(null)
  const [txsError, setTxsError] = useState(false)
  const [showUsage, setShowUsage] = useState(false)
  const [showRestock, setShowRestock] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    function load() {
      fetchBranches().then(setBranches).catch(() => setLoadError(true))
      fetchAllItems().then((d) => { setItems(d); setLoadError(false) }).catch(() => setLoadError(true))
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!item) return
    setTxs(null)
    setTxsError(false)
    fetchTransactions({ itemId: item.id, limit: 40 }).then(setTxs).catch(() => setTxsError(true))
  }, [item])

  const lowCount = (bid) => items.filter((i) => i.branch_id === bid && i.catalog.active !== false && isLow(i)).length

  if (showUsage) {
    return (
      <div className="app-wrap">
        <main className="app-body">
          <div className="screen">
            <DailyUsage branches={branches} onExit={() => setShowUsage(false)} />
          </div>
        </main>
      </div>
    )
  }

  if (showRestock) {
    return (
      <div className="app-wrap">
        <main className="app-body">
          <div className="screen">
            <DailyUsage branches={branches} type="in" onExit={() => setShowRestock(false)} />
          </div>
        </main>
      </div>
    )
  }

  if (item) {
    return (
      <div className="app-wrap">
        <main className="app-body">
          <div className="screen">
            <button className="btn-back" onClick={() => setItem(null)}>{t('back')}</button>
            <h1 className="h1">{item.catalog.name}</h1>
            {secondaryName(item.catalog, lang) && (
              <p className="item-secondary-title">{secondaryName(item.catalog, lang)}</p>
            )}
            <p className="sub">
              {t('own.balance')}:{' '}
              <b className={isLow(item) ? 'text-danger' : ''} style={{ fontSize: '1.1rem' }}>
                {Number(item.balance)} {item.catalog.unit}
              </b>
            </p>
            <p className="sub" style={{ margin: 0 }}>{t('item.history')}</p>
            {txsError && <div className="alert-danger">{t('err.load')}</div>}
            {txs === null && !txsError && <p className="sub">…</p>}
            {txs?.filter((x) => !x.voided).map((tx) => (
              <div className="tx-row" key={tx.id}>
                <span className={'tx-ic ' + (tx.type === 'in' ? 'tx-in' : 'tx-out')}>
                  {tx.type === 'in' ? '+' : '−'}
                </span>
                <span className="tx-body">
                  <span className="tx-name">
                    {txLabel(t, tx)} <b className="tx-qty">{tx.type === 'in' ? '+' : '−'}{Number(tx.qty)}</b>
                  </span>
                  <span className="tx-meta">
                    {fmtDate(tx.created_at, lang)} · {t('by')} {tx.author?.display_name ?? 'system'}
                  </span>
                </span>
              </div>
            ))}
            <p className="sub center">👁️ {t('own.view')}</p>
          </div>
        </main>
      </div>
    )
  }

  if (branch) {
    let list = items.filter((i) => i.branch_id === branch.id)
    if (filter === 'low') list = list.filter((i) => i.catalog.active !== false).filter(isLow)
    list = [...list].sort((a, b) => (isLow(a) ? 0 : 1) - (isLow(b) ? 0 : 1) || a.catalog.name.localeCompare(b.catalog.name))
    return (
      <div className="app-wrap">
        <main className="app-body">
          <div className="screen">
            <button className="btn-back" onClick={() => setBranch(null)}>{t('back')}</button>
            <h1 className="h1">{branch.name}</h1>
            <div className="chiprow">
              <button className={'chip' + (filter === 'low' ? ' chip-on' : '')} onClick={() => setFilter('low')}>
                {t('stock.low')}
              </button>
              <button className={'chip' + (filter === 'all' ? ' chip-on' : '')} onClick={() => setFilter('all')}>
                {t('stock.all')}
              </button>
            </div>
            {filter === 'low' && list.length === 0 && <p className="sub">{t('own.fine')}</p>}
            {list.map((i) => (
              <button className={'item-row' + (isLow(i) ? ' item-low' : '')} key={i.id} onClick={() => setItem(i)}>
                <span className="item-name">
                  {i.catalog.name}
                  {secondaryName(i.catalog, lang) && (
                    <span className="item-secondary">{secondaryName(i.catalog, lang)}</span>
                  )}
                  <span className="item-unit">{i.catalog.unit}</span>
                </span>
                <span className={'item-bal' + (isLow(i) ? ' item-bal-low' : '')}>{Number(i.balance)}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-wrap">
      <main className="app-body">
        <div className="screen">
          <div>
            <h1 className="h1">
              ABC Hotels <span className="pill-view">👁️ {t('own.view')}</span>
            </h1>
            <p className="sub">
              {t('own.today')} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {loadError && <div className="alert-danger">{t('err.load')}</div>}
          {branches.map((b) => {
            const n = lowCount(b.id)
            return (
              <button className="item-row" key={b.id} style={{ padding: '16px 14px' }}
                onClick={() => { setBranch(b); setFilter(n > 0 ? 'low' : 'all') }}>
                <span className="item-name" style={{ fontSize: '1.05rem' }}>{b.name}</span>
                {n > 0 ? (
                  <>
                    <span className="tag-low">{t('own.low', { n })}</span>
                    <span className="item-bal">🔴</span>
                  </>
                ) : (
                  <span className="item-bal" style={{ color: 'var(--in)', fontSize: '0.9rem' }}>{t('own.ok')}</span>
                )}
              </button>
            )
          })}
          <p className="sub center">{t('own.hint')}</p>

          <button className="btn-big btn-transfer" onClick={() => setShowUsage(true)}>
            {t('adm.usage')}
          </button>
          <button className="btn-big btn-transfer" onClick={() => setShowRestock(true)}>
            {t('adm.restock')}
          </button>

          <div className="me-card">
            <b>🌐 {t('me.language')}</b>
            <div className="chiprow" style={{ marginTop: 10 }}>
              {LANGS.map((l) => (
                <button key={l.code} className={'chip' + (lang === l.code ? ' chip-on' : '')}
                  onClick={() => setLang(l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-big btn-ghost-big" onClick={() => supabase.auth.signOut()}>
            {t('me.signOut')}
          </button>
        </div>
      </main>
    </div>
  )
}
