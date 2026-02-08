# TSBIO v2 — Stage 0 (P0) Database Baseline

Checklist mục tiêu:
- **P0.1** Chốt Database Baseline (dump schema + data core)
- **P0.2** Khóa Root Admin (DB-side) (không tạo auth user bằng SQL)
- **P0.3** Khóa Namespace Username (lowercase + unique case-insensitive)

> Nguyên tắc: không phá UI, không phá flow login. DB là Single Source of Truth.

---

## P0.3 — Khóa Namespace Username
Chạy file: `db/stage0/sql/0_3_namespace_username.sql`

DoD:
- Query check duplicates trả về **no rows**
- Unique index `profiles_username_lower_uniq` tồn tại
- Constraint `profiles_username_not_pi_prefix` tồn tại

---

## P0.2 — Khóa Root Admin
Chạy file: `db/stage0/sql/0_2_lock_root_admin.sql`

Điều kiện trước khi chạy:
- Email root user đã được tạo trong `auth.users` bằng:
  - UI Register của app **hoặc**
  - Supabase Dashboard → Authentication → Users → Add user

DoD:
- `profiles.role = 'root_admin'` cho username `hlong295`
- `identities(provider='email', provider_uid='dowithpi@gmail.com')` link đúng profile

---

## P0.1 — Dump Baseline (gợi ý)
- Supabase Dashboard → Database → Backups (nếu có)
- Hoặc dùng `pg_dump` từ máy của bạn

Script trong repo:
- `scripts/db/backup_db.sh` (dump full DB → .sql.gz)
- `scripts/db/snapshot_schema.sh` (schema-only)

Ví dụ:
```bash
export DATABASE_URL="postgres://..."
./scripts/db/backup_db.sh
./scripts/db/snapshot_schema.sh
```

Khuyến nghị lưu:
- DDL/schema gốc
- Dump data các bảng:
  - `public.profiles`
  - `public.identities`
  - `public.tsb_wallets`
  - `public.tsb_transactions`

Tag nội bộ: `DB_BASELINE_V2`
