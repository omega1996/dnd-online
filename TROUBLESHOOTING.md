# Решение проблем с Docker

## Проблема: "failed to resolve source metadata for docker.io"

Эта ошибка возникает, когда Docker не может подключиться к Docker Hub из-за проблем с DNS или сетью.

### Решение 1: Настройка DNS для Docker (требует sudo)

Создайте или отредактируйте файл `/etc/docker/daemon.json`:

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<EOF
{
  "dns": ["8.8.8.8", "8.8.4.4", "1.1.1.1"]
}
EOF
sudo systemctl restart docker
```

### Решение 2: Использование DNS через docker-compose

Создайте файл `docker-compose.override.yml` в корне проекта:

```yaml
services:
  client:
    dns:
      - 8.8.8.8
      - 8.8.4.4
  server:
    dns:
      - 8.8.8.8
      - 8.8.4.4
```

### Решение 3: Проверка подключения к интернету

```bash
# Проверьте подключение
ping -c 3 8.8.8.8

# Проверьте DNS
nslookup registry-1.docker.io

# Попробуйте обновить DNS кэш
sudo systemd-resolve --flush-caches  # для systemd
# или
sudo resolvectl flush-caches
```

### Решение 4: Использование прокси (если за корпоративным файрволом)

Если вы за корпоративным файрволом, настройте прокси для Docker:

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf <<EOF
[Service]
Environment="HTTP_PROXY=http://proxy.example.com:8080"
Environment="HTTPS_PROXY=http://proxy.example.com:8080"
Environment="NO_PROXY=localhost,127.0.0.1"
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### Решение 5: Повторная попытка

Иногда проблема временная. Попробуйте:

```bash
# Предзагрузите базовые образы
docker pull node:20-alpine
docker pull nginx:alpine

# Затем запустите сборку
docker compose up --build -d
```

### Решение 7: Отсутствие package-lock.json

Если вы видите ошибку `npm ci command can only install with an existing package-lock.json`, это означает, что в проекте нет файлов `package-lock.json`. 

Dockerfile уже настроен для использования `npm install` вместо `npm ci`, поэтому эта проблема должна быть решена автоматически. Если проблема сохраняется, убедитесь, что вы используете последнюю версию Dockerfile.

### Решение 6: Использование альтернативного реестра

Если Docker Hub недоступен, можно использовать зеркало или другой реестр. Обновите Dockerfile для использования альтернативного реестра (требует изменения Dockerfile).

### Проверка после исправления

После применения любого из решений, проверьте:

```bash
docker pull nginx:alpine
docker pull node:20-alpine
```

Если эти команды работают, попробуйте снова:

```bash
docker compose up --build -d
```
