# Docker Setup для D&D Online

Этот проект может быть запущен с помощью Docker и Docker Compose.

## Требования

- Docker (версия 20.10 или выше)
- Docker Compose (версия 2.0 или выше)

## Быстрый старт

1. Создайте файл `.env` в корне проекта и заполните необходимые переменные окружения:

```bash
# Минимальная конфигурация с доменным именем сервера
VITE_SERVER_URL=https://dnd-server.omegasoft.keenetic.name/

# Или оставьте пустым для использования nginx проксирования
# VITE_SERVER_URL=
```

2. Запустите проект:

```bash
docker compose up --build -d
```

3. Откройте браузер и перейдите по адресу `http://localhost`

**Примечание:** Если у вас возникли проблемы с подключением к Docker Hub (DNS ошибки), см. файл `TROUBLESHOOTING.md`

## Настройка доменного имени сервера

Если у вас есть доменное имя для бэкенд сервера (например, `https://dnd-server.omegasoft.keenetic.name/`), установите его в файле `.env`:

```bash
VITE_SERVER_URL=https://dnd-server.omegasoft.keenetic.name/
```

После этого клиент будет подключаться напрямую к этому домену, минуя nginx проксирование.

**Важно:** 
- Убедитесь, что доменное имя доступно из браузера клиента
- Если доменное имя использует другой порт, укажите его: `VITE_SERVER_URL=http://dnd-server.omegasoft.keenetic.name:3001`
- Если `VITE_SERVER_URL` не установлен или пустой, клиент будет использовать относительные пути (nginx проксирование)

## Структура сервисов

- **client** - Vue.js фронтенд приложение, обслуживаемое через nginx на порту 80
- **server** - Node.js бэкенд сервер с Socket.io на порту 3001

## Переменные окружения

### Сервер (обязательно)

- `VITE_SERVER_URL` - URL бэкенд сервера. Если установлен, клиент будет подключаться напрямую к этому URL. Если пустой, клиент будет использовать относительные пути (nginx проксирование).
  
  Пример: `VITE_SERVER_URL=http://dnd-server.omegasoft.keenetic.name`
  
  **Важно:** Если вы используете доменное имя, убедитесь, что оно доступно из браузера клиента.

- `PORT` - порт для бэкенд сервера (по умолчанию: 3001)

- `CORS_ORIGINS` - разрешенные домены для CORS (через запятую). По умолчанию включает `https://dnd.omegasoft.keenetic.name` и localhost для разработки.
  
  Пример: `CORS_ORIGINS=https://dnd.omegasoft.keenetic.name,http://localhost`
  
  **Важно:** Убедитесь, что домен фронтенда указан в `CORS_ORIGINS`, иначе запросы будут блокироваться CORS политикой.

### Firebase (опционально)

Если вы используете Firebase для аутентификации и хранения данных, укажите следующие переменные в файле `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

Эти переменные будут использованы при сборке клиентского приложения.

## Команды

### Запуск в фоновом режиме

```bash
docker-compose up -d
```

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Только клиент
docker-compose logs -f client

# Только сервер
docker-compose logs -f server
```

### Остановка

```bash
docker-compose down
```

### Пересборка образов

```bash
docker-compose build --no-cache
```

### Перезапуск сервисов

```bash
docker-compose restart
```

## Volumes

- `server-uploads` - том для хранения загруженных файлов (токены, карты)

## Сеть

Все сервисы находятся в одной Docker сети `dnd-network`, что позволяет им общаться друг с другом по именам сервисов.

## Проксирование через nginx

Nginx настроен для проксирования следующих запросов к бэкенд серверу:

- `/api/*` - API запросы (если VITE_SERVER_URL не установлен)
- `/socket.io/*` - WebSocket соединения для Socket.io (если VITE_SERVER_URL не установлен)
- `/upload-token-image` - загрузка изображений токенов (если VITE_SERVER_URL не установлен)
- `/upload-map-image` - загрузка карт (если VITE_SERVER_URL не установлен)
- `/rooms` - создание комнат (если VITE_SERVER_URL не установлен)
- `/uploads/*` - **статические файлы (загруженные изображения) - всегда проксируются через nginx**

**Важно:** Файлы из `/uploads/*` всегда доступны через относительные пути и проксируются через nginx, независимо от настройки `VITE_SERVER_URL`. Это обеспечивает надежный доступ к файлам и правильную работу CORS.

## Разработка

Для разработки рекомендуется использовать локальный запуск:

```bash
npm run dev
```

Docker setup предназначен для production окружения.

## Troubleshooting

### Проблемы с подключением к серверу

Убедитесь, что оба контейнера запущены:

```bash
docker-compose ps
```

### Проблемы с загрузкой файлов

Проверьте, что том `server-uploads` создан:

```bash
docker volume ls | grep server-uploads
```

### Пересборка после изменений

Если вы внесли изменения в код, пересоберите образы:

```bash
docker-compose build
docker-compose up -d
```
