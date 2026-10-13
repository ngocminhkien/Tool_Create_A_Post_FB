# FB Sheet & Media Studio — Hệ Thống Tự Động Hóa Nội Dung Facebook Chuẩn Social SEO & AI Image

Hệ thống Web ứng dụng công nghệ cao hỗ trợ tự động hóa toàn diện quy trình sáng tạo nội dung, kiểm duyệt chính sách Meta, tối ưu Social SEO và đăng bài Fanpage Facebook từ Google Sheets & Excel.

---

## 🚀 Các Tính Năng Nổi Bật

### 1. 🛡️ Facebook Policy Guard & Chống Shadowban (Bóp Reach)
- **Quét từ khóa vi phạm thời gian thực**: Phát hiện các tuyên bố tuyệt đối (cam kết 100%), tuyên bố y tế (trị dứt điểm), phóng đại tài chính, số điện thoại lộ liễu và liên kết ngoài spam.
- **Nút "Tự Động Sửa Tất Cả" (Auto-Sanitize)**: 1 cú click tự động thay thế toàn bộ từ khóa rủi ro bằng ngôn từ an toàn chuẩn chính sách Meta.
- **Gợi ý sửa nhanh (Quick-Fix)**: Cung cấp từ ngữ thay thế an toàn cho từng lỗi vi phạm.

### 2. 📊 Trình Chấm Điểm Social SEO & Readability Scorecard (0–100)
- **Chấm điểm trực tiếp khi gõ**: Đo lường chất lượng nội dung theo thuật toán tìm kiếm và giữ chân người đọc Facebook.
- **Checklist 6 tiêu chí thuật toán Facebook**:
  1. *Từ khóa chính trong 120 ký tự đầu* (25đ) — Tối ưu vùng hiển thị trước nút "Xem thêm" (tăng Dwell Time).
  2. *Mật độ từ khóa chuẩn* (20đ) — Phân bổ tự nhiên 1.0% – 2.5%.
  3. *Độ dài bài viết tối ưu* (20đ) — Chuẩn 250 – 500 từ cho bài chia sẻ giá trị.
  4. *Bố cục thông thoáng & ngắt đoạn* (15đ) — Dễ đọc lướt trên điện thoại di động.
  5. *Mật độ Emoji vừa phải* (10đ) — Điểm nhấn thị giác 3 – 10 biểu tượng.
  6. *Kêu gọi hành động bình luận (Comment CTA)* (10đ) — Kích thích tương tác 2 chiều.

### 3. #️⃣ Bộ Tạo Hashtag 3 Tầng Chuẩn Thuật Toán Meta
- Tự động bóc tách từ khóa bài viết thành cấu trúc phân tầng:
  - **Tầng 1 (Entity / Thương hiệu)**: `#Entity`, `#EntityOfficial`
  - **Tầng 2 (Chủ đề / Ngành nghề)**: `#Topic`, `#Industry`
  - **Tầng 3 (Xu hướng / Khám phá)**: `#ViralFacebook`, `#Trend2026`
- Nút 1-click chèn nhanh vào chân bài viết.

### 4. ⏰ Đề Xuất Khung Giờ Vàng (Golden Hours 1-Click Scheduling)
- 4 preset khung giờ có lưu lượng tương tác cao nhất trong ngày:
  - 🌅 **Sáng sớm (07:30 - 08:30)**: Dân công sở & cập nhật tin tức.
  - 🍱 **Buổi trưa (11:30 - 13:00)**: Giờ nghỉ trưa & mua sắm.
  - ⭐ **Chiều tối PRIME (19:30 - 21:30)**: Khung giờ vàng đỉnh cao tương tác.
  - 🌙 **Đêm muộn (22:00 - 23:00)**: Tâm sự & bài đọc dài.
- Tích hợp bộ hẹn giờ đăng bài trực tiếp lên Facebook Page.

### 5. 🎯 Đa Biến Thể Phong Cách Bài Viết (A/B Testing)
- Chuyển đổi linh hoạt giữa 4 phong cách nội dung:
  - 📖 **Storytelling / Cảm xúc**: Chạm vào cảm xúc, câu chuyện truyền cảm hứng.
  - 🎯 **Bán hàng / Trực diện (PAS/AIDA)**: Nêu vấn đề, đưa giải pháp, kêu gọi chốt đơn.
  - 📰 **Tin tức / Cẩm nang chia sẻ**: Kiến thức logic, gạch đầu dòng rõ ràng.
  - ✨ **Hài hước / Bắt trend**: Ngôn từ dí dỏm, meme tự nhiên kích thích chia sẻ viral.

### 6. 🎨 AI Tạo Bộ Ảnh Theo Chủ Đề (Flux.1) & Tối Ưu SEO Ảnh
- Tự động dịch và viết prompt mỹ thuật đa góc chụp (Flycam, Kiến trúc, Cận cảnh, Hoàng hôn).
- Tính toán lượng Token tiêu hao ước tính và cảnh báo an toàn quota.
- Tự động sinh **Alt Text** và **Caption** chuẩn SEO cho hình ảnh Facebook.

### 7. 🔑 Luân Phiên 30 Key Google Gemini Free (`geminiKeyPool.service.ts`)
- Tự động xoay vòng tuần tự qua pool API Keys Gemini.
- Tự động phát hiện lỗi quota (429) và chuyển sang key tiếp theo (Auto-Failover).

### 8. 💾 Cơ Sở Dữ Liệu SQLite Native
- Lưu trữ an toàn các bài đăng, lịch sử đăng bài, bộ ảnh và cấu hình API key trên SQLite native engine (`node:sqlite`).
- Hỗ trợ migration động đảm bảo tương thích dữ liệu.

---

## 🛠️ Hướng Dẫn Cài Đặt & Khởi Chạy

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy server phát triển
npm run dev

# 3. Chạy toàn bộ test suites E2E (166 test cases)
npx tsx tests/e2e/runAll.ts
```

Mở trình duyệt tại: `http://localhost:3000` (hoặc `http://localhost:3002`)

---

## 📜 Bản Quyền & Giấy Phép
Phát triển bởi đội ngũ kỹ thuật. Giấy phép mã nguồn mở MIT.
