import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  fetchAllItems, fetchBranches, fetchItems, fetchTransactions, fetchTransfers, undoTransaction,
} from './lib/data'
import Home from './screens/Home'
import Stock from './screens/Stock'
import ItemDetail from './screens/ItemDetail'
import Record from './screens/Record'
import History from './screens/History'
import Me from './screens/Me'
import Transfer from './screens/Transfer'
import Incoming from './screens/Incoming'
import Loans from './screens/Loans'
import LowStock from './screens/LowStock'
import Admin from './screens/Admin'
import OwnerApp from './screens/OwnerApp'
import './App.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function signIn(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Wrong email or password — try again')
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={signIn}>
        <div className="appmark">
          <span className="appmark-dot">📦</span>
          <span>ABC Stock</span>
        </div>
        <p className="login-sub">ABC Hotels Inventory</p>
        <input type="email" placeholder="Email" autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        <p className="login-hint">Forgot password? Contact admin</p>
      </form>
    </div>
  )
}

const UNDO_WINDOW_MS = 5 * 60 * 1000

function MainApp({ profile, branch, userId, email }) {
  const isAdmin = profile.role === 'admin'
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState(profile.branch_id)
  const [tab, setTab] = useState('home')
  const [stockFilter, setStockFilter] = useState('all')
  const [items, setItems] = useState([])
  const [allItems, setAllItems] = useState([])
  const [txs, setTxs] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [overlay, setOverlay] = useState(null)
  // overlay: {kind:'item',item} | {kind:'record',type,item?} | {kind:'transfer'} |
  //          {kind:'incoming'} | {kind:'loans'} | {kind:'lowstock'}
  const [toast, setToast] = useState(null)

  useEffect(() => {
    fetchBranches().then((bs) => {
      setBranches(bs)
      if (isAdmin) setBranchId((cur) => cur ?? bs[0]?.id)
    })
  }, [isAdmin])

  const reload = useCallback(() => {
    if (!branchId) return
    fetchItems(branchId).then(setItems).catch(console.error)
    fetchTransactions({ branchId, limit: 40 }).then(setTxs).catch(console.error)
    fetchTransfers({ statuses: ['in_transit', 'pending_return', 'returned', 'waived'], limit: 60 })
      .then(setTransfers).catch(console.error)
    if (isAdmin) fetchAllItems().then(setAllItems).catch(console.error)
  }, [branchId, isAdmin])

  useEffect(reload, [reload])

  const incoming = transfers.filter((t) => t.status === 'in_transit' && (isAdmin || t.to_branch === branchId))
  const loans = transfers.filter((t) => t.status === 'pending_return')
  const resolvedLoans = transfers.filter((t) => t.kind === 'loan' && ['returned', 'waived'].includes(t.status)).slice(0, 10)

  const canUndo = useCallback(
    (tx) =>
      !tx.voided &&
      (isAdmin ||
        (tx.created_by === userId && Date.now() - new Date(tx.created_at).getTime() < UNDO_WINDOW_MS)),
    [isAdmin, userId]
  )

  async function handleUndo(tx) {
    try {
      await undoTransaction(tx.id)
      setToast({ text: 'Entry undone ✓' })
      reload()
      if (overlay?.kind === 'item') {
        const fresh = await fetchItems(branchId)
        setItems(fresh)
        setOverlay({ kind: 'item', item: fresh.find((i) => i.id === overlay.item.id) ?? null })
      }
    } catch (e) {
      setToast({ text: e.message ?? 'Undo failed' })
    }
  }

  function done(text, txId) {
    setOverlay(null)
    setToast({ text, txId })
    reload()
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const curBranch = branches.find((b) => b.id === branchId) ?? branch

  let body
  if (overlay?.kind === 'record') {
    body = (
      <Record type={overlay.type} presetItem={overlay.item} items={items} userId={userId}
        onDone={(txId, item, qty) => done(`Saved ✓ ${item.catalog.name} ${overlay.type === 'in' ? '+' : '−'}${qty}`, txId)}
        onCancel={() => setOverlay(overlay.item ? { kind: 'item', item: overlay.item } : null)} />
    )
  } else if (overlay?.kind === 'item' && overlay.item) {
    body = (
      <ItemDetail item={overlay.item} isAdmin={isAdmin}
        onBack={() => setOverlay(null)}
        onAction={(type, item) => setOverlay({ kind: 'record', type, item })}
        canUndo={canUndo} onUndo={handleUndo} onReorderSaved={() => { reload(); setToast({ text: 'Reorder point saved ✓' }) }} />
    )
  } else if (overlay?.kind === 'transfer') {
    body = (
      <Transfer profile={profile} branches={branches} myEmail={email} defaultFrom={branchId}
        onDone={(text) => done(text)} onCancel={() => setOverlay(null)} />
    )
  } else if (overlay?.kind === 'incoming') {
    body = (
      <Incoming transfers={incoming} branches={branches} myEmail={email}
        onDone={(text) => done(text)} onCancel={() => setOverlay(null)} />
    )
  } else if (overlay?.kind === 'loans') {
    body = (
      <Loans loans={loans} resolved={resolvedLoans} branches={branches} isAdmin={isAdmin} myEmail={email}
        onDone={(text) => done(text)} onCancel={() => setOverlay(null)} />
    )
  } else if (overlay?.kind === 'lowstock') {
    body = <LowStock allItems={allItems} branches={branches} onCancel={() => setOverlay(null)} />
  } else if (tab === 'home') {
    body = (
      <Home profile={profile} branch={curBranch} items={items} recent={(txs ?? []).slice(0, 5)}
        incomingCount={incoming.length} loanCount={loans.length}
        onAction={(type) => setOverlay({ kind: 'record', type })}
        onGoLow={() => { if (isAdmin) setOverlay({ kind: 'lowstock' }); else { setStockFilter('low'); setTab('stock') } }}
        onTransfer={() => setOverlay({ kind: 'transfer' })}
        onIncoming={() => setOverlay({ kind: 'incoming' })}
        onLoans={() => setOverlay({ kind: 'loans' })} />
    )
  } else if (tab === 'stock') {
    body = (
      <Stock items={items} filter={stockFilter} setFilter={setStockFilter}
        onOpenItem={(item) => setOverlay({ kind: 'item', item })} />
    )
  } else if (tab === 'history') {
    body = <History txs={txs} canUndo={canUndo} onUndo={handleUndo} />
  } else if (tab === 'admin') {
    body = <Admin branches={branches} onChanged={reload} />
  } else {
    body = <Me profile={profile} branch={curBranch} />
  }

  const tabs = [
    ['home', '🏠', 'Home'],
    ['stock', '📋', 'Stock'],
    ['history', '🕘', 'History'],
    ...(isAdmin ? [['admin', '👑', 'Admin']] : []),
    ['me', '👤', 'Me'],
  ]

  return (
    <div className="app-wrap">
      <header className="app-head">
        <div className="appmark">
          <span className="appmark-dot">📦</span>
          <span>ABC Stock</span>
        </div>
        {isAdmin && branches.length > 1 && (
          <select className="branch-select" value={branchId ?? ''}
            onChange={(e) => { setBranchId(Number(e.target.value)); setOverlay(null) }}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        {!isAdmin && <span className="head-branch">{curBranch?.name}</span>}
      </header>

      <main className="app-body">{body}</main>

      {toast && (
        <div className="toast">
          <span>{toast.text}</span>
          {toast.txId && (
            <button className="toast-undo"
              onClick={() => { handleUndo({ id: toast.txId, voided: false, created_by: userId, created_at: new Date().toISOString() }); setToast(null) }}>
              Undo
            </button>
          )}
        </div>
      )}

      <nav className="tabbar">
        {tabs.map(([k, icon, label]) => (
          <button key={k} className={'tab' + (tab === k && !overlay ? ' tab-on' : '')}
            onClick={() => { setTab(k); setOverlay(null) }}>
            <span className="tab-ic">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); return }
    supabase
      .from('profiles')
      .select('display_name, role, branch_id, lang, branches(id, name, code, procurement_group)')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => data && setProfile(data))
  }, [session])

  if (session === undefined) return null
  if (!session) return <Login />
  if (!profile) return null
  if (profile.role === 'owner') return <OwnerApp key={session.user.id} profile={profile} />
  return (
    <MainApp key={session.user.id} profile={profile} branch={profile.branches}
      userId={session.user.id} email={session.user.email} />
  )
}
