// Đọc từ environment variable được inject lúc build
// Trên Render: set VITE_BACKEND_URL = https://vietlott-backend-ptzh.onrender.com
// Local: tạo file .env với VITE_BACKEND_URL=http://localhost:5500
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_URL) {
  console.warn(
    '[config] VITE_BACKEND_URL chưa được set! ' +
    'Tạo file frontend/.env với nội dung: VITE_BACKEND_URL=http://localhost:5500'
  );
}

export const API_BASE = BACKEND_URL || 'http://localhost:5500';
