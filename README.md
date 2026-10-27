# FlowQ

Гибкая система виртуальных очередей с чатом, обменом местами и приоритетами.

## Запуск

Нужны Node.js и Go

**1. Backend** (http://localhost:8080)

```bash
cd backend
docker compose up -d
go run .
```

**2. Frontend** (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

## Страницы

| Адрес           | Страница           |
| --------------- | ------------------ |
| `/`             | Главная            |
| `/create-queue` | Создание очереди   |
| `/queue/:id`    | Экран участника    |
| `/admin/:id`    | Экран организатора |
