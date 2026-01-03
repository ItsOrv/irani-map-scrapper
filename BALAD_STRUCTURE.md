# ساختار سایت بلد و نشان

## بررسی انجام شده

بر اساس بررسی HTML و ساختار سایت balad.ir:

### ساختار کلی
- سایت از **Next.js** استفاده می‌کند
- داده‌ها در تگ `<script id="__NEXT_DATA__">` قرار دارند
- ساختار React با Server-Side Rendering

### ساختار داده‌ها

#### 1. Next.js Data Structure
```javascript
{
  props: {
    pageProps: {
      data: {
        widgets: [
          {
            type: "horizontal_list",
            data: {
              items: [
                {
                  name: "نام کسب‌وکار",
                  category: "دسته‌بندی",
                  centerPoint: { coordinates: [lon, lat] },
                  urlTitle: "url-slug",
                  rating: { score: 4.5, count: 100 }
                }
              ]
            }
          }
        ]
      }
    }
  }
}
```

#### 2. DOM Structure
- کلاس‌های CSS با BEM-like naming: `ComponentName_element__hash`
- مثال: `PoiItem_container__3Rj7u`, `Button_button__NTtqi`
- استفاده از CSS Modules

### Selectorهای به‌روزرسانی شده

#### برای استخراج داده:
1. **اولویت اول**: استخراج از `__NEXT_DATA__` script tag
2. **اولویت دوم**: استخراج از DOM با selectorهای عمومی

#### Selectorهای DOM:
- `a[href*="/poi/"]` - لینک‌های کسب‌وکارها
- `[class*="PoiItem"]` - آیتم‌های POI
- `[class*="business"]` - کسب‌وکارها
- `h2, h3, h4` - عناوین

### Pagination
- استفاده از `aria-label` با متن فارسی "بعدی"
- ممکن است از infinite scroll استفاده شود
- دکمه‌های pagination با کلاس‌های خاص

### نکات مهم

1. **داده‌های کامل**: اطلاعات کامل‌تر در JSON موجود است تا DOM
2. **Phone و Email**: در ساختار JSON موجود نیست، باید از صفحه جزئیات استخراج شود
3. **Dynamic Loading**: محتوا با React رندر می‌شود، نیاز به wait برای render
4. **Infinite Scroll**: ممکن است از scroll برای load بیشتر استفاده شود

### بهبودهای اعمال شده

1. ✅ استخراج از `__NEXT_DATA__` اضافه شد
2. ✅ Selectorهای DOM به‌روزرسانی شدند
3. ✅ پشتیبانی از infinite scroll
4. ✅ Wait time برای React render افزایش یافت
5. ✅ Fallback به DOM scraping اگر JSON موجود نباشد

### نیاز به بررسی بیشتر

برای استخراج کامل اطلاعات (phone, email):
- باید به صفحه جزئیات هر کسب‌وکار برویم
- یا از API داخلی سایت استفاده کنیم (نیاز به بررسی Network tab)

