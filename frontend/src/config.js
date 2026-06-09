// Ưu tiên đọc từ environment variable được inject lúc build (Vite)
// Trên Render: set VITE_BACKEND_URL = https://vietlott-backend-ptzh.onrender.com
// Local: tạo file frontend/.env với VITE_BACKEND_URL=http://localhost:5500

const ENV_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Nếu không có env var:
//   - Môi trường dev (localhost) → dùng localhost:5500
//   - Môi trường production (HTTPS) → dùng URL backend trên Render
const FALLBACK = import.meta.env.DEV
  ? 'http://localhost:5500'
  : 'https://vietlott-backend-ptzh.onrender.com';

if (!ENV_BACKEND_URL) {
  console.warn(
    `[config] VITE_BACKEND_URL chưa được set! Dùng fallback: ${FALLBACK}`
  );
}

export const API_BASE = ENV_BACKEND_URL || FALLBACK;
