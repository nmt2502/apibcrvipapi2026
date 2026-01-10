import express from "express";
import axios from "axios";

const app = express();
const HISTORY_API = "https://sunwin-ai-bot.onrender.com/api/taixiu/history";

app.get("/api/taixiu/predict", async (req, res) => {
  try {
    const { data } = await axios.get(HISTORY_API);

    const total = data.length;
    const phien = data[total - 1]?.id + 1 || total + 1;

    // ==== 1️⃣ LẤY CHUỖI CẦU ====
    const WINDOW = 5;
    const last = data.slice(-WINDOW);

    const chuoi = last
      .map(i => (i.result === "tai" ? "T" : "X"))
      .join("");

    // ==== 2️⃣ PATTERN MATCHING ====
    let tai = 0, xiu = 0;

    for (let i = 0; i < total - WINDOW; i++) {
      const pattern = data
        .slice(i, i + WINDOW)
        .map(x => (x.result === "tai" ? "T" : "X"))
        .join("");

      if (pattern === chuoi) {
        const next = data[i + WINDOW]?.result;
        if (next === "tai") tai++;
        if (next === "xiu") xiu++;
      }
    }

    // ==== 3️⃣ DỰ ĐOÁN CHÍNH ====
    let duDoan;
    let confidenceBase;

    if (tai + xiu > 0) {
      duDoan = tai >= xiu ? "TAI" : "XIU";
      confidenceBase = Math.max(tai, xiu) / (tai + xiu);
    } else {
      // fallback nếu không có pattern
      duDoan = Math.random() > 0.5 ? "TAI" : "XIU";
      confidenceBase = 0.55;
    }

    // ==== 4️⃣ CHỐNG CẦU BỆT ====
    if (/^(T{4,}|X{4,})$/.test(chuoi)) {
      duDoan = duDoan === "TAI" ? "XIU" : "TAI";
      confidenceBase -= 0.1;
    }

    const doTinCay = Math.min(
      Math.max(confidenceBase * 100, 55),
      95
    ).toFixed(0) + "%";

    res.json({
      phien,
      du_doan: duDoan,
      chuoi_cau: chuoi,
      do_tin_cay: doTinCay
    });

  } catch (err) {
    res.status(500).json({ error: "Predict error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Predict API running");
});
