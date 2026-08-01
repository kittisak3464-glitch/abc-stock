# 📦 ABC Stock

ระบบสต็อกออนไลน์ของกลุ่มโรงแรม ABC (ABCYQ · ABCSO · ABCHA · ABCQQ · Le Hong)
React + Vite + Supabase · โฮสต์บน GitHub Pages

ดีไซน์เต็ม: ดู design doc (artifact "ABC Stock — ออกแบบระบบ Inventory ใหม่")

## Setup ครั้งแรก (Phase 1)

### 1. สร้าง Supabase project
1. สมัคร/login ที่ https://supabase.com (ฟรี)
2. New project → ตั้งชื่อ เช่น `abc-stock` → เลือก region Singapore → ตั้ง database password (จดไว้)
3. รอ project สร้างเสร็จ (~2 นาที)

### 2. สร้างตาราง + สิทธิ์
1. เมนูซ้าย **SQL Editor** → New query
2. copy เนื้อหาทั้งไฟล์ `supabase/schema.sql` วางแล้วกด **Run**

### 3. ย้ายข้อมูล + สร้างบัญชี 27 ตัว
เอาค่าจาก **Project Settings → API**: `Project URL` และ `service_role` key (secret)

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_KEY = "SERVICE-ROLE-KEY"
python scripts/migrate_to_supabase.py   # ย้าย catalog/items/transactions + loans แล้ว verify ยอด
python scripts/create_users.py          # สร้าง 27 บัญชี → ได้ scripts/credentials_PRIVATE.csv
```

`credentials_PRIVATE.csv` = อีเมล+รหัสผ่านของทุกคน — แจกรายคนแล้วเก็บ/ลบเอง **ห้าม commit** (gitignore กันไว้แล้ว)

### 4. รันเว็บ local
```powershell
copy .env.example .env    # แล้วกรอก Project URL + anon key (ไม่ใช่ service key!)
npm install
npm run dev
```
เปิด http://localhost:5173 → login ด้วยบัญชี admin

## โครงสร้าง
- `supabase/schema.sql` — ตาราง, trigger ยอดคงเหลือ, RLS, ฟังก์ชัน undo 5 นาที
- `scripts/migrate_to_supabase.py` — ย้าย inventory.json ครั้งเดียว (กันรันซ้ำ)
- `scripts/create_users.py` — สร้างบัญชีทั้งหมด รหัสสุ่ม 6 หลัก
- `src/` — เว็บแอป (Phase 1: login + shell)

## เฟสถัดไป
- Phase 2: หน้า Stock list, Stock In/Out, History
- Phase 3: Transfer 2 ฝั่ง + Loans + Low stock + Admin + deploy GitHub Pages
- Phase 4: PWA, export CSV, ทดลองใช้จริง
