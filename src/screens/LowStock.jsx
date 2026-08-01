import { isLow } from '../lib/data'

// Admin: low stock across all branches, grouped by procurement group
export default function LowStock({ allItems, branches, onCancel }) {
  const low = allItems.filter(isLow)
  const groups = [1, 2]
  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '?'
  const bgroup = (id) => branches.find((b) => b.id === id)?.procurement_group

  return (
    <div className="screen">
      <button className="btn-back" onClick={onCancel}>‹ Back</button>
      <h1 className="h1 text-danger">🔴 Low Stock — all branches</h1>
      {low.length === 0 && <p className="sub">Nothing low right now 🎉</p>}
      {groups.map((g) => {
        const rows = low
          .filter((i) => bgroup(i.branch_id) === g)
          .sort((a, b) => bname(a.branch_id).localeCompare(bname(b.branch_id)) || a.catalog.name.localeCompare(b.catalog.name))
        if (rows.length === 0) return null
        return (
          <div key={g}>
            <p className="sub" style={{ margin: '4px 0 8px', fontWeight: 700 }}>
              Group {g} — {branches.filter((b) => b.procurement_group === g).map((b) => b.name).join(' + ')}
            </p>
            {rows.map((i) => (
              <div className="item-row item-low" key={i.id} style={{ cursor: 'default', marginBottom: 8 }}>
                <span className="item-name">
                  {i.catalog.name}
                  <span className="item-unit">{bname(i.branch_id)} · reorder at {Number(i.reorder_point)}</span>
                </span>
                <span className="tag-low">{Number(i.balance) <= 0 ? 'OUT' : 'LOW'}</span>
                <span className="item-bal item-bal-low">{Number(i.balance)}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
