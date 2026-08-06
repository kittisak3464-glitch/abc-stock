import { supabase } from './supabase'
import { makeT } from './i18n'

export function isLow(item) {
  return item.reorder_point != null && Number(item.balance) <= Number(item.reorder_point)
}

export function isOut(item) {
  return Number(item.balance) <= 0
}

export async function fetchItems(branchId) {
  const { data, error } = await supabase
    .from('items')
    .select('id, catalog_id, balance, reorder_point, catalog(name, name_th, name_zh, name_my, unit, active)')
    .eq('branch_id', branchId)
    .order('catalog(name)')
  if (error) throw error
  return (data ?? []).map((r) => ({ ...r, balance: Number(r.balance) }))
}

export async function fetchTransactions({ branchId, itemId, limit = 30 }) {
  let q = supabase
    .from('transactions')
    .select(
      'id, type, qty, note, created_at, voided, created_by, transfer_id, ' +
        'items!inner(id, branch_id, catalog(name, name_th, name_zh, name_my, unit)), ' +
        'author:profiles!transactions_created_by_fkey(display_name)'
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (itemId) q = q.eq('item_id', itemId)
  else if (branchId) q = q.eq('items.branch_id', branchId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function recordTransaction({ itemId, type, qty, note, userId }) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({ item_id: itemId, type, qty, note: note || null, created_by: userId })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function undoTransaction(txId) {
  const { error } = await supabase.rpc('void_own_transaction', { tx_id: txId })
  if (error) throw error
}

export async function fetchBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('id, code, name, procurement_group')
    .order('id')
  if (error) throw error
  return data ?? []
}

export async function fetchAllItems() {
  const { data, error } = await supabase
    .from('items')
    .select('id, branch_id, catalog_id, balance, reorder_point, catalog(name, name_th, name_zh, name_my, unit, active)')
    .limit(1000)
  if (error) throw error
  return (data ?? []).map((r) => ({ ...r, balance: Number(r.balance) }))
}

export async function fetchTransfers({ statuses, limit = 50 }) {
  let q = supabase
    .from('transfers')
    .select(
      'id, from_branch, to_branch, catalog_id, qty, kind, status, note, sent_at, received_at, ' +
        'return_sent_at, return_received_at, ' +
        'requested_by, requested_at, decline_reason, ' +
        'catalog(name, name_th, name_zh, name_my, unit), ' +
        'sender:profiles!transfers_sent_by_fkey(display_name), ' +
        'receiver:profiles!transfers_received_by_fkey(display_name), ' +
        'requester:profiles!transfers_requested_by_fkey(display_name), ' +
        'return_sender:profiles!transfers_return_sent_by_fkey(display_name), ' +
        'return_receiver:profiles!transfers_return_received_by_fkey(display_name)'
    )
    .order('id', { ascending: false })
    .limit(limit)
  if (statuses) q = q.in('status', statuses)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r) => ({ ...r, qty: Number(r.qty) }))
}

export async function fetchBranchStock(branchId) {
  const { data, error } = await supabase.rpc('branch_stock', { p_branch_id: branchId })
  if (error) throw error
  const map = {}
  for (const row of data ?? []) map[row.catalog_id] = Number(row.balance)
  return map
}

export async function fetchItemBranchStock(catalogId) {
  const { data, error } = await supabase.rpc('item_branch_stock', { p_catalog_id: catalogId })
  if (error) throw error
  const map = {}
  for (const row of data ?? []) map[row.branch_id] = Number(row.balance)
  return map
}

export async function requestTransfer({ fromBranch, toBranch, catalogId, qty, note }) {
  const { data, error } = await supabase.rpc('request_transfer', {
    p_from_branch: fromBranch, p_to_branch: toBranch, p_catalog_id: catalogId,
    p_qty: qty, p_note: note || null,
  })
  if (error) throw error
  return data
}

export async function declineRequest(transferId, reason) {
  const { error } = await supabase.rpc('decline_request', { p_transfer_id: transferId, p_reason: reason || null })
  if (error) throw error
}

export async function cancelRequest(transferId) {
  const { error } = await supabase.rpc('cancel_request', { p_transfer_id: transferId })
  if (error) throw error
}

export async function cancelTransfer(transferId) {
  const { error } = await supabase.rpc('cancel_transfer', { p_transfer_id: transferId })
  if (error) throw error
}

// Password-signed RPC: verifies email+password against Supabase Auth with a
// raw fetch (does NOT touch the logged-in session), then calls the RPC as
// that user — so sent_by/received_by is a real signature.
export async function signedRpc(email, password, fn, args) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!auth.ok) throw new Error('Wrong password — signature not accepted')
  const { access_token } = await auth.json()
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message ?? 'Request failed')
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ---- admin: catalog & users & reorder ----

export async function fetchCatalog() {
  const { data, error } = await supabase
    .from('catalog')
    .select('id, name, name_th, name_zh, name_my, unit, active')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function addCatalogItem(name, unit, branchIds, translations = {}) {
  const { data, error } = await supabase
    .from('catalog')
    .insert({ name, unit, name_th: translations.th || null, name_zh: translations.zh || null, name_my: translations.my || null })
    .select('id')
    .single()
  if (error) throw error
  const rows = branchIds.map((b) => ({ branch_id: b, catalog_id: data.id, balance: 0 }))
  const { error: e2 } = await supabase.from('items').insert(rows)
  if (e2) throw e2
  return data.id
}

export async function updateCatalogItem(id, patch) {
  const { error } = await supabase.from('catalog').update(patch).eq('id', id)
  if (error) throw error
}

export async function setReorderPoint(itemId, value) {
  const { error } = await supabase.from('items').update({ reorder_point: value }).eq('id', itemId)
  if (error) throw error
}

export async function adjustBalance(itemId, newBalance, reason) {
  const { error } = await supabase.rpc('adjust_balance', {
    p_item_id: itemId, p_new_balance: newBalance, p_reason: reason,
  })
  if (error) throw error
}

// Bangkok-day boundaries for a 'YYYY-MM-DD' date string
function bangkokDayRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00+07:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function todayBangkok() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

// Real usage only: Stock Out entries, excludes transfers/loans (transfer_id
// set), legacy migrated corrections (no created_by — see migrate script),
// and admin balance adjustments (adjust_balance RPC — stock-count
// corrections, not real usage; identified by their note prefix).
// Returns { [branchId]: [{ name, unit, qty, note, author, time }, ...] } —
// one line per transaction (not summed), so each recorded note stays visible.
export async function fetchDailyTransactions(dateStr, type = 'out') {
  const { start, end } = bangkokDayRange(dateStr)
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'qty, note, created_at, items!inner(branch_id, catalog(name, name_th, name_zh, name_my, unit)), ' +
        'author:profiles!transactions_created_by_fkey(display_name)'
    )
    .eq('type', type)
    .eq('voided', false)
    .is('transfer_id', null)
    .not('created_by', 'is', null)
    .not('note', 'ilike', 'Stock count adjustment:%')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at')
  if (error) throw error

  const byBranch = {}
  for (const row of data ?? []) {
    const bid = row.items.branch_id
    const cat = row.items.catalog
    ;(byBranch[bid] ??= []).push({
      name: cat.name,
      name_th: cat.name_th,
      name_zh: cat.name_zh,
      name_my: cat.name_my,
      unit: cat.unit,
      qty: Number(row.qty),
      note: row.note,
      author: row.author?.display_name ?? null,
      time: row.created_at,
    })
  }
  return byBranch
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, role, branch_id, lang')
    .order('role')
  if (error) throw error
  return data ?? []
}

export async function updateProfile(userId, patch) {
  const { error } = await supabase.from('profiles').update(patch).eq('user_id', userId)
  if (error) throw error
}

export function fmtDate(iso, lang = 'en') {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `${makeT(lang)('today')} ${time}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ` ${time}`
}
