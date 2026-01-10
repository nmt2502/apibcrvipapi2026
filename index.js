import express from "express";
import axios from "axios";

const app = express();
const HISTORY_API = "https://sunwin-ai-bot.onrender.com/api/taixiu/history";

/* =========================
   VIP ỔN ĐỊNH PRO 2026 CORE
========================= */
function vipOnDinhPro(data) {
  const phien = data[0].session + 1;

  const getPattern = (w) =>
    data.slice(0, w).map(i => i.tx).join("");

  const W3 = getPattern(3);
  const W5 = getPattern(5);
  const W7 = getPattern(7);

  const stat = (pattern) => {
    let T = 0, X = 0;
    for (let i = 0; i + pattern.length < data.length; i++) {
      const s = data.slice(i, i + pattern.length).map(x => x.tx).join("");
      if (s === pattern) {
        data[i + pattern.length].tx === "T" ? T++ : X++;
      }
    }
    return { T, X, total: T + X };
  };

  const s3 = stat(W3);
  const s5 = stat(W5);
  const s7 = stat(W7);

  /* ===== LỚP 1: CẦU CẤM ===== */
  if (/^(TX){1,}|^(XT){1,}/.test(W3)) {
    return {
      phien,
      du_doan: "NO_BET",
      ly_do: "Cầu loạn 1-1"
    };
  }

  if (s5.total < 8 && s7.total < 8) {
    return {
      phien,
      du_doan: "NO_BET",
      ly_do: "Mẫu lịch sử quá ít"
    };
  }

  /* ===== LỚP 2: VOTING TRỌNG SỐ ===== */
  let voteT = 0;
  let voteX = 0;

  // W3 (1 điểm)
  if (s3.total >= 6) (s3.T >= s3.X ? voteT += 1 : voteX += 1);

  // W5 (2 điểm)
  if (s5.total >= 8) (s5.T >= s5.X ? voteT += 2 : voteX += 2);

  // W7 (3 điểm)
  if (s7.total >= 8) (s7.T >= s7.X ? voteT += 3 : voteX += 3);

  /* ===== LỚP 3: TẦN SUẤT GẦN ===== */
  const last10 = data.slice(0, 10);
  const t10 = last10.filter(i => i.tx === "T").length;
  const x10 = 10 - t10;
  (t10 >= x10 ? voteT++ : voteX++);

  /* ===== KHÔNG ĐỒNG THUẬN ===== */
  if (Math.abs(voteT - voteX) < 3) {
    return {
      phien,
      du_doan: "NO_BET",
      ly_do: "Không đủ đồng thuận"
    };
  }

  /* ===== DỰ ĐOÁN ===== */
  const du_doan = voteT > voteX ? "Tài" : "Xỉu";

  /* ===== ĐỘ TIN CẬY THẬT ===== */
  let base = Math.max(voteT, voteX) / (voteT + voteX);

  // giảm nếu bệt dài
  if (/^(T{4,}|X{4,})$/.test(W5)) base -= 0.1;

  const do_tin_cay =
    Math.min(Math.max(base * 100, 62), 78).toFixed(0) + "%";

  return {
    phien,
    du_doan,
    chuoi_cau: W7,
    do_tin_cay
  };
}

/* =========================
   API PREDICT
========================= */
app.get("/api/taixiu/predict", async (req, res) => {
  try {
    const { data } = await axios.get(HISTORY_API);

    if (!Array.isArray(data) || data.length < 20) {
      return res.json({ error: "Not enough data" });
    }

    const result = vipOnDinhPro(data);
    res.json(result);

  } catch (err) {
    res.status(500).json({ error: "Predict API error" });
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔥 VIP ỔN ĐỊNH PRO running on port", PORT);
});
