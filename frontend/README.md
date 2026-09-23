# Frontend — TimViecPartTime

React + TypeScript (Vite) + TailwindCSS. Không nằm trong docker-compose; production deploy dạng static site trên Render.

```
npm ci
npm run dev     # http://localhost:5173, gọi backend ở VITE_API_URL (mặc định http://localhost:8000)
npm run lint
npm run build   # ra dist/
```

Biến `VITE_API_URL` được đọc lúc build. Trên Render cần thêm rule Rewrite `/*` → `/index.html` để tải lại trang con không bị 404.

Tổng quan dự án, lệnh backend/AI service: xem `../CLAUDE.md`.
