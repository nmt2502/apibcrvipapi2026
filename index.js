const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const SOURCE_API = 'https://bcrapj-9ska.onrender.com/sexy/all';

// =======================
// UTILS
// =======================
function normalizeKetQua(ket_qua) {
  return ket_qua.replace(/T/g, '');
}

// ================== 10G1 ==================
function duDoan10g1(ket_qua) {
  const clean = ket_qua.replace(/[^PB]/g, '');
  const last10 = clean.slice(-10);
  let P = 0, B = 0;
  for (const c of last10) {
    if (c === 'P') P++;
    if (c === 'B') B++;
  }
  if (P > B) return 'P';
  if (B > P) return 'B';
  return last10.slice(-1) || null;
}

// ================== NHẬN DIỆN CẦU 10G ==================
function phatHienCau10G(ket_qua) {
  const clean = ket_qua.replace(/[^PB]/g, '');
  const last10 = clean.slice(-10);
  if (last10.length < 4) return { loaiCau: 'Chưa đủ dữ liệu', du_doan: null };

  // Cầu bệt
  if (last10.slice(-3).split('').every(v => v === last10.slice(-1))) {
    return {
      loaiCau: `Cầu bệt ${last10.slice(-1) === 'P' ? 'Con' : 'Cái'}`,
      du_doan: last10.slice(-1)
    };
  }

  // Cầu 1-1
  const last4 = last10.slice(-4);
  if (/^(PB){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'P' };
  if (/^(BP){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'B' };

  // Cầu nghiêng
  const P = (last10.match(/P/g) || []).length;
  const B = (last10.match(/B/g) || []).length;
  if (P >= B + 4) return { loaiCau: 'Cầu nghiêng Con', du_doan: 'P' };
  if (B >= P + 4) return { loaiCau: 'Cầu nghiêng Cái', du_doan: 'B' };

  return { loaiCau: 'Không rõ', du_doan: null };
}

// =======================
// ANALYZE
// =======================
function analyzeCau(rawKetQua) {
  const ket_qua = normalizeKetQua(rawKetQua);
  const arr = ket_qua.split('');
  const len = arr.length;
  if (len < 3) return { cau: 'Chờ cầu đẹp', Du_Doan: null, Do_Tin_Cay: 0 };
  const last = arr[len - 1];

  // ==== Cầu bệt ====
  let count = 1;
  for (let i = len - 1; i > 0; i--) {
    if (arr[i] === arr[i - 1]) count++;
    else break;
  }
  if (count >= 3) {
    let tc = 65;
    if (count >= 4) tc = 75;
    if (count >= 5) tc = 85;
    return {
      cau: `${count} bệt ${last === 'P' ? 'Con' : 'Cái'}`,
      Du_Doan: last,
      Do_Tin_Cay: tc
    };
  }

  // ==== Cầu 1-1 ====
  let is11 = true;
  for (let i = len - 6; i < len - 1; i++) {
    if (arr[i] === arr[i + 1]) { is11 = false; break; }
  }
  if (is11) return { cau: 'Cầu 1-1', Du_Doan: last === 'P' ? 'B' : 'P', Do_Tin_Cay: 70 };

  // ==== Cầu 1-2 ====
  const tail6 = arr.slice(-6).join('');
  if (tail6 === 'PBBPBB' || tail6 === 'BPPBPP') return { cau: 'Cầu 1-2', Du_Doan: arr[len - 3], Do_Tin_Cay: 72 };

  // ==== Cầu 1-3 ====
  const tail9 = arr.slice(-9).join('');
  if (tail9 === 'PBBBPBBBP' || tail9 === 'BPPPBPPPB') return { cau: 'Cầu 1-3', Du_Doan: arr[len - 4], Do_Tin_Cay: 74 };

  // ==== Cầu nghiêng ====
  const recent = arr.slice(-10);
  let stat = { P: 0, B: 0 };
  recent.forEach(x => stat[x]++);
  if (Math.abs(stat.P - stat.B) >= 3) {
    const side = stat.P > stat.B ? 'P' : 'B';
    return { cau: `Cầu nghiêng ${side === 'P' ? 'Con' : 'Cái'}`, Du_Doan: side, Do_Tin_Cay: 68 };
  }

  // ==== 10G1 ====
  const du10 = duDoan10g1(rawKetQua);
  const cau10 = phatHienCau10G(rawKetQua);
  if (cau10.du_doan) {
    let tin_cay = 70;
    if (du10 && du10 === cau10.du_doan) tin_cay += 8;
    const kq20 = analyze20G1(rawKetQua);
    if (kq20.Du_Doan === cau10.du_doan) tin_cay += 10;
    return { cau: `${cau10.loaiCau} + 10G1`, Du_Doan: cau10.du_doan, Do_Tin_Cay: Math.min(tin_cay, 95) };
  }

  // ==== FALLBACK 10G1 ====
  if (du10) return { cau: '10G1', Du_Doan: du10, Do_Tin_Cay: 65 };

  return { cau: 'Chờ cầu đẹp', Du_Doan: null, Do_Tin_Cay: 0 };
}

// =======================
// API FULL BÀN
// =======================
app.get('/bcr/predict/all', async (req, res) => {
  try {
    const { data } = await axios.get(SOURCE_API, { timeout: 7000 });
    if (!Array.isArray(data)) return res.json({ loi: 'API gốc không trả danh sách bàn' });

    const result = [];
    for (let i = 1; i <= 16; i++) {
      const banCode = `C${i.toString().padStart(2, '0')}`;
      const banData = data.find(x => x.ban === banCode);
      if (!banData || !banData.ket_qua) {
        result.push({ ban: banCode, cau: 'Không có dữ liệu', ket_qua: '', Du_Doan: null, Do_Tin_Cay: 0 });
        continue;
      }
      const r = analyzeCau(banData.ket_qua);
      result.push({ ban: banCode, cau: r.cau, ket_qua: banData.ket_qua, Du_Doan: r.Du_Doan, Do_Tin_Cay: r.Do_Tin_Cay });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ loi: 'Lỗi lấy API gốc', chi_tiet: err.message });
  }
});

// =======================
// START
// =======================
app.get('/', (req, res) => res.send('✅ BCR API is running'));
app.listen(PORT, () => console.log(`BCR VIP http://localhost:${PORT}`));
