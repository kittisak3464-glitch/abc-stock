import { useEffect, useState } from 'react'
import { fetchDailyUsage, todayBangkok } from '../lib/data'
import { useT } from '../lib/i18n'

export default function DailyUsage({ branches }) {
  const { t } = useT()
  const [date, setDate] = useState(todayBangkok())
  const [byBranch, setByBranch] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setByBranch(null)
    fetchDailyUsage(date).then(setByBranch).catch(console.error)
  }, [date])

  const dateLabel = new Date(`${date}T12:00:00+07:00`).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  function buildText() {
    const lines = [`${t('usage.title')} ${dateLabel}`, '']
    for (const b of [...branches].sort((a, c) => a.name.localeCompare(c.name))) {
      lines.push(`🏨 ${b.name}`)
      const items = byBranch?.[b.id]
      if (!items || Object.keys(items).length === 0) {
        lines.push(`• ${t('usage.none')}`)
      } else {
        for (const name of Object.keys(items).sort()) {
          const { qty, unit } = items[name]
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input className="input" type="date" value={date} max={todayBangkok()}
          onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
        <button className="chip" onClick={() => setDate(todayBangkok())}>{t('usage.today')}</button>
      </div>

      <button className="btn-big btn-accent" onClick={copyText}>{t('usage.copy')}</button>
      {msg && <div className="alert-ok">{msg}</div>}

      {byBranch === null && <p className="sub">{t('item.loading')}</p>}
      {byBranch && [...branches].sort((a, b) => a.name.localeCompare(b.name)).map((b) => {
        const items = byBranch[b.id]
        return (
          <div key={b.id}>
            <p className="sub" style={{ margin: '0 0 6px', fontWeight: 700 }}>🏨 {b.name}</p>
            {!items || Object.keys(items).length === 0 ? (
              <p className="sub" style={{ marginLeft: 4 }}>{t('usage.none')}</p>
            ) : (
              Object.keys(items).sort().map((name) => {
                const { qty, unit } = items[name]
                const q = qty === Math.round(qty) ? qty : qty.toFixed(1)
                return (
                  <div className="item-row" key={name} style={{ cursor: 'default', marginBottom: 6 }}>
                    <span className="item-name">{name}</span>
                    <span className="item-bal">{q} {unit}</span>
                  </div>
                )
              })
            )}
          </div>
        )
      })}
    </div>
  )
}
