#!/bin/bash

echo "=========================================="
echo "بررسی آماده بودن افزونه برای Chrome"
echo "=========================================="
echo ""

# بررسی وجود Chrome
if command -v google-chrome &> /dev/null; then
    echo "✓ Google Chrome پیدا شد"
    CHROME_CMD="google-chrome"
elif command -v chromium &> /dev/null; then
    echo "✓ Chromium پیدا شد"
    CHROME_CMD="chromium"
elif command -v chromium-browser &> /dev/null; then
    echo "✓ Chromium Browser پیدا شد"
    CHROME_CMD="chromium-browser"
else
    echo "⚠ Chrome/Chromium در PATH پیدا نشد"
    echo "  اما می‌توانید به صورت دستی load کنید"
    CHROME_CMD=""
fi

echo ""
echo "=========================================="
echo "مسیر پروژه:"
echo "$(pwd)"
echo ""
echo "برای load کردن در Chrome:"
echo "1. chrome://extensions/ را باز کنید"
echo "2. Developer mode را فعال کنید"
echo "3. Load unpacked را بزنید"
echo "4. این مسیر را انتخاب کنید:"
echo "   $(pwd)"
echo "=========================================="

if [ -n "$CHROME_CMD" ]; then
    echo ""
    read -p "آیا می‌خواهید Chrome را با صفحه extensions باز کنم? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $CHROME_CMD chrome://extensions/ 2>/dev/null &
        echo "Chrome در حال باز شدن..."
    fi
fi

