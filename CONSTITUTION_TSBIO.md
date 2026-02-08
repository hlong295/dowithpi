# 📜 HIẾN PHÁP KỸ THUẬT TSBIO — FULL BASELINE 2026 (UPDATED)

## I. MỤC TIÊU HỆ THỐNG
TSBIO là nền tảng:
- Kết nối nông nghiệp sinh học
- Token nội bộ TSB
- Tích hợp Pi Network
- Ưu tiên: ỔN ĐỊNH – KIỂM SOÁT – SCALE – MINH BẠCH

## II. NGUYÊN TẮC BẤT BIẾN
1. Không phá UI đã chốt
2. Không phá auth đang chạy
3. DB = nguồn sự thật duy nhất
4. TSB/Wallet chỉ qua API
5. Không fix khi chưa snapshot
6. Mỗi lần sửa → update baseline

## III. KIẾN TRÚC ĐỊNH DANH (IDENTITY CORE)
### 1 User = 1 Master Profile
`auth.users.id = profiles.id = tsb_wallets.profile_id`

Mọi tài khoản đăng nhập → phải map về **1 profile** duy nhất.

### Bảng identities (đa nguồn)
`identities`
- profile_id
- provider (email | pi)
- provider_uid

## IV. QUY ƯỚC USERNAME (NAMESPACE LOCK)
| Nguồn | Format |
|------|--------|
| Email | hlong295 |
| Pi | pi_hlong295 |

Rule:
- Lowercase
- Không trùng
- Không đổi namespace
- Không merge sai

## V. ROOT ADMIN SYSTEM (UPDATED — CỰC QUAN TRỌNG)
### 1. Root Admin = 1 Người, 2 Identity
Root admin TSBIO có **2 tài khoản hợp lệ**:

#### (A) Root qua Email (Primary)
- Username: **hlong295**
- Email: **dowithpi@gmail.com**
- Provider: **email**
- Role: **root_admin**

#### (B) Root qua Pi (Secondary – Pending)
- Username: **pi_hlong295**
- Provider: **pi**
- Status: **pending (chưa active)**  
Sẽ active khi gắn Pi SDK.

### 2. Rule Gộp Root Identity
Hai tài khoản trên:
- **BẮT BUỘC** map về cùng **1 profile_id**
- Tuyệt đối không tạo profile riêng

### 3. Root Lock Rule
`if (profile.role !== 'root_admin') deny();`  
Không override.

### 4. Root Protection Rule
Cấm:
- Xoá root
- Downgrade root
- Đổi identity root  
Trừ khi qua Super SQL.

## VI. CƠ CHẾ LOGIN
Hiện tại (2026):
- Email = chính
- Pi = beta

Flow:
`auth → profiles → identities → wallet`  
Không cho phát sinh orphan.

## VII. KIẾN TRÚC TOKEN
### Wallet
`tsb_wallets (profile_id PK)`  
1 user = 1 wallet.

### Ledger
`tsb_transactions`  
Mọi biến động → ghi log.  
Cấm update balance tay.

## VIII. ADMIN FIRST RULE (BẮT BUỘC)
Mọi module mới → phải có Admin View.  
Không admin → không DONE.

## IX. BASELINE SYSTEM (MỚI — BẮT BUỘC)
### 1. SOURCE BASELINE
`/baselines/source/TSBIO_SRC_YYYYMMDD_vX.zip`

### 2. DATABASE BASELINE
`/baselines/database/TSBIO_DB_YYYYMMDD.sql`

Phải gồm:
- Schema
- Trigger
- Function
- Index

### 3. CHANGELOG
`/baselines/logs/changelog.md`

## X. DATABASE SNAPSHOT RULE
Sau mỗi phase:
- Export schema
- Export trigger
- Export function
- Lưu file

Không snapshot → rollback.

## XI. AUDIT & LOG
Bảng: `audit_logs`

Bắt buộc:
- actor
- action
- target
- meta
- time

## XII. DEV / AI RULE
AI/Dev bắt buộc:
- Theo constitution
- Không chế
- Không phá baseline
- Không skip log

Vi phạm → revert.
