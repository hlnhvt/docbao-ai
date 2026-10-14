# Đọc Báo AI (web)

Web app tĩnh (Vite + Tailwind + JS thuần, localStorage) đọc điểm tin AI mỗi ngày bằng tiếng Việt.
Nội dung là các file JSON trong `public/data/issues/`, do Claude biên tập mỗi ngày khi người dùng yêu cầu.
Push lên GitHub, Vercel tự build và triển khai.

## Quy trình mỗi ngày ("làm số hôm nay", "cập nhật tin")

1. `npm run collect` (mặc định 36 giờ gần nhất; thêm `-- --hours 48` nếu số trước đã cách hơn một ngày).
   Kết quả: `work/candidates-<ngày>.json` và danh sách in ra theo nhóm, có điểm.
2. Chọn 12 đến 18 bài, cân đối các nhóm: research, lab, newsletter, press, community.
   Ưu tiên: mô hình hoặc sản phẩm lớn, bài có mặt ở nhiều nguồn, HN nhiều điểm, paper HF nhiều upvote, phân tích sâu.
   Bỏ: tin quảng cáo, sự kiện, gọi vốn nhỏ, chuyện lặt vặt về sản phẩm tiêu dùng, bài trùng chủ đề.
3. `npm run text -- <url> <url> ...` để lấy toàn văn vào `work/text/`. Đọc từng file trước khi viết.
   Paper Hugging Face: abstract đã có trong file candidates. Trang chặn tải (Ars Technica) thì thử WebFetch;
   không đọc được nguồn thì **bỏ bài**, không viết dựa trên tiêu đề.
4. Viết `public/data/issues/<YYYY-MM-DD>.json` (ngày giờ Việt Nam) theo mẫu dưới.
5. `npm run build` (tự kiểm tra JSON và dựng lại `public/data/index.json`), sửa lỗi nếu có.
6. Commit `content: điểm tin <ngày>` và `git push`. Vercel tự triển khai.

## Văn phong

- Tiếng Việt dễ hiểu, súc tích. Câu ngắn, một ý một câu. Không sáo rỗng, không giật tít.
- **Tóm lược và biên tập lại bằng lời của mình, không dịch nguyên văn cả bài** (trang công khai, bài gốc có bản quyền).
  Trích dẫn trực tiếp chỉ vài chữ, đặt trong “ ”, ghi rõ ai nói.
- Giữ thuật ngữ tiếng Anh thông dụng (agent, benchmark, token, fine-tune...) và giải thích trong `glossary`.
- Đúng số liệu, tên riêng, tên mô hình như nguồn. Không thêm điều nguồn không nói.
- Số liệu do công ty tự công bố: thêm dòng `> Các số liệu ... do X tự công bố.`
  Tin cáo buộc hình sự: ghi rõ là cáo buộc. Bài Reddit/HN: ghi là chia sẻ của người dùng, chưa kiểm chứng.
- Nhận định riêng của người biên tập phải mở đầu bằng “Gợi ý của người biên tập:”.

## Mẫu một bài

```json
{
  "id": "chu-thuong-va-gach-noi",
  "group": "research | lab | newsletter | press | community",
  "source": "Tên nguồn",
  "url": "https://bai-goc",
  "discussionUrl": "https://news.ycombinator.com/item?id=... (tuỳ chọn)",
  "pdfUrl": "https://arxiv.org/pdf/... (tuỳ chọn)",
  "points": 0,
  "comments": 0,
  "publishedAt": "2026-10-14T08:00:00Z",
  "hot": true,
  "readMinutes": 3,
  "tags": ["..."],
  "titleEn": "Tiêu đề gốc",
  "titleVi": "Tiêu đề tiếng Việt, nói rõ chuyện gì",
  "summary": "2-3 câu.",
  "keyPoints": ["3-5 ý, mỗi ý một câu"],
  "body": ["Đoạn văn", "## Tiêu đề phụ", "- Gạch đầu dòng", "> Ghi chú"],
  "glossary": [{ "term": "...", "explain": "..." }]
}
```

- `points` chỉ ghi khi chính nguồn có điểm (HN points, HF upvotes). `comments` có thể lấy từ luồng thảo luận HN.
- `hot: true` cho 5 đến 8 bài nổi bật nhất; tab "Nổi bật" và "Nghe điểm tin" dùng các bài này.
- Thứ tự bài trong file là thứ tự hiển thị ở tab "Tất cả".
- Số báo có `date`, `title` (một dòng nêu tin chính), `intro` (2-3 câu tổng quan), `articles`.

## Kỹ thuật

- `npm run dev`: chạy thử (mở được trên điện thoại cùng mạng). `npm run build`: kiểm tra + build ra `dist/`.
- `scripts/sources.mjs`: danh sách nguồn. Reddit cần User-Agent riêng (đã có), giãn 3 giây giữa hai lần gọi.
- arXiv tắt mặc định; dùng `npm run collect -- --arxiv "agent,reasoning"` để lọc theo từ khoá.
- localStorage (khóa `dbai:*`): settings, read, saved, tab. Bài đã lưu giữ bản tóm tắt để vẫn liệt kê được.
