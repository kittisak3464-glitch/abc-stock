import { isLow, isOut } from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'

export default function LowStock({ allItems, branches, onCancel }) {
  const { t, lang } = useT()
  const low = allItems.filter(isLow)
  const groups = [1, 2]
  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'
  const bgroup = (id) => branches.find((b) => b.id === id)?.procurement_group

  const peersFor = (item, g) =>
    allItems
      .filter((p) => p.catalog_id === item.catalog_id && p.branch_id !== item.branch_id && bgroup(p.branch_id) === g)
      .sort((a, b) => bname(a.branch_id).localeCompare(bname(b.branch_id)))

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>{t('back')}</button>
      <h1 className="h1 text-danger">{t('low.title')}</h1>
      {low.length === 0 && <p className="sub">{t('low.none')}</p>}
      {groups.map((g) => {
        const rows = low
          .filter((i) => bgroup(i.branch_id) === g)
          .sort((a, b) => bname(a.branch_id).localeCompare(bname(b.branch_id)) || a.catalog.name.localeCompare(b.catalog.name))
        if (rows.length === 0) return null
        return (
          <div key={g}>
            <p className="sub" style={{ margin: '4px 0 8px', fontWeight: 700 }}>
              {t('low.group', { g })} — {branches.filter((b) => b.procurement_group === g).map((b) => b.name).join(' + ')}
            </p>
            {rows.map((i) => {
              const peers = peersFor(i, g)
              const canLend = new Set(peers.filter((p) => !isLow(p) && !isOut(p)).map((p) => p.id))
              return (
                <div className="item-row item-low" key={i.id}
                  style={{ cursor: 'default', marginBottom: 8, flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="item-name">
                      {i.catalog.name}
                      {secondaryName(i.catalog, lang) && (
                        <span className="item-secondary">{secondaryName(i.catalog, lang)}</span>
                      )}
                      <span className="item-unit">{bname(i.branch_id)} · {t('item.reorderAt', { n: Number(i.reorder_point) })}</span>
                    </span>
                    <span className="tag-low">{Number(i.balance) <= 0 ? t('tag.out') : t('tag.low')}</span>
                    <span className="item-bal item-bal-low">{Number(i.balance)}</span>
                  </div>
                  {peers.length > 0 && (
                    <span className="item-unit" style={{ marginTop: 4 }}>
                      {t('low.peers')}{' '}
                      {peers.map((p, idx) => (
                        <span key={p.id} className={canLend.has(p.id) ? 'text-in' : ''}>
                          {bname(p.branch_id)} {Number(p.balance)}{canLend.has(p.id) ? ' ✓' : ''}
                          {idx < peers.length - 1 ? '  ·  ' : ''}
                        </span>
                      ))}
                    </span>
                  )}
                  {peers.length > 0 && canLend.size === 0 && (
                    <span className="item-unit text-danger" style={{ marginTop: 2 }}>{t('low.noPeerStock')}</span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
