
📜 HIẾN PHÁP KỸ THUẬT TSBIO — V27 FINAL (2026)
=========================================

I. MỤC TIÊU HỆ THỐNG
TSBIO là nền tảng:
• Cung cấp giải pháp sinh học nông nghiệp lõi (TSBIO Core)
• Hỗ trợ cứu vườn – phục hồi đất – tăng năng suất
• Xây dựng hệ sinh thái nông sản được chứng thực
• Tích hợp Token nội bộ TSB
• Mở rộng thành Agri-Tech Marketplace

Ưu tiên:
ỔN ĐỊNH → DOANH THU → KIỂM SOÁT → SCALE → TỐI ƯU

-----------------------------------------

II. NGUYÊN TẮC BẤT BIẾN
1. Không phá UI (pixel-level)
2. Không phá auth/login
3. Không bypass admin
4. Không ghi DB từ client
5. Không update token thủ công
6. Không sửa khi chưa snapshot
7. Không merge khi chưa test
8. DB = nguồn sự thật
9. Wallet chỉ qua API
10. Mỗi lần sửa → baseline

-----------------------------------------

III. IDENTITY CORE
1 User = 1 Profile
auth.users.id = profiles.id = tsb_wallets.profile_id

identities:
- id
- profile_id
- provider
- provider_uid (unique)

-----------------------------------------

IV. USERNAME LOCK
Email: hlong295
Pi: pi_hlong295
Rule: lowercase, không rename, không merge

-----------------------------------------

V. ROOT ADMIN
Primary: hlong295 / dowithpi@gmail.com
Secondary: pi_hlong295 (pending)

if role != root_admin → deny

-----------------------------------------

VI. LOGIN FLOW
Auth → Profile → Identity → Wallet → Session

-----------------------------------------

VII. TOKEN
tsb_wallets
tsb_transactions
Không update balance tay

-----------------------------------------

VIII. ADMIN FIRST
Module mới phải có Admin View

-----------------------------------------

IX. PRODUCT CORE
Types: combo, single, farm, service
Priority: combo > single > farm

Flags:
is_combo
is_featured
is_flashsale
is_verified
is_active
is_archived

-----------------------------------------

X. MEDIA RULE
• 1 video
• ≤10 ảnh
• thumbnail
• compress
• CDN

-----------------------------------------

XI. DESCRIPTION
• WYSIWYG (Tiptap)
• Sanitize
• Paste OK

-----------------------------------------

XII. UI / UX (PIXEL LOCK)
Không đổi layout, spacing, icon, màu
Chỉ bind data & enhance

Mobile:
Swipe, Zoom, Fullscreen

-----------------------------------------

XIII. CMS
Tin tức:
Draft, SEO, Category
Cứu vườn:
Case, Before/After, Flag

-----------------------------------------

XIV. MARKETPLACE
Đăng bài có phí
Admin duyệt
Verified

-----------------------------------------

XV. PRODUCT DETAIL
Slider mượt
Zoom
Video
Seller info
Review
Combo suggest

-----------------------------------------

XVI. AUDIT
audit_logs:
actor, action, target, meta, time

-----------------------------------------

XVII. PERMISSION
root / editor / provider / member / guest

-----------------------------------------

XVIII. BASELINE
/baselines/source
/baselines/database
changelog.md
BASELINE.md
CONTINUITY.md

-----------------------------------------

XIX. SNAPSHOT
Schema / Trigger / Function / Index

-----------------------------------------

XX. DEV RULE
Không phá baseline
Không skip log
Không đoán DB

-----------------------------------------

XXI. ROADMAP 2026
Phase 1: Combo, CMS, Cứu vườn
Phase 2: Marketplace, Review
Phase 3: AI, Subscription

-----------------------------------------

THẦN CHÚ:
“Không phá nền – Không đốt tiền – Không làm ẩu – Không lệch hướng”
