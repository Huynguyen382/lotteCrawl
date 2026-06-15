@echo off
chcp 65001 > nul
echo ============================================================
echo   ĐỒNG BỘ CƠ SỞ DỮ LIỆU LOCAL CACHE.JSON LÊN RENDER POSTGRES
echo ============================================================
echo.
echo Bước 1: Truy cập Render Dashboard (https://dashboard.render.com)
echo Bước 2: Chọn cơ sở dữ liệu "vietlott-db" của bạn.
echo Bước 3: Tìm mục "Connection" và sao chép "External Database URL".
echo.
set /p RENDER_URL="Nhập External Database URL của Render: "

if "%RENDER_URL%"=="" (
    echo.
    echo ❌ Lỗi: Bạn chưa nhập URL. Hủy bỏ quá trình đồng bộ.
    pause
    exit /b
)

echo.
echo ⏳ Đang kết nối và đồng bộ lên Render...
set DATABASE_URL=%RENDER_URL%
node sync_to_db.js
echo.
pause
