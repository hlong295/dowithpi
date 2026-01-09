Goal (incl. success criteria):
- PITODO: fix theo yêu cầu, không phá login Pi/email, không đổi UI.
- Current: PITD purchase ("Đổi bằng PITD") chạy end-to-end và ghi DB đúng.

Constraints/Assumptions:
- PITD chỉ qua API server.
- Không sửa UI/không thêm bớt hiển thị.

Key decisions:
- /api/payments/pitd tự đọc product/provider từ DB, tự tính giá PITD, verify expectedAmount.
- Ghi user_purchases + pitd_transactions.

State:
- Now: Implement PITD purchase server logic + wiring from ExchangeModal.
- Next: Test on Pi Browser.

Working set (files):
- components/exchange-modal.tsx
- app/api/payments/pitd/route.ts
