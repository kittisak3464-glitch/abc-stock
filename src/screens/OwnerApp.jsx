import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllItems, fetchBranches, fetchTransactions, fmtDate, isLow } from '../lib/data'

// Owner: view-only, 3 levels deep max, language per profile.lang
const T = {
  en: {
    today: 'Today', viewOnly: 'View only', ok: '✅ OK', low: (n) => `${n} low`,
    hint: "Tap a hotel to see what's running low", items: 'Items', all: 'All', lowTab: 'Low',
    balance: 'Balance', history: 'History', back: '‹ Back', signout: 'Sign out',
    used: 'Used', restocked: 'Restocked', sent: (b) => `Sent to ${b}`, recv: (b) => `From ${b}`,
    noLow: 'Everything is fine', by: 'by',
  },
  zh: {
    today: 'Today · 今天', viewOnly: 'View only · 只能查看', ok: '✅ OK · 正常', low: (n) => `${n} low · 缺货 ${n}`,
    hint: "Tap a hotel to see what's running low · 点酒店查看缺什么", items: 'Items · 物品', all: 'All · 全部', lowTab: 'Low · 缺货',
    balance: 'Balance · 库存', history: 'History · 记录', back: '‹ Back · 返回', signout: 'Sign out · 退出',
    used: 'Used · 用掉', restocked: 'Restocked · 进货', sent: (b) => `Sent · 送去 ${b}`, recv: (b) => `From · 来自 ${b}`,
    noLow: 'Everything is fine · 一切正常', by: 'by',
  },
  th: {
    today: 'วันนี้', viewOnly: 'ดูอย่างเดียว', ok: '✅ ปกติ', low: (n) => `ใกล้หมด ${n} รายการ`,
    hint: 'แตะชื่อโรงแรมเพื่อดูว่าอะไรใกล้หมด', items: 'รายการของ', all: 'ทั้งหมด', lowTab: 'ใกล้หมด',
    balance: 'คงเหลือ', history: 'ประวัติ', back: '‹ กลับ', signout: 'ออกจากระบบ',
    used: 'ใช้ไป', restocked: 'เติมของ', sent: (b) => `ส่งไป ${b}`, recv: (b) => `มาจาก ${b}`,
    noLow: 'ทุกอย่างปกติดี', by: 'โดย',
  },
}

function txLabel(t, tx, branchNames) {
  const note = tx.note ?? ''
  const sent = note.match(/^Sent to (.+)$/)
  const recv = note.match(/^Received from (.+)$/)
  if (sent) return t.sent(sent[1])
  if (recv) return t.recv(recv[1])
  return tx.type === 'in' ? t.restocked : t.used
}

export default function OwnerApp({ profile }) {
  const t = T[profile.lang] ?? T.en
  const [branches, setBranches] = useState([])
  const [items, setItems] = useState([])
  const [branch, setBranch] = useState(null)
  const [filter, setFilter] = useState('all')
  const [item, setItem] = useState(null)
  const [txs, setTxs] = useState(null)

  useEffect(() => {
    fetchBranches().then(setBranches)
    fetchAllItems().then(setItems)
  }, [])

  useEffect(() => {
    if (!item) return
    setTxs(null)
    fetchTransactions({ itemId: item.id, limit: 40 }).then(setTxs).catch(() => setTxs([]))
  }, [item])

  const lowCount = (bid) => items.filter((i) => i.branch_id === bid && isLow(i)).length

  // level 3: item history
  if (item) {
    return (
      <div className="app-wrap">
        <main className="app-body">
          <div className="screen">
            <button className="btn-back" onClick={() => setItem(null)}>{t.back}</button>
            <h1 className="h1">{item.catalog.name}</h1>
            <p className="sub">
              {t.balance}:{' '}
              <b className={isLow(item) ? 'text-danger' : ''} style={{ fontSize: '1.1rem' }}>
                {Number(item.balance)} {item.catalog.unit}
              </b>
            </p>
            <p className="sub" style={{ margin: 0 }}>{t.history}</p>
            {txs === null && <p className="sub">…</p>}
            {txs?.filter((x) => !x.voided).map((tx) => (
              <div className="tx-row" key={tx.id}>
                <span className={'tx-ic ' + (tx.type === 'in' ? 'tx-in' : 'tx-out')}>
                  {tx.type === 'in' ? '+' : '−'}
                </span>
                <span className="tx-body">
                  <span className="tx-name">
                    {txLabel(t, tx)} <b className="tx-qty">{tx.type === 'in' ? '+' : '−'}{Number(tx.qty)}</b>
                  </span>
                  <span className="tx-meta">
                    {fmtDate(tx.created_at)} · {t.by} {tx.author?.display_name ?? 'system'}
                  </span>
                </span>
              </div>
            ))}
            <p className="sub center">{t.viewOnly}</p>
          </div>
        </main>
      </div>
    )
  }

  // level 2: branch items
  if (branch) {
    let list = items.filter((i) => i.branch_id === branch.id)
    if (filter === 'low') list = list.filter(isLow)
    list = [...list].sort((a, b) => (isLow(a) ? 0 : 1) - (isLow(b) ? 0 : 1) || a.catalog.name.localeCompare(b.catalog.name))
    return (
      <div className="app-wrap">
        <main className="app-body">
          <div className="screen">
            <button className="btn-back" onClick={() => setBranch(null)}>{t.back}</button>
            <h1 className="h1">{branch.name}</h1>
            <div className="chiprow">
              <button className={'chip' + (filter === 'low' ? ' chip-on' : '')} onClick={() => setFilter('low')}>🔴 {t.lowTab}</button>
              <button className={'chip' + (filter === 'all' ? ' chip-on' : '')} onClick={() => setFilter('all')}>{t.all}</button>
            </div>
            {filter === 'low' && list.length === 0 && <p className="sub">{t.noLow}</p>}
            {list.map((i) => (
              <button className={'item-row' + (isLow(i) ? ' item-low' : '')} key={i.id} onClick={() => setItem(i)}>
                <span className="item-name">
                  {i.catalog.name}
                  <span className="item-unit">{i.catalog.unit}</span>
                </span>
                <span className={'item-bal' + (isLow(i) ? ' item-bal-low' : '')}>{Number(i.balance)}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // level 1: hotels overview
  return (
    <div className="app-wrap">
      <main className="app-body">
        <div className="screen">
          <div>
            <h1 className="h1">
              ABC Hotels{' '}
              <span className="pill-view">👁️ {t.viewOnly}</span>
            </h1>
            <p className="sub">
              {t.today} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {branches.map((b) => {
            const n = lowCount(b.id)
            return (
              <button className="item-row" key={b.id} style={{ padding: '16px 14px' }} onClick={() => { setBranch(b); setFilter(n > 0 ? 'low' : 'all') }}>
                <span className="item-name" style={{ fontSize: '1.05rem' }}>{b.name}</span>
                {n > 0 ? (
                  <>
                    <span className="tag-low">{t.low(n)}</span>
                    <span className="item-bal">🔴</span>
                  </>
                ) : (
                  <span className="item-bal" style={{ color: 'var(--in)', fontSize: '0.9rem' }}>{t.ok}</span>
                )}
              </button>
            )
          })}
          <p className="sub center">{t.hint}</p>
          <button className="btn-big btn-ghost-big" onClick={() => supabase.auth.signOut()}>
            {t.signout}
          </button>
        </div>
      </main>
    </div>
  )
}
