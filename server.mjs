import express from "express";
import OpenAI from "openai";

const app = express();
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const limiter = new Map();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));

function allowRequest(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxRequests = 20;
  const entry = limiter.get(ip);
  if (!entry || now - entry.startedAt > windowMs) {
    limiter.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [ip, entry] of limiter) {
    if (entry.startedAt < cutoff) limiter.delete(ip);
  }
}, 10 * 60 * 1000).unref();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY), model });
});

app.post("/api/chat", async (req, res) => {
  if (!allowRequest(req.ip || "unknown")) {
    return res.status(429).json({ error: "Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau vài phút." });
  }

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 2000) {
    return res.status(400).json({ error: "Nội dung phải có từ 1 đến 2.000 ký tự." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "AI chưa được cấu hình." });
  }

  const rawContext = req.body?.context;
  const context = rawContext && typeof rawContext === "object"
    ? {
        title: String(rawContext.title || "").slice(0, 300),
        group: String(rawContext.group || "").slice(0, 100),
        description: String(rawContext.description || "").slice(0, 1800),
        signs: Array.isArray(rawContext.signs) ? rawContext.signs.slice(0, 8).map(x => String(x).slice(0, 300)) : [],
        action: String(rawContext.action || "").slice(0, 1200)
      }
    : null;

  const knowledge = context
    ? `Tình huống gần nhất trong kho 45 tình huống SafeStudent:
- Tên: ${context.title}
- Nhóm: ${context.group}
- Mô tả: ${context.description}
- Dấu hiệu: ${context.signs.join("; ")}
- Hành động gợi ý: ${context.action}`
    : "Chưa tìm thấy tình huống đủ gần trong kho SafeStudent. Hãy hỏi thêm thông tin thay vì suy đoán.";

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      store: false,
      max_output_tokens: 700,
      reasoning: { effort: "none" },
      instructions: `Bạn là Trợ lý SafeStudent, hỗ trợ sinh viên Việt Nam nhận diện lừa đảo và nguy cơ an toàn.
Trả lời bằng tiếng Việt tự nhiên, ngắn gọn, bình tĩnh và không phán xét.
Không khẳng định một người là tội phạm khi chưa đủ bằng chứng. Phân biệt rõ: chưa đủ dữ kiện, cần xác minh, đáng ngờ, nguy cơ cao.
Ưu tiên hành động giảm thiệt hại: dừng chuyển tiền/gửi dữ liệu, xác minh bằng kênh chính thức tự tìm, gọi ngân hàng nếu đã chuyển tiền, đổi mật khẩu và đăng xuất phiên lạ nếu đã lộ tài khoản, lưu bằng chứng, tìm người đáng tin cậy hỗ trợ.
Nếu có nguy cơ thân thể, bị giữ giấy tờ, cô lập, cưỡng ép hoặc tống tiền: ưu tiên rời đến nơi an toàn khi có thể, liên hệ người tin cậy và cơ quan chức năng.
Không yêu cầu người dùng gửi OTP, mật khẩu, PIN, CVV, khóa bí mật hay ảnh giấy tờ đầy đủ. Nhắc họ che thông tin nhạy cảm.
Không hứa lấy lại tiền và cảnh báo dịch vụ thu phí để "thu hồi tiền".
Bố cục nên gồm: Mức độ; Vì sao; Làm ngay; một hoặc hai câu hỏi tiếp theo nếu cần.
Chỉ dùng thông tin tình huống tham khảo dưới đây khi phù hợp; không ép khớp:
${knowledge}`,
      input: message
    });

    const answer = response.output_text?.trim();
    if (!answer) throw new Error("Empty model response");
    return res.json({ answer });
  } catch (error) {
    console.error("OpenAI request failed:", error?.status || error?.name || "unknown");
    return res.status(503).json({ error: "Trợ lý AI đang tạm bận. Hệ thống sẽ dùng hướng dẫn dự phòng." });
  }
});

app.use(express.static("dist"));
app.get("*", (_req, res) => res.sendFile("index.html", { root: "dist" }));

app.listen(port, "0.0.0.0", () => {
  console.log(`SafeStudent listening on port ${port}`);
});
