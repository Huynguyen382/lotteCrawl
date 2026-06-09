// Ưu tiên đọc từ environment variable được inject lúc build (Vite)
// Trên Render: set VITE_BACKEND_URL = https://vietlott-backend-ptzh.onrender.com
// Local: tạo file frontend/.env với VITE_BACKEND_URL=http://localhost:5500

const ENV_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const FALLBACK = import.meta.env.DEV
  ? 'http://localhost:5500'
  : 'https://vietlott-backend-ptzh.onrender.com';

const raw = ENV_BACKEND_URL || FALLBACK;

// Xóa dấu / ở cuối nếu có, tránh tạo ra URL dạng https://host//api/...
export const API_BASE = raw.replace(/\/+$/, '');
