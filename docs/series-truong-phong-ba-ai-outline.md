# Series: Làm Trưởng phòng BA cho sản phẩm AI

Slug: `truong-phong-ba-ai`. Người đọc: BA, trưởng nhóm BA, PM, kỹ sư muốn hiểu công việc của một Trưởng phòng BA
phụ trách (A) trợ lý giọng nói AI trên ô tô điện và (B) các bài toán AI/dữ liệu. Bối cảnh ví dụ: một hãng xe điện
Việt Nam bán xe ở nhiều thị trường (lấy cảm hứng từ mô tả tuyển dụng của VinFast).

## Mô tả công việc gốc (bài nào cũng phải bám sát)

A. Nghiệp vụ sản phẩm Trợ lý ảo
1. Dẫn dắt đội ngũ BA thu thập, phân tích và quản lý yêu cầu cho sản phẩm AI Voice Assistant trên ô tô điện VinFast, bao phủ các nhóm tính năng: điều khiển xe, dẫn đường, giải trí, tìm kiếm thông tin và trợ giúp cá nhân.
2. Chuyển định hướng sản phẩm thành PRD, Use Case, User Story, luồng hội thoại (conversation flow), luồng nghiệp vụ (workflow) và tiêu chí nghiệm thu cụ thể cho từng phiên bản phát hành.
3. Đặc tả yêu cầu cho các thành phần AI của trợ lý ảo: nhận diện ý định (NLU/intent), gọi công cụ (tool/function calling), kịch bản agent, quy tắc an toàn nội dung (guardrail) và cơ chế xử lý khi hệ thống hiểu sai.
4. Đảm bảo mọi yêu cầu gắn với trải nghiệm trong xe: an toàn khi lái, độ trễ phản hồi, tính tự nhiên của hội thoại và khả năng hoạt động khi mất kết nối.
5. Phối hợp chặt chẽ với đội kỹ thuật (AI/Dev Engineer) và UX/UI để bảo đảm giải pháp khả thi về kỹ thuật và đúng chuẩn trải nghiệm HMI.

B. Nghiệp vụ AI cho bài toán dữ liệu
1. Xác định và đặc tả các bài toán AI/dữ liệu: cá nhân hóa gợi ý, dự báo nhu cầu, phát hiện bất thường trong vận hành xe và dịch vụ,…
2. Xây dựng yêu cầu nghiệp vụ cho toàn vòng đời dữ liệu: nguồn dữ liệu, kế hoạch thu thập sự kiện (event/tracking plan), tiêu chuẩn chất lượng dữ liệu và yêu cầu tuân thủ bảo vệ dữ liệu cá nhân.
3. Làm việc với Data Engineer/Data Scientist để chuyển bài toán kinh doanh thành bài toán cụ thể: định nghĩa đầu vào/đầu ra, tiêu chí đánh giá (độ chính xác, precision/recall, độ trễ), phương án thử nghiệm A/B và điều kiện đưa vào vận hành.
4. Thiết kế và quản trị hệ thống báo cáo, dashboard đo lường sản phẩm (mức độ sử dụng, tỷ lệ quay lại, tỷ lệ thành công theo tính năng).
5. Đảm bảo dữ liệu thu thập và sử dụng đúng quy định pháp luật và chính sách riêng tư của Tập đoàn tại các thị trường triển khai.

## 12 bài (id, thứ tự, nội dung phải phủ)

1. `00-tong-quan` — Bức tranh toàn cảnh: Trưởng phòng BA trong một sản phẩm AI trên xe điện làm gì cả ngày. BA truyền thống khác BA sản phẩm AI ở đâu (yêu cầu mang tính xác suất, dữ liệu là một phần của yêu cầu, an toàn khi lái). Hai mảng A và B nối với nhau thế nào (dữ liệu từ trợ lý giọng nói nuôi bài toán cá nhân hoá...). Năng lực cần có, các bên liên quan, bản đồ cả series.
2. `a1-dan-dat-doi-ba` — (A1) Tổ chức đội BA theo nhóm tính năng (điều khiển xe, dẫn đường, giải trí, tìm kiếm thông tin, trợ giúp cá nhân). Kỹ thuật thu thập yêu cầu riêng cho trợ lý giọng nói (lái thử, phân tích log hội thoại, khảo sát, Wizard-of-Oz, phân tích đối thủ). Phân tích và ưu tiên (MoSCoW, RICE, Kano). Quản lý yêu cầu: backlog, ma trận truy vết, quản lý thay đổi, đánh giá tác động. Nhịp làm việc, review, coaching đội.
3. `a2-prd-user-story-conversation-flow` — (A2) Từ định hướng sản phẩm đến PRD; Use Case; User Story (INVEST); luồng hội thoại (happy path, nhánh rẽ, sửa lời, ngắt lời); workflow nghiệp vụ; tiêu chí nghiệm thu dạng Given/When/Then, kể cả tiêu chí cho hành vi xác suất (tỷ lệ đúng trên bộ câu thử). Chia phạm vi theo phiên bản phát hành (MVP, 1.1, 2.0), Definition of Ready/Done. Có ví dụ đầy đủ cho một tính năng, ví dụ "đặt điểm đến có điểm sạc trên đường".
4. `a3-dac-ta-thanh-phan-ai` — (A3) Đặc tả NLU: intent, slot/entity, câu mẫu, phân biệt intent dễ nhầm, ngưỡng tin cậy. Tool/function calling: mô tả công cụ, tham số, điều kiện tiên quyết, quyền, lỗi trả về. Kịch bản agent nhiều bước. Guardrail: nội dung, hành động nguy hiểm, quyền riêng tư, chống prompt injection. Xử lý khi hiểu sai: hỏi lại, xác nhận, gợi ý, fallback, chuyển kênh. Bộ dữ liệu đánh giá.
5. `a4-trai-nghiem-trong-xe` — (A4) Yêu cầu phi chức năng gắn với lái xe: an toàn và giảm xao nhãng (giới hạn tương tác thị giác/thao tác khi xe chạy, ưu tiên giọng nói, hành động cần xác nhận), ngân sách độ trễ cho từng chặng (đánh thức, nhận dạng tiếng nói, hiểu, thực thi, đọc phản hồi), hội thoại tự nhiên (ngắt lời, lượt lời, nhiều người trong xe, giọng vùng miền, tiếng ồn), chạy khi mất kết nối (xử lý trên xe và trên cloud, tính năng nào phải chạy offline, đồng bộ lại). Cách viết các yêu cầu này cho đo được.
6. `a5-phoi-hop-ky-thuat-ux` — (A5) Làm việc với AI Engineer, Dev, UX/UI, QA, kỹ sư hệ thống xe: đánh giá khả thi, spike/POC, review thiết kế HMI (màn hình, giọng, đèn báo), RACI, nghi thức (refinement, demo, review hội thoại), xử lý bất đồng, ngôn ngữ chung (glossary), tài liệu bàn giao.
7. `b1-xac-dinh-bai-toan-ai-du-lieu` — (B1) Biến cơ hội thành bài toán AI: cá nhân hoá gợi ý (điểm sạc, nhạc, lộ trình, dịch vụ), dự báo nhu cầu (sạc, phụ tùng, bảo dưỡng), phát hiện bất thường (pin, cảm biến, gian lận dịch vụ). Khi nào không cần AI. Khung đánh giá giá trị/khả thi/dữ liệu sẵn có/rủi ro. Mẫu đặc tả bài toán (problem statement).
8. `b2-vong-doi-du-lieu` — (B2) Nguồn dữ liệu (xe, app, trợ lý giọng nói, xưởng dịch vụ, CRM), kế hoạch tracking: đặt tên sự kiện, thuộc tính, ai sở hữu, kiểm thử tracking. Tiêu chuẩn chất lượng dữ liệu (đầy đủ, chính xác, kịp thời, nhất quán, duy nhất, hợp lệ), SLA dữ liệu, data contract. Yêu cầu riêng tư trong từng giai đoạn: thu thập, lưu, dùng, chia sẻ, xoá.
9. `b3-tu-bai-toan-kinh-doanh-den-mo-hinh` — (B3) Định nghĩa đầu vào/đầu ra, nhãn, baseline. Chỉ số đánh giá offline (accuracy, precision, recall, F1, MAE/MAPE...) giải thích bằng ví dụ đời thường và chọn chỉ số theo chi phí sai. Độ trễ, chi phí. Thiết kế A/B test (giả thuyết, nhóm, cỡ mẫu ở mức khái niệm, chỉ số bảo vệ). Điều kiện đưa vào vận hành, giám sát sau khi chạy (drift), quay lui.
10. `b4-dashboard-do-luong` — (B4) Khung chỉ số (North Star, HEART, AARRR), các chỉ số cho trợ lý giọng nói (mức độ dùng, tỷ lệ quay lại, tỷ lệ thành công theo tính năng, tỷ lệ phải hỏi lại, tỷ lệ bỏ dở), từ điển chỉ số, thiết kế dashboard theo người xem, quản trị (ai sở hữu, cách sửa định nghĩa, cảnh báo), tránh "chỉ số phù phiếm".
11. `b5-tuan-thu-du-lieu-ca-nhan` — (B5) Riêng tư theo thiết kế, tối thiểu hoá, mục đích, đồng ý, quyền của chủ thể dữ liệu, lưu giữ và xoá, chuyển dữ liệu xuyên biên giới, đánh giá tác động (DPIA), dữ liệu giọng nói và vị trí là dữ liệu nhạy cảm. Bản đồ quy định theo thị trường ở mức tổng quan (Việt Nam, EU, Mỹ...). BA làm gì cụ thể: checklist trong PRD, câu hỏi cho bộ phận pháp chế. Có ghi chú "không phải tư vấn pháp lý, cần đối chiếu văn bản hiện hành".
12. `99-90-ngay-va-bo-cong-cu` — Kế hoạch 90 ngày đầu của một Trưởng phòng BA mới, bộ mẫu tài liệu (dưới dạng danh sách mục), chỉ số đo hiệu quả của chính phòng BA, các sai lầm thường gặp, tài liệu nên đọc thêm (chỉ nêu những nguồn bạn chắc chắn có thật).

## Văn phong (bắt buộc)

- Tiếng Việt thân thiện, gần gũi, dễ hiểu, như một người anh/chị đi trước chia sẻ kinh nghiệm. Gọi người đọc là "bạn",
  có thể dùng "chúng ta". Câu ngắn, một ý một câu. Không sáo rỗng, không khoe chữ.
- Chuyên sâu: đi tới cách làm cụ thể, mẫu, ví dụ, sai lầm thường gặp, checklist. Mỗi khái niệm khó có một ví dụ đời thường
  hoặc một ví dụ trong xe.
- Giữ thuật ngữ tiếng Anh thông dụng (intent, slot, PRD, user story, precision, recall, A/B test...) và giải thích ngay lần đầu.
- Ví dụ về sản phẩm phải ghi là ví dụ minh hoạ. KHÔNG khẳng định bất kỳ thông tin nội bộ nào về VinFast hay sản phẩm thật
  của họ (tính năng đã có, đối tác, số liệu). Không bịa số liệu thống kê, nghiên cứu, trích dẫn hay tên tài liệu.
- Luật và tiêu chuẩn: chỉ nêu tên khi bạn chắc chắn nó tồn tại; không nêu số điều khoản nếu không chắc. Với pháp lý luôn
  thêm ghi chú cần đối chiếu văn bản hiện hành và hỏi bộ phận pháp chế. Con số ngưỡng (độ trễ, thời gian nhìn màn hình...)
  nếu là gợi ý của người viết thì nói rõ là gợi ý để đội tự đặt mục tiêu, không trình bày như chuẩn bắt buộc.

## Định dạng mỗi bài (một object JSON)

```json
{
  "id": "a1-dan-dat-doi-ba",
  "order": 2,
  "part": "A. Trợ lý ảo trên xe",
  "titleVi": "Tiêu đề rõ ý, gần gũi",
  "summary": "2-3 câu.",
  "keyPoints": ["5-7 ý, mỗi ý một câu"],
  "body": ["Đoạn văn", "## Tiêu đề phụ", "- Gạch đầu dòng", "> Ghi chú, mẹo hoặc lưu ý"],
  "glossary": [{ "term": "...", "explain": "..." }],
  "readMinutes": 14,
  "tags": ["BA", "..."]
}
```

- `part`: "Mở đầu", "A. Trợ lý ảo trên xe", "B. AI và dữ liệu" hoặc "Tổng kết".
- `body`: 60-110 phần tử, khoảng 2.500-3.500 từ. Mỗi đoạn văn 2-5 câu. Dùng "## " cho mục, "- " cho gạch đầu dòng
  (mẫu tài liệu, checklist, ví dụ hội thoại), "> " cho mẹo/lưu ý. Không dùng bảng, không dùng khối code, không dùng markdown
  khác (không **đậm**, không `code`).
- Ví dụ hội thoại viết dạng gạch đầu dòng: "- Người lái: ..." / "- Trợ lý: ...".
- Nên có các mục: vì sao việc này quan trọng, cách làm từng bước, ví dụ minh hoạ, sai lầm thường gặp, checklist cuối bài.
- Cuối bài một câu dẫn sang bài tiếp theo trong series.
- `glossary` 5-10 thuật ngữ. JSON phải hợp lệ: dùng “ ” cho trích dẫn trong chuỗi, không dùng dấu " bên trong chuỗi.
