# Ngân hàng câu hỏi: chuyên đề "Làm Trưởng phòng BA cho sản phẩm AI"

Nguồn: `D:\DocBaoAI-web\public\data\series\truong-phong-ba-ai.json` (mảng `articles`, mỗi bài có `id`, `titleVi`, `body`
với mục "## "). Bài vòng đời sản phẩm `c1-vong-doi-phat-trien-san-pham` nằm ở `work/series/c1-vong-doi-phat-trien-san-pham.json`.

Mục tiêu: ai thông thạo cả ngân hàng có thể tự tin làm Trưởng phòng BA phụ trách trợ lý giọng nói AI trên xe điện và các
bài toán AI/dữ liệu. Vì vậy câu hỏi phải sâu: kiểm tra hiểu biết, khả năng vận dụng và phán đoán, không chỉ nhớ chữ.

## Mỗi bài: 26 đến 30 câu

- Dạng câu (gần đúng tỉ lệ): `single` khoảng 30%, `multi` khoảng 25%, `truefalse` khoảng 10%, `match` khoảng 15%, `order` khoảng 15%.
- Mức độ: `level` 1 (nền tảng, khoảng 25%), 2 (vận dụng, khoảng 40%), 3 (chuyên gia, phán đoán khó, khoảng 35%).
- Ít nhất 9 câu tình huống (`scenario: true`): có `context` mô tả một tình huống thật trong công việc (đội, sản phẩm,
  áp lực tiến độ, xung đột giữa các bên, sự cố sau phát hành, số liệu dashboard bất thường, yêu cầu pháp chế...),
  rồi hỏi nên làm gì, ưu tiên gì, phát hiện vấn đề gì, sắp xếp các bước xử lý thế nào. Tình huống có thể là dạng
  single, multi, order hoặc match.
- Phủ đều các mục "## " của bài; mỗi câu ghi `section` là tên mục (không có "## ") mà câu đó dựa vào.
- Câu hỏi bám nội dung bài; có thể dùng kiến thức BA phổ biến, đã được công nhận rộng rãi để làm câu hỏi sâu hơn, nhưng
  đáp án đúng không được mâu thuẫn với bài. Không hỏi chi tiết pháp lý mà bài không nêu (số điều, mức phạt, ngày hiệu lực).
- Phương án nhiễu phải hợp lý, là những sai lầm người làm thật hay mắc; tránh phương án sai lộ liễu, tránh "tất cả các
  đáp án trên", tránh đáp án đúng luôn dài nhất. Với single/multi: 4 hoặc 5 phương án.
- `multi`: 2 đến 4 đáp án đúng, câu hỏi nói rõ "chọn tất cả phương án đúng".
- `match`: 4 đến 6 cặp; vế phải ngắn (dưới 15 từ), không vế phải nào hợp với hai vế trái.
- `order`: 4 đến 7 bước, thứ tự đúng phải rõ ràng theo bài hoặc theo logic chặt chẽ (không mơ hồ).
- `truefalse`: một nhận định có thể gây hiểu nhầm, không phải câu hiển nhiên.
- `explanation`: 2 đến 5 câu, giải thích vì sao đáp án đúng và vì sao các phương án nhiễu chính là sai.
- Tiếng Việt rõ ràng, thân thiện; giữ thuật ngữ tiếng Anh thông dụng. JSON hợp lệ: dùng “ ” cho trích dẫn trong chuỗi,
  không dùng dấu " bên trong chuỗi. Không markdown.

## Định dạng: mỗi bài một file `D:\DocBaoAI-web\work\quiz\<article-id>.json`, là MẢNG các câu

```json
[
  {
    "id": "a1-01",
    "article": "a1-dan-dat-doi-ba",
    "section": "Ưu tiên yêu cầu",
    "type": "single",
    "level": 2,
    "scenario": true,
    "context": "Đoạn tình huống (chỉ khi scenario true).",
    "question": "Câu hỏi?",
    "options": ["A", "B", "C", "D"],
    "answer": 2,
    "explanation": "Vì sao."
  },
  { "id": "a1-02", "type": "multi", "options": ["..."], "answer": [0, 3], "...": "..." },
  { "id": "a1-03", "type": "truefalse", "question": "Nhận định ...", "answer": false, "...": "..." },
  { "id": "a1-04", "type": "match", "question": "Nối ...", "pairs": [{ "left": "...", "right": "..." }], "...": "..." },
  { "id": "a1-05", "type": "order", "question": "Sắp xếp ...", "items": ["bước 1", "bước 2", "bước 3", "bước 4"], "...": "..." }
]
```

- `id`: tiền tố theo bài (`00`, `a1`...`a5`, `b1`...`b5`, `c1`, `99`) + số thứ tự 2 chữ số.
- `single`: `answer` là chỉ số (bắt đầu từ 0). `multi`: `answer` là mảng chỉ số tăng dần. `truefalse`: `answer` true/false.
- `match`: `pairs` theo cặp đúng (ứng dụng sẽ tự xáo vế phải). `order`: `items` theo thứ tự ĐÚNG (ứng dụng tự xáo).
- Không ghi `options`/`answer` cho match/order; không ghi `context` khi `scenario` false.

Tự kiểm tra trước khi xong: JSON đọc được; mỗi câu đủ trường; chỉ số đáp án nằm trong mảng; đếm số câu theo type, level,
scenario. Lệnh mẫu:
node -e "const q=require('D:/DocBaoAI-web/work/quiz/<id>.json');const c=k=>q.reduce((m,x)=>(m[x[k]]=(m[x[k]]||0)+1,m),{});console.log(q.length,c('type'),c('level'),c('scenario'))"
