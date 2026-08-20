# SafeStudent – chatbot chống lừa đảo có OpenAI

Website dùng Vite + React ở frontend và Express ở backend. OpenAI API key chỉ được đọc ở backend qua biến môi trường, không xuất hiện trong mã nguồn hoặc trình duyệt.

## Chạy trên Render Web Service

- Runtime: `Node`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Thêm các biến môi trường:

- `OPENAI_API_KEY`: API key bí mật của OpenAI
- `OPENAI_MODEL`: `gpt-5.6-luna`
- `NODE_ENV`: `production`

Không dùng tên biến bắt đầu bằng `VITE_` cho API key vì biến Vite sẽ được đưa vào mã frontend.

## Cơ chế an toàn

- API key chỉ ở máy chủ.
- Giới hạn 20 câu hỏi/10 phút cho mỗi địa chỉ IP.
- Mỗi câu hỏi tối đa 2.000 ký tự.
- Responses API được gọi với `store: false`.
- Nếu OpenAI tạm lỗi hoặc chưa cấu hình, chatbot tự dùng bộ phân tích 45 tình huống có sẵn.
