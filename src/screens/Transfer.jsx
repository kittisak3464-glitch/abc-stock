import { useEffect, useState } from 'react'
import { fetchItems, signedRpc } from '../lib/data'

export default function Transfer({ profile, branches, myEmail, defaultFrom, onDone, onCancel }) {
  const isAdmin = profile.role === 'admin'
  const [fromId, setFromId] = useState(defaultFrom)
  const [toId, setToId] = useState(null)
  const [items, setItems] = useState([])
  const [item, setItem] = useState(null)
  const [search, setSearch] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setItem(null)
    fetchItems(fromId).then(setItems).catch(console.error)
  }, [fromId])

  const from = branches.find((b) => b.id === fromId)
  const to = branches.find((b) => b.id === toId)
  const crossGroup = from && to && from.procurement_group !== to.procurement_group

  async function send() {
    setBusy(true)
    setError('')
    try {
      await signedRpc(myEmail, password, 'send_transfer', {
        p_from_branch: fromId,
        p_to_branch: toId,
        p_catalog_id: item.catalog_id,
        p_qty: qty,
        p_note: note || null,
      })
      onDone(`Sent ✓ ${item.catalog.name} ×${qty} → ${to.name}${crossGroup ? ' (LOAN)' : ''}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const s = search.trim().toLowerCase()
  const pickList = items
    .filter((i) => Number(i.balance) > 0)
    .filter((i) => !s || i.catalog.name.toLowerCase().includes(s))

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>‹ Cancel</button>
      <h1 className="h1 text-transfer">🔁 Transfer</h1>

      {isAdmin && (
        <>
          <p className="sub" style={{ margin: 0 }}>From branch</p>
          <div className="chiprow">
            {branches.map((b) => (
              <button key={b.id} className={'chip' + (fromId === b.id ? ' chip-on' : '')}
                onClick={() => setFromId(b.id)}>{b.name}</button>
            ))}
          </div>
        </>
      )}
      {!isAdmin && <p className="sub" style={{ margin: 0 }}>From: <b>{from?.name}</b></p>}

      <p className="sub" style={{ margin: 0 }}>To branch</p>
      <div className="chiprow">
        {branches.filter((b) => b.id !== fromId).map((b) => (
          <button key={b.id} className={'chip' + (toId === b.id ? ' chip-on' : '')}
            onClick={() => setToId(b.id)}>{b.name}</button>
        ))}
      </div>

      {crossGroup && (
        <div className="alert-loan">
          ⚠️ Different procurement group — this will be a <b>LOAN</b> and must be returned
        </div>
      )}

      {toId && !item && (
        <>
          <input className="input" placeholder="🔍 Search items…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
          {pickList.map((i) => (
            <button className="item-row" key={i.id} onClick={() => setItem(i)}>
              <span className="item-name">
                {i.catalog.name}
                <span className="item-unit">On hand: {Number(i.balance)} {i.catalog.unit}</span>
              </span>
              <span className="item-bal">›</span>
            </button>
          ))}
        </>
      )}

      {toId && item && (
        <>
          <button className="item-row" onClick={() => setItem(null)}>
            <span className="item-name">
              {item.catalog.name}
              <span className="item-unit">{from?.name} on hand: {Number(item.balance)} {item.catalog.unit}</span>
            </span>
            <span className="item-bal">✓</span>
          </button>

          <div className="qtyrow">
            <button className="qbtn" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <input className="qnum" type="number" min="1" value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
            <button className="qbtn" onClick={() => setQty(qty + 1)}>+</button>
          </div>
          {qty > Number(item.balance) && (
            <div className="alert-danger">Not enough stock — on hand is {Number(item.balance)}</div>
          )}

          <input className="input" placeholder="Note (optional)" value={note}
            onChange={(e) => setNote(e.target.value)} />
          <input className="input" type="password" autoComplete="current-password"
            placeholder="🔒 Your password to sign as SENDER"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="alert-danger">{error}</div>}
          <button className="btn-big btn-transfer" disabled={busy || !password || qty > Number(item.balance)}
            onClick={send}>
            {busy ? 'Sending…' : `Send ${qty} → ${to?.name}`}
          </button>
          <p className="sub center">Stock leaves {from?.name} now · {to?.name} must confirm receipt</p>
        </>
      )}
    </div>
  )
}
