import { useState } from 'react'
import { isLow, isOut } from '../lib/data'

export default function Stock({ items, filter, setFilter, onOpenItem }) {
  const [search, setSearch] = useState('')

  let list = items
  if (filter === 'low') list = list.filter(isLow)
  if (filter === 'out') list = list.filter(isOut)
  if (search.trim()) {
    const s = search.trim().toLowerCase()
    list = list.filter((i) => i.catalog.name.toLowerCase().includes(s))
  }
  // low stock floats to top, then alphabetical
  list = [...list].sort((a, b) => {
    const la = isLow(a) ? 0 : 1
    const lb = isLow(b) ? 0 : 1
    return la - lb || a.catalog.name.localeCompare(b.catalog.name)
  })

  return (
    <div className="screen">
      <h1 className="h1">Stock</h1>
      <input
        className="input"
        placeholder="🔍 Search items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="chiprow">
        {[['all', 'All'], ['low', '🔴 Low'], ['out', 'Out']].map(([k, label]) => (
          <button
            key={k}
            className={'chip' + (filter === k ? ' chip-on' : '')}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="sub">No items</p>}
      {list.map((item) => (
        <button
          className={'item-row' + (isLow(item) ? ' item-low' : '')}
          key={item.id}
          onClick={() => onOpenItem(item)}
        >
          <span className="item-name">
            {item.catalog.name}
            <span className="item-unit">{item.catalog.unit}</span>
          </span>
          {isOut(item) ? (
            <span className="tag-low">OUT</span>
          ) : isLow(item) ? (
            <span className="tag-low">LOW</span>
          ) : null}
          <span className={'item-bal' + (isLow(item) ? ' item-bal-low' : '')}>
            {Number(item.balance)}
          </span>
        </button>
      ))}
    </div>
  )
}
