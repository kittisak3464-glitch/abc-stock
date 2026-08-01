import { useState } from 'react'
import { isLow, recordTransaction } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function Record({ type, presetItem, items, userId, onDone, onCancel }) {
  const { t, lang } = useT()
  const [item, setItem] = useState(presetItem ?? null)
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isIn = type === 'in'
  const title = isIn ? t('home.stockIn') : t('home.stockOut')
  const color = isIn ? 'in' : 'out'

  async function save() {
    if (!note.trim()) return setError(t('rec.noteReq'))
    setBusy(true)
    setError('')
    try {
      const txId = await recordTransaction({ itemId: item.id, type, qty, note, userId })
      onDone(txId, item, qty)
    } catch (e) {
      setError(e.message ?? 'Could not save — try again')
      setBusy(false)
    }
  }

  if (!item) {
    const s = search.trim().toLowerCase()
    const list = items
      .filter((i) => !s || i.catalog.name.toLowerCase().includes(s))
      .sort((a, b) => a.catalog.name.localeCompare(b.catalog.name))
    return (
      <div className="screen">
        <button className="btn-back" onClick={onCancel}>{t('cancel')}</button>
        <h1 className={'h1 text-' + color}>{title}</h1>
        <input className="input" placeholder={t('stock.search')} autoFocus value={search}
          onChange={(e) => setSearch(e.target.value)} />
        {list.map((i) => (
          <button className={'item-row' + (isLow(i) ? ' item-low' : '')} key={i.id} onClick={() => setItem(i)}>
            <span className="item-name">
              {i.catalog.name}
              {secondaryName(i.catalog, lang) && (
                <span className="item-secondary">{secondaryName(i.catalog, lang)}</span>
              )}
              <span className="item-unit">{t('onHand')}: {Number(i.balance)} {i.catalog.unit}</span>
            </span>
            <span className="item-bal">›</span>
          </button>
        ))}
      </div>
    )
  }

  const after = Number(item.balance) + (isIn ? qty : -qty)
  const overdraw = !isIn && after < 0
  return (
    <div className="screen">
      <button className="btn-back" onClick={() => (presetItem ? onCancel() : setItem(null))}>
        {t('back')}
      </button>
      <h1 className={'h1 text-' + color}>{title}</h1>

      <div className="item-row" style={{ cursor: 'default' }}>
        <span className="item-name">
          {item.catalog.name}
          {secondaryName(item.catalog, lang) && (
            <span className="item-secondary">{secondaryName(item.catalog, lang)}</span>
          )}
          <span className="item-unit">{t('onHand')}: {Number(item.balance)} {item.catalog.unit}</span>
        </span>
        <span className="item-bal">✓</span>
      </div>

      <p className="sub center" style={{ margin: 0 }}>{isIn ? t('rec.qtyIn') : t('rec.qtyOut')}</p>
      <div className="qtyrow">
        <button className="qbtn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
        <input className="qnum" type="number" min="1" value={qty}
          onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
        <button className="qbtn" onClick={() => setQty(qty + 1)}>+</button>
      </div>

      <input className="input" placeholder={t('rec.note')} value={note}
        onChange={(e) => setNote(e.target.value)} />

      <div className={'confirm confirm-' + color}>
        <div className="confirm-a">{t('rec.review')}</div>
        <div className="confirm-b">
          {item.catalog.name}
          {secondaryName(item.catalog, lang) && (
            <span className="item-secondary" style={{ display: 'block' }}>{secondaryName(item.catalog, lang)}</span>
          )}
        </div>
        <div className={'confirm-c text-' + color}>
          {isIn ? '+' : '−'} {qty} {item.catalog.unit}
        </div>
        <div className="confirm-d">{t('rec.after', { n: after })}</div>
      </div>

      {overdraw && <div className="alert-danger">{t('rec.notEnough', { n: Number(item.balance) })}</div>}
      {error && <div className="alert-danger">{error}</div>}

      <button className={'btn-big btn-' + color} disabled={busy || overdraw || !note.trim()} onClick={save}>
        {busy ? t('rec.saving') : isIn ? t('rec.inBtn') : t('rec.outBtn')}
      </button>
    </div>
  )
}
