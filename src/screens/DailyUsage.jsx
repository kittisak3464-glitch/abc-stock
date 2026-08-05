import { useEffect, useState } from 'react'
import { fetchDailyTransactions, fmtDate, todayBangkok } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

function summarize(entries) {
  const totals = {}
  for (const e of entries) {
    const cur = totals[e.name] ?? { qty: 0, unit: e.unit, name_th: e.name_th, name_zh: e.name_zh, name_my: e.name_my }
    cur.qty += e.qty
    totals[e.name] = cur
  }
  return totals
}

// Detail screen: every recorded entry (with note) for one item on one day
function ItemUsageDetail({ branchName, name, entries, onBack, type }) {
  const { t, lang } = useT()
  const total = entries.reduce((sum, e) => sum + e.qty, 0)
  const q = total === Math.round(total) ? total : total.toFixed(1)
  const sec = secondaryName(entries[0], lang)
  const sign = type === 'in' ? '+' : '−'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button className="btn-back" onClick={onBack}>{t('back')}</button>
      <div>
        <h1 className="h1">{name}</h1>
        {sec && <p className="item-secondary-title">{sec}</p>}
        <p className="sub">{branchName} · {q} {entries[0]?.unit}</p>
      </div>
      {entries.map((e, i) => (
        <div className="tx-row" key={i}>
          <span className={'tx-ic ' + (type === 'in' ? 'tx-in' : 'tx-out')}>{sign}</span>
          <span className="tx-body">
            <span className="tx-name">
              <b className="tx-qty">{sign}{e.qty} {e.unit}</b>
            </span>
            <span className="tx-meta">
              {fmtDate(e.time)} · {t('by')} {e.author ?? 'system'}
            </span>
            {e.note && <span className="tx-note">📝 {e.note}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DailyUsage({ branches, onExit, type = 'out' }) {
  const { t, lang } = useT()
  const [date, setDate] = useState(todayBangkok())
  const [byBranch, setByBranch] = useState(null)
  const [msg, setMsg] = useState('')
  const [openItem, setOpenItem] = useState(null) // { branchId, branchName, name }

  const titleKey = type === 'in' ? 'restock.title' : 'usage.title'
  const noneKey = type === 'in' ? 'restock.none' : 'usage.none'

  useEffect(() => {
    setByBranch(null)
    setOpenItem(null)
    fetchDailyTransactions(date, type).then(setByBranch).catch(console.error)
  }, [date, type])

  const dateLabel = new Date(`${date}T12:00:00+07:00`).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const allTotals = byBranch ? summarize(Object.values(byBranch).flat()) : null

  function buildText() {
    const lines = [`${t(titleKey)} ${dateLabel}`, '']
    lines.push(`📊 ${t('usage.allBranches')}`)
    if (!allTotals || Object.keys(allTotals).length === 0) {
      lines.push(`• ${t(noneKey)}`)
    } else {
      for (const name of Object.keys(allTotals).sort()) {
        const { qty, unit } = allTotals[name]
        const q = qty === Math.round(qty) ? qty : qty.toFixed(1)
        lines.push(`• ${name} ${q} ${unit}`)
      }
    }
    lines.push('')
    lines.push(`— ${t('usage.byBranch')} —`, '')
    for (const b of [...branches].sort((a, c) => a.name.localeCompare(c.name))) {
      lines.push(`🏨 ${b.name}`)
      const entries = byBranch?.[b.id]
      if (!entries || entries.length === 0) {
        lines.push(`• ${t(noneKey)}`)
      } else {
        const totals = summarize(entries)
        for (const name of Object.keys(totals).sort()) {
          const { qty, unit } = totals[name]
          const q = qty === Math.round(qty) ? qty : qty.toFixed(1)
          lines.push(`• ${name} ${q} ${unit}`)
        }
      }
      lines.push('')
    }
    return lines.join('\n').trim()
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(buildText())
      setMsg(t('usage.copied'))
      setTimeout(() => setMsg(''), 3000)
    } catch {
      setMsg(buildText())
    }
  }

  if (openItem) {
    return (
      <ItemUsageDetail
        branchName={openItem.branchName}
        name={openItem.name}
        type={type}
        entries={byBranch[openItem.branchId].filter((e) => e.name === openItem.name)}
        onBack={() => setOpenItem(null)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {onExit && (
        <>
          <button className="btn-back" onClick={onExit}>{t('back')}</button>
          <h1 className="h1">{t(titleKey)}</h1>
        </>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input className="input" type="date" value={date} max={todayBangkok()}
          onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
        <button className="chip" onClick={() => setDate(todayBangkok())}>{t('usage.today')}</button>
      </div>

      <button className="btn-big btn-accent" onClick={copyText}>{t('usage.copy')}</button>
      {msg && <div className="alert-ok">{msg}</div>}

      {byBranch === null && <p className="sub">{t('item.loading')}</p>}

      {byBranch && (
        <div className="summary-card">
          <p className="summary-label">📊 {t('usage.allBranches')}</p>
          {!allTotals || Object.keys(allTotals).length === 0 ? (
            <p className="sub" style={{ margin: '0 0 10px' }}>{t(noneKey)}</p>
          ) : (
            Object.keys(allTotals).sort().map((name) => {
              const { qty, unit } = allTotals[name]
              const q = qty === Math.round(qty) ? qty : qty.toFixed(1)
              const sec = secondaryName(allTotals[name], lang)
              return (
                <div className="item-row" key={name}>
                  <span className="item-name">
                    {name}
                    {sec && <span className="item-secondary">{sec}</span>}
                  </span>
                  <span className="item-bal">{q} {unit}</span>
                </div>
              )
            })
          )}
        </div>
      )}

      {byBranch && <p className="section-divider">{t('usage.byBranch')}</p>}

      {byBranch && [...branches].sort((a, b) => a.name.localeCompare(b.name)).map((b) => {
        const entries = byBranch[b.id]
        const totals = entries ? summarize(entries) : null
        return (
          <div key={b.id}>
            <p className="sub" style={{ margin: '0 0 6px', fontWeight: 700 }}>🏨 {b.name}</p>
            {!totals || Object.keys(totals).length === 0 ? (
              <p className="sub" style={{ marginLeft: 4 }}>{t(noneKey)}</p>
            ) : (
              Object.keys(totals).sort().map((name) => {
                const { qty, unit } = totals[name]
                const q = qty === Math.round(qty) ? qty : qty.toFixed(1)
                const sec = secondaryName(totals[name], lang)
                return (
                  <button className="item-row" key={name}
                    onClick={() => setOpenItem({ branchId: b.id, branchName: b.name, name })}>
                    <span className="item-name">
                      {name}
                      {sec && <span className="item-secondary">{sec}</span>}
                    </span>
                    <span className="item-bal">{q} {unit}</span>
                  </button>
                )
              })
            )}
          </div>
        )
      })}
    </div>
  )
}
