// Ưu tiên đọc từ environment variable được inject lúc build (Vite)
// Trên Render: set VITE_BACKEND_URL = https://vietlott-backend-ptzh.onrender.com
// Local: tạo file frontend/.env với VITE_BACKEND_URL=http://localhost:5500

const ENV_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Nếu không có env var -> dựa vào URL hiện tại để đoán môi trường
const isDevelopment = import.meta.env.MODE === 'development';
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Fallback production nếu trên Render không phải localhost
const FALLBACK = isDevelopment || isLocalhost
  ? 'http://localhost:5500'
  : 'https://vietlott-backend-ptzh.onrender.com';

if (!ENV_BACKEND_URL) {
  console.warn(
    `[config] VITE_BACKEND_URL chưa được set! Dùng fallback: ${FALLBACK} ` +
    `(mode: ${import.meta.env.MODE}, hostname: ${window.location.hostname}, isLocalhost: ${isLocalhost})`
  );
}

console.log(`[config] API_BASE = ${ENV_BACKEND_URL || FALLBACK}`);

const raw = ENV_BACKEND_URL || FALLBACK;
// Xóa dấu / ở cuối nếu có, tránh tạo ra URL dạng https://host//api/...
export const API_BASE = raw.replace(/\/+$/, '');
