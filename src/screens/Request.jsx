import { useEffect, useState } from 'react'
import { fetchBranchStock, fetchCatalog, fetchItemBranchStock, requestTransfer } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function Request({ profile, branches, defaultTo, transfers, onDone, onCancel }) {
  const { t, lang } = useT()
  const isAdmin = profile.role === 'admin'
  const [toId, setToId] = useState(defaultTo)
  const [fromId, setFromId] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [stock, setStock] = useState({})
  const [item, setItem] = useState(null)
  const [otherStock, setOtherStock] = useState({})
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(console.error)
  }, [])

  useEffect(() => {
    setStock({})
    if (fromId) fetchBranchStock(fromId).then(setStock).catch(console.error)
  }, [fromId])

  useEffect(() => {
    setOtherStock({})
    if (item) fetchItemBranchStock(item.id).then(setOtherStock).catch(console.error)
  }, [item])

  const to = branches.find((b) => b.id === toId)
  const from = branches.find((b) => b.id === fromId)
  const crossGroup = from && to && from.procurement_group !== to.procurement_group
  const duplicate = item && transfers?.find((tr) =>
    ['requested', 'in_transit'].includes(tr.status) &&
    tr.catalog_id === item.id && tr.from_branch === fromId && tr.to_branch === toId
  )

  async function send() {
    if (!note.trim()) return setError(t('rec.noteReq'))
    setBusy(true)
    setError('')
    try {
      await requestTransfer({ fromBranch: fromId, toBranch: toId, catalogId: item.id, qty, note })
      onDone(t('req.sent', { i: item.name, n: qty, b: from?.name }))
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const s = search.trim().toLowerCase()
  const pickList = catalog
    .filter((c) => c.active)
    .filter((c) => !s || c.name.toLowerCase().includes(s))

  const onHand = stock[item?.id] ?? 0
  const overAsk = item && qty > onHand
  const otherBranches = item
    ? branches
        .filter((b) => b.id !== fromId && b.id !== toId)
        .map((b) => ({ ...b, balance: otherStock[b.id] ?? 0 }))
        .sort((a, b) => b.balance - a.balance)
    : []
  const anyOtherStock = otherBranches.some((b) => b.balance >= qty)

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>{t('cancel')}</button>
      <h1 className="h1 text-transfer">{t('req.title')}</h1>

      {isAdmin ? (
        <>
          <p className="sub" style={{ margin: 0 }}>{t('req.for')}</p>
          <div className="chiprow">
            {branches.map((b) => (
              <button key={b.id} className={'chip' + (toId === b.id ? ' chip-on' : '')}
                onClick={() => { setToId(b.id); setFromId(null) }}>{b.name}</button>
            ))}
          </div>
        </>
      ) : (
        <p className="sub" style={{ margin: 0 }}>{t('req.forIs')}: <b>{to?.name}</b></p>
      )}

      <p className="sub" style={{ margin: 0 }}>{t('req.from')}</p>
      <div className="chiprow">
        {branches.filter((b) => b.id !== toId).map((b) => (
          <button key={b.id} className={'chip' + (fromId === b.id ? ' chip-on' : '')}
            onClick={() => setFromId(b.id)}>{b.name}</button>
        ))}
      </div>

      {crossGroup && <div className="alert-loan">{t('tr.loanWarn')}</div>}

      {fromId && !item && (
        <>
          <input className="input" placeholder={t('stock.search')} value={search}
            onChange={(e) => setSearch(e.target.value)} />
          {pickList.map((c) => (
            <button className="item-row" key={c.id} onClick={() => setItem(c)}>
              <span className="item-name">
                {c.name}
                {secondaryName(c, lang) && (
                  <span className="item-secondary">{secondaryName(c, lang)}</span>
                )}
                <span className="item-unit">{t('onHand')}: {stock[c.id] ?? 0} {c.unit}</span>
              </span>
              <span className="item-bal">›</span>
            </button>
          ))}
        </>
      )}

      {fromId && item && (
        <>
          <button className="item-row" onClick={() => setItem(null)}>
            <span className="item-name">
              {item.name}
              {secondaryName(item, lang) && (
                <span className="item-secondary">{secondaryName(item, lang)}</span>
              )}
              <span className="item-unit">{t('onHand')}: {onHand} {item.unit}</span>
            </span>
            <span className="item-bal">✓</span>
          </button>

          {duplicate && (
            <div className="alert-loan">
              {t('dup.warn', { i: item.name, n: duplicate.qty, a: from?.name, b: to?.name })}
            </div>
          )}

          <div className="qtyrow">
            <button className="qbtn" onClick={() => setQty(Math.max(1, Math.floor(qty) - 1))}>−</button>
            <input className="qnum" type="number" min="0.01" step="any" value={qty}
              onChange={(e) => setQty(Math.max(0.01, Number(e.target.value) || 1))} />
            <button className="qbtn" onClick={() => setQty(Math.floor(qty) + 1)}>+</button>
          </div>

          {overAsk && (
            <>
              <div className="alert-danger">{t('req.overAsk', { b: from?.name, n: onHand })}</div>
              {otherBranches.length > 0 && (
                <div className="item-unit" style={{ margin: '4px 0' }}>
                  {t('req.otherBranches')}{' '}
                  {otherBranches.map((b) => (
                    <button key={b.id} className={'chip' + (b.balance >= qty ? ' chip-on' : '')}
                      style={{ margin: '2px 4px 2px 0' }} onClick={() => setFromId(b.id)}>
                      {b.name} {b.balance}
                    </button>
                  ))}
                </div>
              )}
              {!anyOtherStock && (
                <div className="item-unit text-danger">{t('req.noOtherStock')}</div>
              )}
            </>
          )}

          <input className="input" placeholder={t('req.note')} value={note}
            onChange={(e) => setNote(e.target.value)} />
          {error && <div className="alert-danger">{error}</div>}
          <button className="btn-big btn-transfer" disabled={busy || !note.trim() || overAsk} onClick={send}>
            {busy ? t('req.sending') : t('req.send', { n: qty, b: from?.name })}
          </button>
          <p className="sub center">{t('req.hint', { a: from?.name, b: to?.name })}</p>
        </>
      )}
    </div>
  )
}
