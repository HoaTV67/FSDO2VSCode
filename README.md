# FSDO2VSCode

**FSDO2VSCode** là một module trong dự án **AutoSiteX**, hỗ trợ tự động hóa thao tác xử lý file XML và các công việc lặp đi lặp lại trong môi trường FAST Business Online (FBO).

## 🎯 Mục tiêu

Tối ưu hoá thao tác XML trong FBO: hiển thị cấu trúc cây, điều hướng nhanh, tự động gợi ý, và kiểm tra lỗi – phục vụ cho các developer khi làm việc với hệ thống ERP FBO.

## 🚀 Tính năng hiện tại (module `<dir>`)

- 📂 **Sitemap cho file `<dir>`**: hiển thị toàn bộ cấu trúc `<fields>`, `<views>`, `<commands>`, `<script>`, `<response>` dạng TreeView
- 🧠 **Detect hàm trong `<script>`**: trích xuất toàn bộ `function ...()` và cho phép nhảy nhanh đến hàm
- 🔍 **Highlight các function đặc biệt**: như `ExecuteCommand`, `ResponseComplete`, `CheckValid`,...

## 🔜 Kế hoạch mở rộng

### ✅ Kết nối với các module khác trong AutoSiteX


## 📂 Tích hợp dự án AutoSiteX

FSDO2VSCode sẽ là một **module chính** trong AutoSiteX bên cạnh:

- AutoHotkey / Puppeteer Automation
- Trình bắt lỗi SQL Client
- Logger thao tác & phân tích UR tự động

---

© 2025 AutoSiteX Team
