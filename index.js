import express from "express";
import axios from "axios";

const app = express();
const HISTORY_API = "https://sunwin-ai-bot.onrender.com/api/taixiu/history";

/* =========================
   ENGINE B – SO SÁNH CHUỖI CẦU
========================= */
function patternCompareEngine(data, windows = [4, 6, 8]) {
  const phien = data[0].session + 1;

  const getPattern = w => data.slice(0, w).map(i => i.tx).join("");

  // lọc cầu 1-1
  if (/^(TX){2,}|^(XT){2,}/.test(getPattern(4))) {
    return { du_doan: "NO_BET", ly_do: "Cầu loạn 1-1" };
  }

  let voteT = 0, voteX = 0;

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

  for (const w of windows) {
    const p = getPattern(w);
    const { T, X, hits } = stat(p);
    if (hits >= 6) {
      const weight = w >= 8 ? 3 : (w >= 6 ? 2 : 1);
      (T >= X ? voteT : voteX) += weight;
    }
  }

  if (voteT + voteX < 3 || Math.abs(voteT - voteX) < 2) {
    return { du_doan: "NO_BET", ly_do: "Pattern yếu" };
  }

  return {
    du_doan: voteT > voteX ? "Tài" : "Xỉu",
    base: Math.max(voteT, voteX) / (voteT + voteX)
  };
}

/* =========================
   ENGINE A – VIP ỔN ĐỊNH PRO
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

  if (/^(TX){1,}|^(XT){1,}/.test(W3)) {
    return { du_doan: "NO_BET", ly_do: "Cầu loạn 1-1" };
  }

  if (s5.total < 8 && s7.total < 8) {
    return { du_doan: "NO_BET", ly_do: "Mẫu ít" };
  }

  let voteT = 0, voteX = 0;

  if (s3.total >= 6) (s3.T >= s3.X ? voteT++ : voteX++);
  if (s5.total >= 8) (s5.T >= s5.X ? voteT += 2 : voteX += 2);
  if (s7.total >= 8) (s7.T >= s7.X ? voteT += 3 : voteX += 3);

  const last10 = data.slice(0, 10);
  const t10 = last10.filter(i => i.tx === "T").length;
  (t10 >= 5 ? voteT++ : voteX++);

  if (Math.abs(voteT - voteX) < 3) {
    return { du_doan: "NO_BET", ly_do: "Không đồng thuận" };
  }

  let base = Math.max(voteT, voteX) / (voteT + voteX);
  if (/^(T{4,}|X{4,})$/.test(W5)) base -= 0.1;

  return {
    du_doan: voteT > voteX ? "Tài" : "Xỉu",
    base,
    chuoi_cau: W7
  };
}

/* =========================
   API PREDICT – GỘP 2 ENGINE
========================= */
app.get("/api/taixiu/predict", async (req, res) => {
  try {
    const { data } = await axios.get(HISTORY_API);
    if (!Array.isArray(data) || data.length < 30) {
      return res.json({ error: "Not enough data" });
    }

    const phien = data[0].session + 1;

    const A = vipOnDinhPro(data);
    const B = patternCompareEngine(data);

    // nếu 1 trong 2 NO_BET → BỎ
    if (A.du_doan === "NO_BET" || B.du_doan === "NO_BET") {
      return res.json({
        phien,
        du_doan: "NO_BET",
        ly_do: A.ly_do || B.ly_do
      });
    }

    // nếu 2 engine khác nhau → BỎ
    if (A.du_doan !== B.du_doan) {
      return res.json({
        phien,
        du_doan: "NO_BET",
        ly_do: "2 engine không đồng thuận"
      });
    }

    // đồng thuận → OK
    const do_tin_cay =
      Math.min(Math.max(((A.base + B.base) / 2) * 100, 65), 80).toFixed(0) + "%";

    res.json({
      phien,
      du_doan: A.du_doan,
      chuoi_cau: A.chuoi_cau,
      do_tin_cay
    });

  } catch (err) {
    res.status(500).json({ error: "Predict API error" });
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔥 VIP ỔN ĐỊNH PRO + PATTERN ENGINE running on port", PORT);
});
