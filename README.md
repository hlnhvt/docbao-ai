# Đọc Báo AI

Điểm tin AI mỗi ngày: bài báo, bài nghiên cứu và thảo luận chuyên sâu từ các nguồn tiếng Anh, tóm lược và biên tập bằng tiếng Việt.

- Web app tĩnh, tối ưu cho điện thoại: Vite, Tailwind CSS, JavaScript thuần.
- Lưu bài, đánh dấu đã đọc và mọi cài đặt: lưu trong localStorage của trình duyệt.
- Đọc to bằng giọng tiếng Việt của máy (Web Speech API), có "Nghe điểm tin": chọn giọng, tốc độ, độ cao giọng,
  đọc liên tục từ bài này sang bài khác, hẹn giờ tự dừng, gọi tên người nghe, nhạc nền nhẹ (tổng hợp bằng Web Audio).
- Giao diện sáng / giấy / tối / tương phản cao, cỡ chữ, giãn dòng, kiểu chữ, độ dày chữ.
- Thêm vào màn hình chính để dùng như app.

## Chạy

```bash
npm install
npm run dev      # chạy thử
npm run build    # kiểm tra dữ liệu và build ra dist/
```

## Cập nhật nội dung

Xem quy trình trong [CLAUDE.md](CLAUDE.md): `npm run collect`, chọn bài, `npm run text -- <url>`, viết `public/data/issues/<ngày>.json`, build, push.

Bản quyền nội dung gốc thuộc về các nguồn được dẫn link trong từng bài.
