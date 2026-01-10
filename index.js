import express from "express";
import axios from "axios";

const app = express();
const HISTORY_API = "https://sunwin-ai-bot.onrender.com/api/taixiu/history";

/* ==================================================
   TIỆN ÍCH LẤY CHUỖI
================================================== */
const getChuoi = (data, len) =>
  data.slice(0, len).map(i => i.tx).join("");

/* ==================================================
   ENGINE B – SO SÁNH CHUỖI CẦU DÀI
================================================== */
function patternCompareEngine(data) {
  let voteT = 0;
  let voteX = 0;

  const WINDOWS = [6, 9, 12]; // chuỗi dài
  const stat = (pattern) => {
    let T = 0, X = 0, hits = 0;
    for (let i = 0; i + pattern.length < data.length; i++) {
      const s = data.slice(i, i + pattern.length).map(x => x.tx).join("");
      if (s === pattern) {
        hits++;
        data[i + pattern.length].tx === "T" ? T++ : X++;
      }
    }
    return { T, X, hits };
  };

  // lọc cầu loạn 1-1
  if (/^(TX){3,}|^(XT){3,}/.test(getChuoi(data, 6))) {
    return { du_doan: "NO_BET", ly_do: "Cầu loạn dài" };
  }

  for (const w of WINDOWS) {
    const p = getChuoi(data, w);
    const { T, X, hits } = stat(p);

    if (hits >= 6) {
      const weight = w === 12 ? 3 : (w === 9 ? 2 : 1);
      if (T >= X) voteT += weight;
      else voteX += weight;
    }
  }

  if (voteT + voteX < 3 || Math.abs(voteT - voteX) < 2) {
    return { du_doan: "NO_BET", ly_do: "Chuỗi dài yếu" };
  }

  return {
    du_doan: voteT > voteX ? "Tài" : "Xỉu",
    base: Math.max(voteT, voteX) / (voteT + voteX)
  };
}

/* ==================================================
   ENGINE A – VIP ỔN ĐỊNH PRO (NGẮN + TRUNG)
================================================== */
function vipOnDinhPro(data) {
  const W3 = getChuoi(data, 3);
  const W5 = getChuoi(data, 5);
  const W7 = getChuoi(data, 7);

  // cầu loạn
  if (/^(TX){1,}|^(XT){1,}/.test(W3)) {
    return { du_doan: "NO_BET", ly_do: "Cầu loạn ngắn" };
  }

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

  if (s5.total < 8 && s7.total < 8) {
    return { du_doan: "NO_BET", ly_do: "Mẫu ít" };
  }

  let voteT = 0;
  let voteX = 0;

  if (s3.total >= 6) s3.T >= s3.X ? voteT++ : voteX++;
  if (s5.total >= 8) s5.T >= s5.X ? voteT += 2 : voteX += 2;
  if (s7.total >= 8) s7.T >= s7.X ? voteT += 3 : voteX += 3;

  const last10 = data.slice(0, 10);
  last10.filter(i => i.tx === "T").length >= 5 ? voteT++ : voteX++;

  if (Math.abs(voteT - voteX) < 3) {
    return { du_doan: "NO_BET", ly_do: "Không đồng thuận" };
  }

  let base = Math.max(voteT, voteX) / (voteT + voteX);

  if (/^(T{4,}|X{4,})$/.test(W5)) base -= 0.1;

  return {
    du_doan: voteT > voteX ? "Tài" : "Xỉu",
    base,
    chuoi_ngan: W5,
    chuoi_trung: W7
  };
}

/* ==================================================
   API PREDICT – GỘP CHUỖI DÀI
================================================== */
app.get("/api/taixiu/predict", async (req, res) => {
  try {
    const { data } = await axios.get(HISTORY_API);

    if (!Array.isArray(data) || data.length < 40) {
      return res.json({ error: "Not enough data" });
    }

    const phien = data[0].session + 1;

    const A = vipOnDinhPro(data);
    const B = patternCompareEngine(data);

    if (A.du_doan === "NO_BET" || B.du_doan === "NO_BET") {
      return res.json({
        phien,
        du_doan: "NO_BET",
        ly_do: A.ly_do || B.ly_do
      });
    }

    if (A.du_doan !== B.du_doan) {
      return res.json({
        phien,
        du_doan: "NO_BET",
        ly_do: "Ngắn – dài không cùng hướng"
      });
    }

    const do_tin_cay =
      Math.min(
        Math.max(((A.base + B.base) / 2) * 100, 66),
        82
      ).toFixed(0) + "%";

    res.json({
      phien,
      du_doan: A.du_doan,
      chuoi_cau_ngan: A.chuoi_ngan,
      chuoi_cau_trung: A.chuoi_trung,
      chuoi_cau_dai: getChuoi(data, 12),
      chuoi_cau_rat_dai: getChuoi(data, 20),
      do_tin_cay
    });

  } catch (err) {
    res.status(500).json({ error: "Predict API error" });
  }
});

/* ==================================================
   SERVER
================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔥 VIP PRO + CHUỖI CẦU DÀI running on port", PORT);
});
