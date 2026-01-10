import express from "express";
import axios from "axios";

const app = express();

const HISTORY_API = "https://sunwin-ai-bot.onrender.com/api/taixiu/history";

app.get("/api/taixiu/predict", async (req, res) => {
  try {
    const { data } = await axios.get(HISTORY_API);

    const N = 50;
    const last = data.slice(-N);

    let tai = 0, xiu = 0;
    last.forEach(i => {
      if (i.result === "tai") tai++;
      if (i.result === "xiu") xiu++;
    });

    const probTai = tai / N;
    const probXiu = xiu / N;

    const result = probTai >= probXiu ? "TAI" : "XIU";

    res.json({
      status: "success",
      source: "sunwin-ai-bot",
      algorithm: "Hybrid Probability 2026",
      history_used: N,
      statistics: {
        tai,
        xiu,
        prob_tai: +probTai.toFixed(2),
        prob_xiu: +probXiu.toFixed(2)
      },
      prediction: {
        result,
        confidence: `${Math.max(probTai, probXiu) * 100 | 0}%`,
        trend: result === "TAI" ? "TAI_DANG_LEN" : "XIU_DANG_LEN"
      },
      timestamp: Math.floor(Date.now() / 1000)
    });

  } catch (err) {
    res.status(500).json({ status: "error", message: "API error" });
  }
});

app.listen(3000, () => console.log("Predict API running"));
