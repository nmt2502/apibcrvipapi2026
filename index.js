import express from "express";
import axios from "axios";

const app = express();
const HISTORY_API = "https://sunwin-ai-bot.onrender.com/api/taixiu/history";

app.get("/api/taixiu/predict", async (req, res) => {
  try {
    const { data } = await axios.get(HISTORY_API);

    const total = data.length;
    const lastSession = data[total - 1].session;

    // ===== 1️⃣ TẠO CHUỖI CẦU =====
    const WINDOW = 5;
    const chuoiArr = data.slice(-WINDOW).map(i => i.tx);
    const chuoi_cau = chuoiArr.join("");

    // ===== 2️⃣ VIP 2026: SO SÁNH CHUỖI =====
    let tai = 0, xiu = 0;

    for (let i = 0; i < total - WINDOW; i++) {
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

    // ===== 3️⃣ DỰ ĐOÁN =====
    let du_doan;
    let base;

    if (tai + xiu > 0) {
      du_doan = tai >= xiu ? "TAI" : "XIU";
      base = Math.max(tai, xiu) / (tai + xiu);
    } else {
      du_doan = Math.random() > 0.5 ? "TAI" : "XIU";
      base = 0.55;
    }

    // ===== 4️⃣ CHỐNG CẦU BỆT =====
    if (/^(T{4,}|X{4,})$/.test(chuoi_cau)) {
      du_doan = du_doan === "TAI" ? "XIU" : "TAI";
      base -= 0.1;
    }

    const do_tin_cay = Math.min(Math.max(base * 100, 55), 95).toFixed(0) + "%";

    res.json({
      phien: lastSession + 1,
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
