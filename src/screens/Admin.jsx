import { useEffect, useState } from 'react'
import {
  addCatalogItem, fetchCatalog, fetchProfiles, updateCatalogItem, updateProfile,
} from '../lib/data'

// Admin tab: catalog (locked names) + users
export default function Admin({ branches, onChanged }) {
  const [view, setView] = useState('catalog') // catalog | users
  const [cat, setCat] = useState([])
  const [profiles, setProfiles] = useState([])
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState({})
  const [newItem, setNewItem] = useState(null) // {name, unit}
  const [msg, setMsg] = useState('')

  function reload() {
    fetchCatalog().then(setCat)
    fetchProfiles().then(setProfiles)
  }
  useEffect(reload, [])

  async function saveCatalog(c) {
    try {
      await updateCatalogItem(c.id, { name: editVal.name ?? c.name, unit: editVal.unit ?? c.unit })
      setEditId(null); setMsg('Saved ✓'); reload(); onChanged()
    } catch (e) { setMsg(e.message) }
  }

  async function toggleActive(c) {
    await updateCatalogItem(c.id, { active: !c.active })
    reload(); onChanged()
  }

  async function addItem() {
    try {
      await addCatalogItem(newItem.name.trim(), newItem.unit.trim() || 'Piece', branches.map((b) => b.id))
      setNewItem(null); setMsg('Item added to all branches ✓'); reload(); onChanged()
    } catch (e) { setMsg(e.message) }
  }

  async function saveProfile(p) {
    try {
      await updateProfile(p.user_id, {
        display_name: editVal.display_name ?? p.display_name,
        branch_id: editVal.branch_id !== undefined ? editVal.branch_id : p.branch_id,
      })
      setEditId(null); setMsg('Saved ✓'); reload()
    } catch (e) { setMsg(e.message) }
  }

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '—'

  return (
    <div className="screen">
      <h1 className="h1">👑 Admin</h1>
      <div className="chiprow">
        <button className={'chip' + (view === 'catalog' ? ' chip-on' : '')} onClick={() => setView('catalog')}>Catalog</button>
        <button className={'chip' + (view === 'users' ? ' chip-on' : '')} onClick={() => setView('users')}>Users</button>
      </div>
      {msg && <div className="alert-ok" onClick={() => setMsg('')}>{msg}</div>}

      {view === 'catalog' && (
        <>
          {!newItem ? (
            <button className="btn-big btn-accent" onClick={() => { setNewItem({ name: '', unit: 'Piece' }); setEditId(null) }}>
              ＋ Add new item (all branches)
            </button>
          ) : (
            <div className="me-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b>New catalog item</b>
              <input className="input" placeholder="Item name (English)" autoFocus
                value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <input className="input" placeholder="Unit e.g. Piece / pack / Bottle"
                value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
              <div className="row-2btn">
                <button className="btn-big btn-ghost-big" style={{ padding: 10 }} onClick={() => setNewItem(null)}>Cancel</button>
                <button className="btn-big btn-accent" style={{ padding: 10 }} disabled={!newItem.name.trim()} onClick={addItem}>Add</button>
              </div>
            </div>
          )}
          {cat.map((c) => (
            <div className={'item-row'} key={c.id} style={{ cursor: 'default', opacity: c.active ? 1 : 0.45 }}>
              {editId === 'c' + c.id ? (
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input className="input" defaultValue={c.name}
                    onChange={(e) => setEditVal((v) => ({ ...v, name: e.target.value }))} />
                  <input className="input" defaultValue={c.unit}
                    onChange={(e) => setEditVal((v) => ({ ...v, unit: e.target.value }))} />
                  <div className="row-2btn">
                    <button className="btn-big btn-ghost-big" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => setEditId(null)}>Cancel</button>
                    <button className="btn-big btn-accent" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => saveCatalog(c)}>Save</button>
                  </div>
                </span>
              ) : (
                <>
                  <span className="item-name">
                    {c.name}
                    <span className="item-unit">{c.unit}{c.active ? '' : ' · inactive'}</span>
                  </span>
                  <button className="btn-undo" onClick={() => { setEditId('c' + c.id); setEditVal({}) }}>Edit</button>
                  <button className="btn-undo" onClick={() => toggleActive(c)}>{c.active ? 'Off' : 'On'}</button>
                </>
              )}
            </div>
          ))}
        </>
      )}

      {view === 'users' && (
        <>
          <p className="sub" style={{ margin: 0 }}>
            New accounts / password resets: run <code>create_users.py</code> or Supabase dashboard
          </p>
          {profiles.map((p) => (
            <div className="item-row" key={p.user_id} style={{ cursor: 'default' }}>
              {editId === 'u' + p.user_id ? (
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input className="input" defaultValue={p.display_name}
                    onChange={(e) => setEditVal((v) => ({ ...v, display_name: e.target.value }))} />
                  {p.role === 'staff' && (
                    <select className="input" defaultValue={p.branch_id ?? ''}
                      onChange={(e) => setEditVal((v) => ({ ...v, branch_id: Number(e.target.value) }))}>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  )}
                  <div className="row-2btn">
                    <button className="btn-big btn-ghost-big" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => setEditId(null)}>Cancel</button>
                    <button className="btn-big btn-accent" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => saveProfile(p)}>Save</button>
                  </div>
                </span>
              ) : (
                <>
                  <span className="item-name">
                    {p.display_name}
                    <span className="item-unit">
                      {p.role === 'admin' ? '👑 admin' : p.role === 'owner' ? `👁️ owner (${p.lang})` : `staff · ${bname(p.branch_id)}`}
                    </span>
                  </span>
                  <button className="btn-undo" onClick={() => { setEditId('u' + p.user_id); setEditVal({}) }}>Edit</button>
                </>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
