import { readFileSync } from 'node:fs'
import pg from 'pg'

const PASSWORD = process.env.DB_PASSWORD
const REF = 'dvzqhtzzmcuzfdffsfzw'
const sql = readFileSync(process.argv[2], 'utf8')

const candidates = [
  `postgresql://postgres.${REF}:${PASSWORD}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${REF}:${PASSWORD}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${PASSWORD}@db.${REF}.supabase.co:5432/postgres`,
]

let lastErr
for (const conn of candidates) {
  const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 })
  try {
    await client.connect()
    console.log('connected via', conn.split('@')[1].split(':')[0])
    await client.query(sql)
    console.log('SCHEMA OK')
    await client.end()
    process.exit(0)
  } catch (e) {
    lastErr = e
    console.log('failed:', conn.split('@')[1].split(':')[0], '-', e.message)
    try { await client.end() } catch {}
  }
}
console.error('All connection attempts failed. Last error:', lastErr?.message)
process.exit(1)
