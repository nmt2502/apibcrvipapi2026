const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const banList = Array.from({ length: 16 }, (_, i) =>
  `C${(i + 1).toString().padStart(2, '0')}`
);

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

// ================== NHẬN DIỆN CẦU + DỰ ĐOÁN BẺ ==================
function phatHienCauBe(ket_qua) {
  const clean = ket_qua.replace(/[^PB]/g, '');
  const arr = clean.split('');
  const len = arr.length;

  if (len < 4) return {
    loaiCau: 'Chưa đủ dữ liệu',
    du_doan: 'Cầu Xấu',
    Do_Tin_Cay: 50,
    thoi_diem_bat_dau_du_doan: null
  };

  let loaiCau = 'Không rõ';
  let du_doan = null;
  let Do_Tin_Cay = 50;
  let thoi_diem_bat_dau_du_doan = null;

  // Duyệt từ đầu đến cuối
  for (let i = 0; i < len; i++) {
    const tail = arr.slice(i).join('');

    // ===== CẦU BỆT =====
    let count = 1;
    for (let j = i + 1; j < len; j++) {
      if (arr[j] === arr[i]) count++;
      else break;
    }
    if (count >= 3) {
      loaiCau = `Cầu bệt ${arr[i] === 'P' ? 'Con' : 'Cái'}`;
      du_doan = arr[i];
      Do_Tin_Cay = Math.min(50 + (count - 3) * 10, 92);
      thoi_diem_bat_dau_du_doan = i;

      // Dự đoán bẻ cầu: nếu bệt ≥ 6
      if (count >= 6) du_doan += ' (Bẻ cầu)';
      break;
    }

    // ===== CẦU 1-1 =====
    const last4 = arr.slice(Math.max(len - 4, 0)).join('');
    if (/^(PB){2}$/.test(last4)) { loaiCau = 'Cầu 1-1'; du_doan = 'P'; Do_Tin_Cay = 70; thoi_diem_bat_dau_du_doan = len-4; break; }
    if (/^(BP){2}$/.test(last4)) { loaiCau = 'Cầu 1-1'; du_doan = 'B'; Do_Tin_Cay = 70; thoi_diem_bat_dau_du_doan = len-4; break; }

    // ===== CẦU 1-2 / 1-3 =====
    const tail6 = arr.slice(-6).join('');
    if (tail6 === 'PBBPBB') { loaiCau = 'Cầu 1-2'; du_doan = 'B'; Do_Tin_Cay = 72; thoi_diem_bat_dau_du_doan = len-6; break; }
    if (tail6 === 'BPPBPP') { loaiCau = 'Cầu 1-2'; du_doan = 'P'; Do_Tin_Cay = 72; thoi_diem_bat_dau_du_doan = len-6; break; }

    const tail9 = arr.slice(-9).join('');
    if (tail9 === 'PBBBPBBBP') { loaiCau = 'Cầu 1-3'; du_doan = 'B'; Do_Tin_Cay = 74; thoi_diem_bat_dau_du_doan = len-9; break; }
    if (tail9 === 'BPPPBPPPB') { loaiCau = 'Cầu 1-3'; du_doan = 'P'; Do_Tin_Cay = 74; thoi_diem_bat_dau_du_doan = len-9; break; }

    // ===== CẦU DÍNH KÉP =====
    if (/PPBBPBB|BBPPBPP/.test(tail)) { loaiCau = 'Cầu dính kép'; du_doan = arr[len - 1]; Do_Tin_Cay = 85; thoi_diem_bat_dau_du_doan = i; break; }

    // ===== CẦU DÍNH CON / DÍNH CÁI DÀI =====
    const matchCon = tail.match(/(PB){3,}/);
    if (matchCon) { loaiCau = 'Cầu dính Con'; du_doan = 'P'; Do_Tin_Cay = Math.min(75 + (matchCon[0].length/2 - 3)*5, 92); thoi_diem_bat_dau_du_doan = i;
      if (matchCon[0].length/2 >= 6) du_doan += ' (Bẻ cầu)';
      break;
    }
    const matchCai = tail.match(/(BP){3,}/);
    if (matchCai) { loaiCau = 'Cầu dính Cái'; du_doan = 'B'; Do_Tin_Cay = Math.min(75 + (matchCai[0].length/2 - 3)*5, 92); thoi_diem_bat_dau_du_doan = i;
      if (matchCai[0].length/2 >= 6) du_doan += ' (Bẻ cầu)';
      break;
    }

    // ===== CẦU NGHIÊNG =====
    const Pcount = (tail.match(/P/g) || []).length;
    const Bcount = (tail.match(/B/g) || []).length;
    if (Pcount >= Bcount + 4) { loaiCau = 'Cầu nghiêng Con'; du_doan = 'P'; Do_Tin_Cay = 68; thoi_diem_bat_dau_du_doan = i; break; }
    if (Bcount >= Pcount + 4) { loaiCau = 'Cầu nghiêng Cái'; du_doan = 'B'; Do_Tin_Cay = 68; thoi_diem_bat_dau_du_doan = i; break; }

    // ===== PATTERN 232,123,124 =====
    const tail10 = arr.slice(-10).join('');
    if (/PBBPBBPBBP|BPBPBPBPBP/.test(tail10)) { loaiCau = 'Cầu 232'; du_doan = arr[len - 1]; Do_Tin_Cay = 85; thoi_diem_bat_dau_du_doan = len-10; break; }
    if (/PBBPPBBPPB|BPBPPBPBPP/.test(tail10)) { loaiCau = 'Cầu 123'; du_doan = arr[len - 1]; Do_Tin_Cay = 82; thoi_diem_bat_dau_du_doan = len-10; break; }
    if (/PBBPBBPPBP|BPBPBPPBPB/.test(tail10)) { loaiCau = 'Cầu 124'; du_doan = arr[len - 1]; Do_Tin_Cay = 82; thoi_diem_bat_dau_du_doan = len-10; break; }
  }

  if (!du_doan) {
    du_doan = 'Cầu Xấu';
    loaiCau = 'Chưa đủ dữ liệu';
    Do_Tin_Cay = 50;
    thoi_diem_bat_dau_du_doan = null;
  }

  return { loaiCau, du_doan, Do_Tin_Cay, thoi_diem_bat_dau_du_doan };
}

// ================== FETCH API GỐC + CACHE ==================
let cache = null;
let lastFetch = 0;
async function fetchAll() {
  if (cache && Date.now() - lastFetch < 3000) return cache;
  try {
    const res = await axios.get('https://apibcrvipapi2026.onrender.com/bcr/predict/all', { timeout: 7000 });
    cache = res.data;
    lastFetch = Date.now();
  } catch (err) {
    console.error('❌ Lỗi fetch API gốc:', err.message);
    cache = [];
  }
  return cache;
}

function normalizeBanId(str = '') {
  return str.toUpperCase().replace(/O/g, '0').replace(/\s+/g, '').trim();
}

async function getFullBan() {
  const all = await fetchAll();
  const result = {};

  for (const banId of banList) {
    const raw = all.find(item => normalizeBanId(item.ban) === banId);

    if (!raw) {
      result[banId] = {
        ban: banId,
        trang_thai: 'Không có dữ liệu',
        ket_qua: '',
        cau_api: null,
        loai_cau: null,
        du_doan: 'Cầu Xấu',
        Do_Tin_Cay: 50,
        thoi_diem_bat_dau_du_doan: null,
        cap_nhat: null
      };
      continue;
    }

    const ket_qua = raw.ket_qua || '';
    const cauApi = raw.cau || null;
    const cau = phatHienCauBe(ket_qua);

    result[banId] = {
      ban: banId,
      ket_qua,
      cau_api: cauApi,
      loai_cau: cau.loaiCau,
      du_doan: cau.du_doan,
      Do_Tin_Cay: cau.Do_Tin_Cay,
      thoi_diem_bat_dau_du_doan: cau.thoi_diem_bat_dau_du_doan,
      cap_nhat: raw.time || null
    };
  }

  return result;
}

// ================== API FULL BÀN ==================
app.get('/api/ban', async (req, res) => {
  const data = await getFullBan();
  res.json(data);
});

app.get('/', (req, res) => res.send('✅ BCR API FULL C01–C16 với dự đoán bẻ cầu + Do_Tin_Cay 50–92%'));

app.listen(port, () => {
  console.log(`🚀 BCR API FULL C01–C16 chạy tại port ${port}`);
});
