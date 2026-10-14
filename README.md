# Đọc Báo AI

Điểm tin AI mỗi ngày: bài báo, bài nghiên cứu và thảo luận chuyên sâu từ các nguồn tiếng Anh, tóm lược và biên tập bằng tiếng Việt.

- Web app tĩnh, tối ưu cho điện thoại: Vite, Tailwind CSS, JavaScript thuần.
- Lưu bài, đánh dấu đã đọc, cỡ chữ, giao diện sáng / giấy / tối: lưu trong localStorage của trình duyệt.
- Đọc to bằng giọng tiếng Việt của máy (Web Speech API), có "Nghe điểm tin".
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
