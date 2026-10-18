# FlowQ

Гибкая система виртуальных очередей с чатом, обменом местами и приоритетами.



## Запуск

Нужны Node.js и Go

**1. Backend** (http://localhost:8080)

```bash
cd backend
go run .
```

**2. Frontend** (http://localhost:5173)

```bash
cd frontend
npm run dev
```

## Структура проекта

```
flowq/
├── backend/                  # Go-сервер
├── frontend/                 # Vue-приложение
│   ├── public/               # статика
│   └── src/
│       ├── assets/           # глобальные стили
│       ├── components/       # переиспользуемые компоненты
│       ├── router/           # маршруты
│       ├── views/            # страницы
│       ├── App.vue           # корневой компонент
│       └── main.js           # точка входа
└── README.md
```

## Страницы

| Адрес           | Страница           |
| --------------- | ------------------ |
| `/`             | Главная            |
| `/create-queue` | Создание очереди   |
| `/queue/:id`    | Экран участника    |
| `/admin/:id`    | Экран организатора |
