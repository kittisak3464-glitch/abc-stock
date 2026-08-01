import { useState } from 'react'
import { isLow, isOut, recordTransaction } from '../lib/data'

// Two-step flow: pick item (if not preselected) -> qty + note + review -> saved
export default function Record({ type, presetItem, items, userId, onDone, onCancel }) {
  const [item, setItem] = useState(presetItem ?? null)
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isIn = type === 'in'
  const title = isIn ? '📥 Stock In' : '📤 Stock Out'
  const color = isIn ? 'in' : 'out'

  async function save() {
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

  // step 1: pick item
  if (!item) {
    const s = search.trim().toLowerCase()
    const list = items
      .filter((i) => !s || i.catalog.name.toLowerCase().includes(s))
      .sort((a, b) => a.catalog.name.localeCompare(b.catalog.name))
    return (
      <div className="screen">
        <button className="btn-back" onClick={onCancel}>‹ Cancel</button>
        <h1 className={'h1 text-' + color}>{title}</h1>
        <input
          className="input"
          placeholder="🔍 Search items…"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {list.map((i) => (
          <button
            className={'item-row' + (isLow(i) ? ' item-low' : '')}
            key={i.id}
            onClick={() => setItem(i)}
          >
            <span className="item-name">
              {i.catalog.name}
              <span className="item-unit">On hand: {Number(i.balance)} {i.catalog.unit}</span>
            </span>
            <span className="item-bal">›</span>
          </button>
        ))}
      </div>
    )
  }

  // step 2: qty + review + confirm
  const after = Number(item.balance) + (isIn ? qty : -qty)
  const overdraw = !isIn && after < 0
  return (
    <div className="screen">
      <button className="btn-back" onClick={() => (presetItem ? onCancel() : setItem(null))}>
        ‹ Back
      </button>
      <h1 className={'h1 text-' + color}>{title}</h1>

      <div className="item-row" style={{ cursor: 'default' }}>
        <span className="item-name">
          {item.catalog.name}
          <span className="item-unit">On hand: {Number(item.balance)} {item.catalog.unit}</span>
        </span>
        <span className="item-bal">✓</span>
      </div>

      <p className="sub center" style={{ margin: 0 }}>{isIn ? 'Quantity in' : 'Quantity out'}</p>
      <div className="qtyrow">
        <button className="qbtn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
        <input
          className="qnum"
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
        />
        <button className="qbtn" onClick={() => setQty(qty + 1)}>+</button>
      </div>

      <input
        className="input"
        placeholder="Note (optional) e.g. Daily use"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className={'confirm confirm-' + color}>
        <div className="confirm-a">REVIEW BEFORE SAVING</div>
        <div className="confirm-b">{item.catalog.name}</div>
        <div className={'confirm-c text-' + color}>
          {isIn ? '+' : '−'} {qty} {item.catalog.unit}
        </div>
        <div className="confirm-d">Balance after: {after}</div>
      </div>

      {overdraw && (
        <div className="alert-danger">
          Not enough stock — on hand is {Number(item.balance)}. Check the quantity.
        </div>
      )}
      {error && <div className="alert-danger">{error}</div>}

      <button
        className={'btn-big btn-' + color}
        disabled={busy || overdraw}
        onClick={save}
      >
        {busy ? 'Saving…' : isIn ? 'Confirm Stock In' : 'Confirm Stock Out'}
      </button>
    </div>
  )
}
