@echo off
echo ========================================
echo   ПЕРЕЗАПУСК BACKEND СЕРВЕРА
echo ========================================
echo.
echo Останавливаем старый процесс на порту 5000...
echo.

REM Находим и убиваем процесс на порту 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo Найден процесс: %%a
    taskkill /F /PID %%a
)

echo.
echo Ждем 2 секунды...
timeout /t 2 /nobreak > nul

echo.
echo Запускаем backend сервер заново...
echo.
echo ========================================
echo   Backend запущен!
echo   URL: http://localhost:5000
echo ========================================
echo.
echo НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!
echo.

python app.py
pause
