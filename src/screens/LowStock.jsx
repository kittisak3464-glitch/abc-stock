import { isLow } from '../lib/data'
import { useT } from '../lib/i18n'

export default function LowStock({ allItems, branches, onCancel }) {
  const { t } = useT()
  const low = allItems.filter(isLow)
  const groups = [1, 2]
  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'
  const bgroup = (id) => branches.find((b) => b.id === id)?.procurement_group

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
            {rows.map((i) => (
              <div className="item-row item-low" key={i.id} style={{ cursor: 'default', marginBottom: 8 }}>
                <span className="item-name">
                  {i.catalog.name}
                  <span className="item-unit">{bname(i.branch_id)} · {t('item.reorderAt', { n: Number(i.reorder_point) })}</span>
                </span>
                <span className="tag-low">{Number(i.balance) <= 0 ? t('tag.out') : t('tag.low')}</span>
                <span className="item-bal item-bal-low">{Number(i.balance)}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
