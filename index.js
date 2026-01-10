import express from "express";
import axios from "axios";

const app = express();
const HISTORY_API = "https://sunwin-ai-bot.onrender.com/api/taixiu/history";

app.get("/api/taixiu/predict", async (req, res) => {
  try {
    const { data } = await axios.get(HISTORY_API);

    if (!Array.isArray(data) || data.length < 20) {
      return res.json({ error: "Not enough data" });
    }

    // ===== 1️⃣ PHIÊN TIẾP THEO (API mới → cũ) =====
    const phien = data[0].session + 1;

    // ===== 2️⃣ CHUỖI CẦU (TỪ TRÊN → XUỐNG) =====
    const WINDOW = 5;
    const chuoi_cau = data
      .slice(0, WINDOW)
      .map(i => i.tx)
      .join("");

    // ===== 3️⃣ VIP 2026 – PATTERN MATCHING =====
    let tai = 0, xiu = 0;

    for (let i = 0; i + WINDOW < data.length; i++) {
      const pattern = data
        .slice(i, i + WINDOW)
        .map(x => x.tx)
        .join("");

      if (pattern === chuoi_cau) {
        const next = data[i + WINDOW]?.tx;
        if (next === "T") tai++;
        if (next === "X") xiu++;
      }
    }

    const total = tai + xiu;

    // ===== 4️⃣ LỌC CẦU XẤU (VIP) =====
    if (total < 6) {
      return res.json({
        phien,
        du_doan: "NO_BET",
        chuoi_cau,
        do_tin_cay: "0%"
      });
    }

    // ===== 5️⃣ DỰ ĐOÁN =====
    let du_doan = tai > xiu ? "Tài" : "Xỉu";
    let base = Math.max(tai, xiu) / total;

    // ===== 6️⃣ CHỐNG CẦU BỆT / LOẠN =====
    if (/^(T{4,}|X{4,})$/.test(chuoi_cau)) {
      base -= 0.1; // không đảo cứng, chỉ giảm độ tin cậy
    }

    // ===== 7️⃣ GIỚI HẠN ĐỘ TIN CẬY (THỰC TẾ) =====
    const do_tin_cay = Math.min(
      Math.max(base * 100, 60),
      78
    ).toFixed(0) + "%";

    res.json({
      phien,
      du_doan,
      chuoi_cau,
      do_tin_cay
    });

  } catch (err) {
    res.status(500).json({ error: "Predict API error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Predict API running"));
