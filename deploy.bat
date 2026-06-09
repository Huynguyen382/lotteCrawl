@echo off
echo ========================================
echo   HƯỚNG DẪN DEPLOY VIETLOTT SCRAPER
echo ========================================
echo.

echo 1. ĐẨY CODE LÊN GITHUB
echo    a) Tạo repository trên GitHub
echo    b) Chạy các lệnh sau:
echo.
echo    git init
echo    git add .
echo    git commit -m "Initial commit"
echo    git branch -M main
echo    git remote add origin https://github.com/[username]/[repository].git
echo    git push -u origin main
echo.

echo 2. DEPLOY LÊN RENDER.COM
echo    a) Đăng ký tại: https://render.com
echo    b) Vào Dashboard -> New -> Web Service
echo    c) Kết nối với GitHub repository của bạn
echo    d) Render sẽ tự động nhận diện render.yaml
echo    e) Nhấn "Create Web Service"
echo.

echo 3. SAU KHI DEPLOY
echo    Frontend sẽ có tại: https://[tên-project]-frontend.onrender.com
echo    Backend API sẽ có tại: https://[tên-project]-backend.onrender.com
echo.

echo Lưu ý: Với tài khoản miễn phí, app sẽ sleep sau 15 phút không dùng
echo nhưng sẽ tự động wake up khi có request.
echo.

pause