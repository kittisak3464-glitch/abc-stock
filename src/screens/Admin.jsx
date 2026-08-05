import { useEffect, useState } from 'react'
import {
  addCatalogItem, fetchCatalog, fetchProfiles, updateCatalogItem, updateProfile,
} from '../lib/data'
import { secondaryName, useT } from '../lib/i18n'
import DailyUsage from './DailyUsage'

// Admin tab: catalog (locked names) + users + daily usage report
export default function Admin({ branches, onChanged }) {
  const { t, lang } = useT()
  const [view, setView] = useState('catalog') // catalog | users | usage | restock
  const [cat, setCat] = useState([])
  const [profiles, setProfiles] = useState([])
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState({})
  const [newItem, setNewItem] = useState(null) // {name, unit, th, zh, my}
  const [msg, setMsg] = useState('')

  function reload() {
    fetchCatalog().then(setCat).catch(() => setMsg(t('err.load')))
    fetchProfiles().then(setProfiles).catch(() => setMsg(t('err.load')))
  }
  useEffect(reload, [])

  async function saveCatalog(c) {
    try {
      await updateCatalogItem(c.id, {
        name: editVal.name ?? c.name,
        unit: editVal.unit ?? c.unit,
        name_th: (editVal.name_th ?? c.name_th) || null,
        name_zh: (editVal.name_zh ?? c.name_zh) || null,
        name_my: (editVal.name_my ?? c.name_my) || null,
      })
      setEditId(null); setMsg(t('adm.saved')); reload(); onChanged()
    } catch (e) { setMsg(e.message) }
  }

  async function toggleActive(c) {
    await updateCatalogItem(c.id, { active: !c.active })
    reload(); onChanged()
  }

  async function addItem() {
    try {
      await addCatalogItem(newItem.name.trim(), newItem.unit.trim() || 'Piece', branches.map((b) => b.id), {
        th: newItem.th?.trim(), zh: newItem.zh?.trim(), my: newItem.my?.trim(),
      })
      setNewItem(null); setMsg(t('adm.added')); reload(); onChanged()
    } catch (e) { setMsg(e.message) }
  }

  async function saveProfile(p) {
    try {
      await updateProfile(p.user_id, {
        display_name: editVal.display_name ?? p.display_name,
        branch_id: editVal.branch_id !== undefined ? editVal.branch_id : p.branch_id,
      })
      setEditId(null); setMsg(t('adm.saved')); reload()
    } catch (e) { setMsg(e.message) }
  }

  const bname = (id) => branches.find((b) => b.id === id)?.name ?? '—'

  return (
    <div className="screen">
      <h1 className="h1">{t('adm.title')}</h1>
      <div className="chiprow">
        <button className={'chip' + (view === 'catalog' ? ' chip-on' : '')} onClick={() => setView('catalog')}>
          {t('adm.catalog')}
        </button>
        <button className={'chip' + (view === 'users' ? ' chip-on' : '')} onClick={() => setView('users')}>
          {t('adm.users')}
        </button>
        <button className={'chip' + (view === 'usage' ? ' chip-on' : '')} onClick={() => setView('usage')}>
          {t('adm.usage')}
        </button>
        <button className={'chip' + (view === 'restock' ? ' chip-on' : '')} onClick={() => setView('restock')}>
          {t('adm.restock')}
        </button>
      </div>
      {msg && <div className="alert-ok" onClick={() => setMsg('')}>{msg}</div>}

      {view === 'catalog' && (
        <>
          {!newItem ? (
            <button className="btn-big btn-accent" onClick={() => { setNewItem({ name: '', unit: 'Piece', th: '', zh: '', my: '' }); setEditId(null) }}>
              {t('adm.add')}
            </button>
          ) : (
            <div className="me-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b>{t('adm.new')}</b>
              <input className="input" placeholder={t('adm.name')} autoFocus
                value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              <input className="input" placeholder={t('adm.unit')}
                value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
              <input className="input" placeholder={t('adm.nameTh')}
                value={newItem.th} onChange={(e) => setNewItem({ ...newItem, th: e.target.value })} />
              <input className="input" placeholder={t('adm.nameZh')}
                value={newItem.zh} onChange={(e) => setNewItem({ ...newItem, zh: e.target.value })} />
              <input className="input" placeholder={t('adm.nameMy')}
                value={newItem.my} onChange={(e) => setNewItem({ ...newItem, my: e.target.value })} />
              <div className="row-2btn">
                <button className="btn-big btn-ghost-big" style={{ padding: 10 }} onClick={() => setNewItem(null)}>
                  {t('cancel')}
                </button>
                <button className="btn-big btn-accent" style={{ padding: 10 }} disabled={!newItem.name.trim()} onClick={addItem}>
                  {t('adm.addBtn')}
                </button>
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
                  <input className="input" placeholder={t('adm.nameTh')} defaultValue={c.name_th ?? ''}
                    onChange={(e) => setEditVal((v) => ({ ...v, name_th: e.target.value }))} />
                  <input className="input" placeholder={t('adm.nameZh')} defaultValue={c.name_zh ?? ''}
                    onChange={(e) => setEditVal((v) => ({ ...v, name_zh: e.target.value }))} />
                  <input className="input" placeholder={t('adm.nameMy')} defaultValue={c.name_my ?? ''}
                    onChange={(e) => setEditVal((v) => ({ ...v, name_my: e.target.value }))} />
                  <div className="row-2btn">
                    <button className="btn-big btn-ghost-big" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => setEditId(null)}>
                      {t('cancel')}
                    </button>
                    <button className="btn-big btn-accent" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => saveCatalog(c)}>
                      {t('save')}
                    </button>
                  </div>
                </span>
              ) : (
                <>
                  <span className="item-name">
                    {c.name}
                    {secondaryName(c, lang) && <span className="item-secondary">{secondaryName(c, lang)}</span>}
                    <span className="item-unit">{c.unit}{c.active ? '' : ` · ${t('adm.inactive')}`}</span>
                  </span>
                  <button className="btn-undo" onClick={() => { setEditId('c' + c.id); setEditVal({}) }}>{t('edit')}</button>
                  <button className="btn-undo" onClick={() => toggleActive(c)}>{c.active ? t('adm.off') : t('adm.on')}</button>
                </>
              )}
            </div>
          ))}
        </>
      )}

      {view === 'users' && (
        <>
          <p className="sub" style={{ margin: 0 }}>{t('adm.note')}</p>
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
                    <button className="btn-big btn-ghost-big" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => setEditId(null)}>
                      {t('cancel')}
                    </button>
                    <button className="btn-big btn-accent" style={{ padding: 8, fontSize: '0.8rem' }} onClick={() => saveProfile(p)}>
                      {t('save')}
                    </button>
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
                  <button className="btn-undo" onClick={() => { setEditId('u' + p.user_id); setEditVal({}) }}>{t('edit')}</button>
                </>
              )}
            </div>
          ))}
        </>
      )}

      {view === 'usage' && <DailyUsage branches={branches} />}
      {view === 'restock' && <DailyUsage branches={branches} type="in" />}
    </div>
  )
}
