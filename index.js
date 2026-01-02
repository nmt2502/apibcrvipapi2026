const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Danh sách bàn C01 → C16
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

// ================== NHẬN DIỆN CẦU + ĐỘ TIN CẬY ==================
function phatHienCau(ket_qua) {
  const clean = ket_qua.replace(/[^PB]/g, '');
  const last10 = clean.slice(-10);

  if (last10.length < 4) return { loaiCau: 'Chưa đủ dữ liệu', du_doan: null, Do_Tin_Cay: 0 };

  // Cầu bệt
  if (last10.slice(-3).split('').every(v => v === last10.slice(-1))) {
    return { loaiCau: 'Cầu bệt', du_doan: last10.slice(-1), Do_Tin_Cay: 85 };
  }

  // Cầu 1-1
  const last4 = last10.slice(-4);
  if (/^(PB){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'P', Do_Tin_Cay: 70 };
  if (/^(BP){2}$/.test(last4)) return { loaiCau: 'Cầu 1-1', du_doan: 'B', Do_Tin_Cay: 70 };

  // Cầu nghiêng
  const P = (last10.match(/P/g) || []).length;
  const B = (last10.match(/B/g) || []).length;
  if (P >= B + 4) return { loaiCau: 'Cầu nghiêng Con', du_doan: 'P', Do_Tin_Cay: 68 };
  if (B >= P + 4) return { loaiCau: 'Cầu nghiêng Cái', du_doan: 'B', Do_Tin_Cay: 68 };

  return { loaiCau: 'Không rõ', du_doan: null, Do_Tin_Cay: 0 };
}

// ================== FETCH API GỐC + CACHE ==================
let cache = null;
let lastFetch = 0;

async function fetchAll() {
  if (cache && Date.now() - lastFetch < 3000) return cache; // cache 3 giây
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

// ================== CHUẨN HÓA TÊN BÀN ==================
function normalizeBanId(str = '') {
  return str.toUpperCase().replace(/O/g, '0').replace(/\s+/g, '').trim();
}

// ================== LẤY FULL BÀN ==================
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
        du_doan: null,
        Do_Tin_Cay: 0,
        cap_nhat: null
      };
      continue;
    }

    const ket_qua = raw.ket_qua || '';
    const cauApi = raw.cau || null;
    const du10g1 = duDoan10g1(ket_qua);
    const cau = phatHienCau(ket_qua);

    result[banId] = {
      ban: banId,
      ket_qua,
      cau_api: cauApi,
      loai_cau: cau.loaiCau,
      du_doan: cau.du_doan || du10g1,
      Do_Tin_Cay: cau.Do_Tin_Cay,
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

// ================== ROOT TEST ==================
app.get('/', (req, res) => res.send('✅ BCR API FULL BÀN chạy với Do_Tin_Cay'));

// ================== START ==================
app.listen(port, () => {
  console.log(`🚀 BCR API FULL C01–C16 chạy tại port ${port}`);
});
