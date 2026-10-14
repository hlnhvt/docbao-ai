# Đọc Báo AI (web)

Web app tĩnh (Vite + Tailwind + JS thuần, localStorage) đọc điểm tin AI mỗi ngày bằng tiếng Việt.
Nội dung là các file JSON trong `public/data/issues/`, do Claude biên tập.
Tác vụ "DocBaoAI daily" của Windows Task Scheduler chạy `scripts/daily.ps1` lúc 6:00 sáng mỗi ngày: xoá số cũ, gọi
`claude -p` (Sonnet) làm số mới theo `scripts/daily-prompt.md` (CLI quá cũ thì tự `claude update` rồi thử lại một lần),
rồi nếu kiểm tra đạt thì commit riêng `public/data` và `data` và push `main`. Log ở `work/logs/`.
Vercel tự build và triển khai. Cũng có thể làm số bằng tay khi người dùng yêu cầu.

## Quy trình mỗi ngày ("làm số hôm nay", "cập nhật tin")

1. `npm run collect` (mặc định 36 giờ gần nhất; thêm `-- --hours 48` nếu số trước đã cách hơn một ngày).
   Kết quả: `work/candidates-<ngày>.json`, `work/published-recent.txt` (tiêu đề 7 ngày qua) và danh sách in ra theo nhóm, có điểm.
   Bài đã đăng (cùng url, luồng HN hoặc mã arXiv) bị ẩn tự động. Dòng có `≈ĐÃ ĐĂNG?` là tiêu đề gần giống bài cũ: kiểm tra kỹ.
2. Chọn **30 đến 40 bài**, cân đối các nhóm: research, lab, newsletter, press, community.
   Không đủ bài tốt thì mở rộng: `--hours 48`, `--hn-min 50`, `--arxiv "agent,reasoning,benchmark"`. Không độn bài kém để đủ số.
   Ưu tiên: mô hình hoặc sản phẩm lớn, bài có mặt ở nhiều nguồn, HN nhiều điểm, paper HF nhiều upvote, phân tích sâu.
   Bỏ: tin quảng cáo, sự kiện, gọi vốn nhỏ, chuyện lặt vặt về sản phẩm tiêu dùng, bài trùng chủ đề.
   **Không trùng nội dung**: mỗi sự kiện chỉ một bài, kể cả khi nhiều nguồn cùng đưa (chọn nguồn đầy đủ nhất,
   nguồn khác chỉ nhắc trong thân bài). Đối chiếu với `work/published-recent.txt`: sự kiện đã đăng thì bỏ,
   trừ khi có diễn biến mới thật sự (khi đó tiêu đề và tóm tắt phải nói rõ diễn biến mới).
3. `npm run text -- <url> <url> ...` để lấy toàn văn vào `work/text/`. Đọc từng file trước khi viết.
   Paper Hugging Face: abstract đã có trong file candidates. Trang chặn tải (Ars Technica) thì thử WebFetch;
   không đọc được nguồn thì **bỏ bài**, không viết dựa trên tiêu đề.
4. Viết `public/data/issues/<YYYY-MM-DD>.json` (ngày giờ Việt Nam) theo mẫu dưới. Số nhiều bài thì viết từng phần
   (mảng JSON khoảng 10 bài) vào `work/drafts/`, rồi `npm run assemble -- <ngày> work/drafts/*.json` để ghép;
   sau đó điền `title`, `intro` và đặt `hot`.
5. `npm run build`, sửa lỗi nếu có. Bước này xoá số cũ, kiểm tra JSON, chặn bài trùng và dựng lại `public/data/index.json`.
   Cảnh báo "tiêu đề gần giống" không chặn build nhưng phải xem và xử lý.
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
- `hot: true` cho 6 đến 10 bài nổi bật nhất; tab "Nổi bật" và "Nghe điểm tin" dùng các bài này.
- Thứ tự bài trong file là thứ tự hiển thị ở tab "Tất cả".
- Số báo có `date`, `title` (một dòng nêu tin chính), `intro` (2-3 câu tổng quan), `articles`.

## Kỹ thuật

- `npm run dev`: chạy thử (mở được trên điện thoại cùng mạng). `npm run build`: kiểm tra + build ra `dist/`.
- `scripts/sources.mjs`: danh sách nguồn. Reddit cần User-Agent riêng (đã có), giãn 3 giây giữa hai lần gọi.
- Lưu trữ: số cũ hơn 45 ngày (`KEEP_DAYS` trong `scripts/dedup.mjs`) bị xoá khi build; url và tiêu đề của chúng
  chuyển vào `data/seen.json` (giữ 365 ngày) để vẫn chặn đăng lại. Commit cả việc xoá file lẫn `data/seen.json`.
- arXiv tắt mặc định; dùng `npm run collect -- --arxiv "agent,reasoning"` để lọc theo từ khoá.
- localStorage (khóa `dbai:*`): settings, read, saved, tab. Bài đã lưu giữ bản tóm tắt để vẫn liệt kê được.
