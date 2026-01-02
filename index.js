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

// ================== NHẬN DIỆN CẦU ĐẶC BIỆT + ĐỘ TIN CẬY ==================
function phatHienCau(ket_qua) {
  const clean = ket_qua.replace(/[^PB]/g, '');
  const arr = clean.split('');
  const last10 = arr.slice(-10).join('');

  if (last10.length < 4) return { loaiCau: 'Chưa đủ dữ liệu', du_doan: null, Do_Tin_Cay: 0 };

  // ===== CẦU BỆT =====
  const countBhet = arr.slice(-5).reverse().findIndex((v, i) => i > 0 && v !== arr[arr.length - 1]);
  if (countBhet >= 2) return { loaiCau: `Cầu bệt ${arr[arr.length - 1] === 'P' ? 'Con' : 'Cái'}`, du_doan: arr[arr.length - 1], Do_Tin_Cay: 85 };

  // ===== CẦU 1-1 =====
  if (/^(PB){2}$/.test(last10.slice(-4))) return { loaiCau: 'Cầu 1-1', du_doan: 'P', Do_Tin_Cay: 70 };
  if (/^(BP){2}$/.test(last10.slice(-4))) return { loaiCau: 'Cầu 1-1', du_doan: 'B', Do_Tin_Cay: 70 };

  // ===== CẦU 1-2 =====
  const tail6 = last10.slice(-6);
  if (tail6 === 'PBBPBB') return { loaiCau: 'Cầu 1-2', du_doan: 'B', Do_Tin_Cay: 72 };
  if (tail6 === 'BPPBPP') return { loaiCau: 'Cầu 1-2', du_doan: 'P', Do_Tin_Cay: 72 };

  // ===== CẦU 1-3 =====
  const tail9 = last10.slice(-9);
  if (tail9 === 'PBBBPBBBP') return { loaiCau: 'Cầu 1-3', du_doan: 'B', Do_Tin_Cay: 74 };
  if (tail9 === 'BPPPBPPPB') return { loaiCau: 'Cầu 1-3', du_doan: 'P', Do_Tin_Cay: 74 };

  // ===== CẦU DÍNH KÉP (ví dụ 2-3-4-2-2) =====
  if (/PPBBPBB|BBPPBPP/.test(last10)) return { loaiCau: 'Cầu dính kép', du_doan: arr[arr.length - 1], Do_Tin_Cay: 80 };

  // ===== CẦU NGHIÊNG =====
  const Pcount = (last10.match(/P/g) || []).length;
  const Bcount = (last10.match(/B/g) || []).length;
  if (Pcount >= Bcount + 4) return { loaiCau: 'Cầu nghiêng Con', du_doan: 'P', Do_Tin_Cay: 68 };
  if (Bcount >= Pcount + 4) return { loaiCau: 'Cầu nghiêng Cái', du_doan: 'B', Do_Tin_Cay: 68 };

  // ===== Mặc định =====
  return { loaiCau: 'Không rõ', du_doan: null, Do_Tin_Cay: 0 };
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

// ================== ROOT ==================
app.get('/', (req, res) => res.send('✅ BCR API FULL BÀN chạy với Do_Tin_Cay và cầu đặc biệt'));

// ================== START ==================
app.listen(port, () => {
  console.log(`🚀 BCR API FULL C01–C16 chạy tại port ${port}`);
});
