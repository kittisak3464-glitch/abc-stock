import { useEffect, useState } from 'react'
import { fetchDailyUsage, fmtDate, todayBangkok } from '../lib/data'
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
      const entries = byBranch?.[b.id]
      if (!entries || entries.length === 0) {
        lines.push(`• ${t('usage.none')}`)
      } else {
        for (const e of entries) {
          const q = e.qty === Math.round(e.qty) ? e.qty : e.qty.toFixed(1)
          lines.push(`• ${e.name} ${q} ${e.unit}${e.note ? ` — ${e.note}` : ''}`)
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
        const entries = byBranch[b.id]
        return (
          <div key={b.id}>
            <p className="sub" style={{ margin: '0 0 6px', fontWeight: 700 }}>🏨 {b.name}</p>
            {!entries || entries.length === 0 ? (
              <p className="sub" style={{ marginLeft: 4 }}>{t('usage.none')}</p>
            ) : (
              entries.map((e, i) => (
                <div className="tx-row" key={i}>
                  <span className="tx-ic tx-out">−</span>
                  <span className="tx-body">
                    <span className="tx-name">
                      {e.name} <b className="tx-qty">{e.qty} {e.unit}</b>
                    </span>
                    <span className="tx-meta">
                      {fmtDate(e.time)} · {t('by')} {e.author ?? 'system'}
                    </span>
                    {e.note && <span className="tx-note">📝 {e.note}</span>}
                  </span>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
