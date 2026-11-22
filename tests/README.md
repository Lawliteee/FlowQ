# Руководство по тестированию FlowQ

В проекте реализована система автоматизированного тестирования:
- **Модульные тесты** (`tests/module/`) — быстрая проверка бизнес-логики без внешних зависимостей.
- **Интеграционные тесты** (`tests/integration/`) — проверка REST API и WebSocket-соединений реального бэкенда.
- **End-to-End тесты** (`tests/e2e/`) — сквозное тестирование интерфейса пользователя в реальном браузере через Playwright.
- **Нагрузочные тесты** (`tests/load/`) — стресс-тестирование, проверка конкурентности и целостности данных при помощи k6.

---

## 1. Модульные тесты (`tests/module/`)

Автономные тесты чистой бизнес-логики (60 тестов в 9 файлах).  
Не требуют запущенного бэкенда, базы данных или сети. Работают на встроенном тест-раннере Node.js (`node:test`).

### Запуск всех модульных тестов
Выполняется из корня проекта:
```bash
node --test tests/module/*.test.js
```

### Запуск отдельного набора тестов
```bash
node --test tests/module/01_cookies.test.js
node --test tests/module/02_auth.test.js
node --test tests/module/03_queue_logic.test.js
node --test tests/module/04_validation.test.js
node --test tests/module/05_swap_and_skip.test.js
node --test tests/module/06_analytics_and_helpers.test.js
node --test tests/module/07_edge_cases_queue.test.js
node --test tests/module/08_edge_cases_auth_and_chat.test.js
node --test tests/module/09_priority_queue.test.js
```

---

## 2. Интеграционные тесты (`tests/integration/`)

Проверка корректности работы HTTP REST API и WebSocket-протокола (25 тестов в 5 файлах).

### Предварительные требования
- Бэкенд FlowQ должен быть запущен и доступен по адресу `http://localhost:8080`.
- База данных PostgreSQL должна быть запущена и инициализирована миграциями.

### Запуск всех интеграционных тестов
Выполняется из корня проекта:
```bash
node --test tests/integration/*.test.js
```

### Запуск отдельного набора тестов
```bash
node --test tests/integration/01_auth_api.test.js
node --test tests/integration/02_queue_lifecycle_api.test.js
node --test tests/integration/03_admin_api.test.js
node --test tests/integration/04_swap_and_skip_api.test.js
node --test tests/integration/05_websocket_api.test.js
```

---

## 3. End-to-End (E2E) тесты (`tests/e2e/`)

Сквозные пользовательские тесты в реальном браузере через Playwright (12 тестов в 3 файлах):
- Навигация по страницам, карточки ролей, открытие/переключение модальных окон.
- Полный флоу создания очереди организатором и переход в панель управления.
- Реалтайм-синхронизация между двумя вкладками (вызов следующего участника, баннер «Ваша очередь!», чат очереди, освобождение места).

### Предварительные требования
1. **Бэкенд** запущен на `http://localhost:8080`.
2. **Фронтенд** запущен на `http://localhost:5173`:
   ```bash
   cd frontend
   npm run dev
   ```

### Запуск тестов
Все команды выполняются из папки `frontend`:

```bash
cd frontend

# Стандартный запуск всех E2E тестов (headless-режим)
npm run test:e2e

# Запуск с отображением окна браузера (headed-режим)
npm run test:e2e -- --headed

# Запуск в интерактивном визуальном интерфейсе Playwright UI
npx playwright test --ui

# Запуск одного конкретного тестового файла
npm run test:e2e -- tests/e2e/01_navigation_and_roles.spec.js
npm run test:e2e -- tests/e2e/02_queue_creation_flow.spec.js
npm run test:e2e -- tests/e2e/03_realtime_queue_flow.spec.js
```

---

## 4. Нагрузочные тесты (`tests/load/`)

Сценарии нагрузочного тестирования, написанные для утилиты **k6**.

### Предварительные требования
- Бэкенд запущен на `http://localhost:8080`.
- Установлена утилита `k6` (версия с поддержкой WebSocket, k6 v0.40+ или v1.x).

---

### Универсальная команда очистки БД (для всех нагрузочных тестов)
Удаляет все тестовые очереди и тестовых пользователей, созданных любым из k6-тестов:

#### Вариант A: Через SQL-клиент (DBeaver, pgAdmin, psql)
```sql
DELETE FROM queues WHERE name LIKE 'k6-%';
DELETE FROM users WHERE email LIKE 'k6-%';
```
*(Все связанные записи в таблицах `participants`, `queue_admins`, `queue_wait_stats` удаляются автоматически благодаря `ON DELETE CASCADE`)*.

#### Вариант B: Через Docker (если база запущена в контейнере `flowq-db`)
```bash
docker exec -i flowq-db psql -U postgres -d flowq -c "DELETE FROM queues WHERE name LIKE 'k6-%'; DELETE FROM users WHERE email LIKE 'k6-%';"
```

#### Вариант C: Через локальный терминал `psql`
```bash
psql -U postgres -d flowq -c "DELETE FROM queues WHERE name LIKE 'k6-%'; DELETE FROM users WHERE email LIKE 'k6-%';"
```

---

## P.S. Гайд по установке необходимых программ

### 1. Node.js (версия 20 LTS или новее)
Используется для запуска модульных (`node:test`), интеграционных и E2E тестов.
- **Windows (через winget):**
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
- **Официальный сайт:** [https://nodejs.org/](https://nodejs.org/) (скачать версию LTS).
- **Проверка версии:**
  ```bash
  node -v   # Должно быть v20.x.x или выше
  npm -v
  ```

---

### 2. Go (версия 1.22 или новее)
Необходим для сборки и запуска бэкенда FlowQ.
- **Windows (через winget):**
  ```powershell
  winget install GoLang.Go
  ```
- **Официальный сайт:** [https://go.dev/dl/](https://go.dev/dl/)
- **Проверка версии:**
  ```bash
  go version
  ```

---

### 3. PostgreSQL и Docker
База данных для работы бэкенда.
- **Вариант 1 (рекомендуемый — Docker Compose):**
  Если установлен [Docker Desktop](https://www.docker.com/products/docker-desktop/):
  ```bash
  cd backend
  docker compose up -d
  ```
  Это автоматически поднимет контейнер `flowq-db` на порту `5432`.
- **Вариант 2 (локальный PostgreSQL):**
  - **Windows (через winget):**
    ```powershell
    winget install PostgreSQL.PostgreSQL.16
    ```
  - **Официальный сайт:** [https://www.postgresql.org/download/](https://www.postgresql.org/download/)

---

### 4. Playwright и браузеры (для E2E тестов)
Playwright установлен в папке `frontend`.
- **Установка зависимостей проекта:**
  ```bash
  cd frontend
  npm install
  ```
- **Браузер:**
  Конфигурация `playwright.config.js` настроена на системный **Google Chrome** (`channel: 'chrome'`). Если в вашей системе уже установлен Chrome, ничего дополнительно загружать не требуется.
- **Если требуется загрузить встроенные браузеры Playwright (Chromium/Firefox/WebKit):**
  ```bash
  cd frontend
  npx playwright install
  ```

---

### 5. k6 (для нагрузочных тестов)
Инструмент нагрузочного тестирования от Grafana.
- **Windows (через winget):**
  ```powershell
  winget install Grafana.k6
  ```
- **Windows (через Chocolatey):**
  ```powershell
  choco install k6
  ```
- **macOS (через Homebrew):**
  ```bash
  brew install k6
  ```
- **Linux (Debian/Ubuntu):**
  ```bash
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update
  sudo apt-get install k6
  ```
- **Официальный сайт:** [https://k6.io/docs/get-started/installation/](https://k6.io/docs/get-started/installation/)
- **Проверка версии:**
  ```bash
  k6 version
  ```
