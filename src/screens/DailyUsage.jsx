import { useEffect, useState } from 'react'
import { fetchDailyUsage, fmtDate, todayBangkok } from '../lib/data'
import { useT } from '../lib/i18n'

function summarize(entries) {
  const totals = {}
  for (const e of entries) {
    const cur = totals[e.name] ?? { qty: 0, unit: e.unit }
    cur.qty += e.qty
    totals[e.name] = cur
  }
  return totals
}

// Detail screen: every recorded entry (with note) for one item on one day
function ItemUsageDetail({ branchName, name, entries, onBack }) {
  const { t } = useT()
  const total = entries.reduce((sum, e) => sum + e.qty, 0)
  const q = total === Math.round(total) ? total : total.toFixed(1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button className="btn-back" onClick={onBack}>{t('back')}</button>
      <div>
        <h1 className="h1">{name}</h1>
        <p className="sub">{branchName} · {q} {entries[0]?.unit}</p>
      </div>
      {entries.map((e, i) => (
        <div className="tx-row" key={i}>
          <span className="tx-ic tx-out">−</span>
          <span className="tx-body">
            <span className="tx-name">
              <b className="tx-qty">{e.qty} {e.unit}</b>
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

export default function DailyUsage({ branches, onExit }) {
  const { t } = useT()
  const [date, setDate] = useState(todayBangkok())
  const [byBranch, setByBranch] = useState(null)
  const [msg, setMsg] = useState('')
  const [openItem, setOpenItem] = useState(null) // { branchId, branchName, name }

  useEffect(() => {
    setByBranch(null)
    setOpenItem(null)
    fetchDailyUsage(date).then(setByBranch).catch(console.error)
  }, [date])

  const dateLabel = new Date(`${date}T12:00:00+07:00`).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  function buildText() {
    const lines = [`${t('usage.title')} ${dateLabel}`, '']
    for (const b of [...branches].sort((a, c) => a.name.localeCompare(c.name))) {
      lines.push(`🏨 ${b.name}`)
      const entries = byBranch?.[b.id]
      if (!entries || entries.length === 0) {
        lines.push(`• ${t('usage.none')}`)
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
          <h1 className="h1">{t('usage.title')}</h1>
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
      {byBranch && [...branches].sort((a, b) => a.name.localeCompare(b.name)).map((b) => {
        const entries = byBranch[b.id]
        const totals = entries ? summarize(entries) : null
        return (
          <div key={b.id}>
            <p className="sub" style={{ margin: '0 0 6px', fontWeight: 700 }}>🏨 {b.name}</p>
            {!totals || Object.keys(totals).length === 0 ? (
              <p className="sub" style={{ marginLeft: 4 }}>{t('usage.none')}</p>
            ) : (
              Object.keys(totals).sort().map((name) => {
                const { qty, unit } = totals[name]
                const q = qty === Math.round(qty) ? qty : qty.toFixed(1)
                return (
                  <button className="item-row" key={name}
                    onClick={() => setOpenItem({ branchId: b.id, branchName: b.name, name })}>
                    <span className="item-name">{name}</span>
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
