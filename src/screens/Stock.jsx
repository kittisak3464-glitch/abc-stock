import { useState } from 'react'
import { isLow, isOut } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function Stock({ items, filter, setFilter, onOpenItem }) {
  const { t, lang } = useT()
  const [search, setSearch] = useState('')

  let list = items
  if (filter === 'low') list = list.filter(isLow)
  if (filter === 'out') list = list.filter(isOut)
  if (search.trim()) {
    const s = search.trim().toLowerCase()
    list = list.filter((i) => i.catalog.name.toLowerCase().includes(s))
  }
  list = [...list].sort((a, b) => {
    const la = isLow(a) ? 0 : 1
    const lb = isLow(b) ? 0 : 1
    return la - lb || a.catalog.name.localeCompare(b.catalog.name)
  })

  return (
    <div className="screen">
      <h1 className="h1">{t('stock.title')}</h1>
      <input className="input" placeholder={t('stock.search')} value={search}
        onChange={(e) => setSearch(e.target.value)} />
      <div className="chiprow">
        {[['all', t('stock.all')], ['low', t('stock.low')], ['out', t('stock.out')]].map(([k, label]) => (
          <button key={k} className={'chip' + (filter === k ? ' chip-on' : '')} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="sub">{t('stock.none')}</p>}
      {list.map((item) => (
        <button className={'item-row' + (isLow(item) ? ' item-low' : '')} key={item.id}
          onClick={() => onOpenItem(item)}>
          <span className="item-name">
            {item.catalog.name}
            {secondaryName(item.catalog, lang) && (
              <span className="item-secondary">{secondaryName(item.catalog, lang)}</span>
            )}
            <span className="item-unit">{item.catalog.unit}</span>
          </span>
          {isOut(item) ? (
            <span className="tag-low">{t('tag.out')}</span>
          ) : isLow(item) ? (
            <span className="tag-low">{t('tag.low')}</span>
          ) : null}
          <span className={'item-bal' + (isLow(item) ? ' item-bal-low' : '')}>
            {Number(item.balance)}
          </span>
        </button>
      ))}
    </div>
  )
}
