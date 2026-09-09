# Деплой на VPS Timeweb

## Быстрый старт

### 1. Подготовка сервера

```bash
# Обнови систему
sudo apt update && sudo apt upgrade -y

# Установи Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверь версии
node -v  # должно быть v20.x
npm -v   # должно быть 10.x

# Установи Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2. Клонирование проекта

```bash
cd /var/www
sudo git clone https://github.com/cain9128/mamaadelya.git youtube-preview-app
cd youtube-preview-app
npm install
```

### 3. Сборка проекта

```bash
npm run build
```

### 4. Настройка Nginx

Создай конфиг:
```bash
sudo nano /etc/nginx/sites-available/youtube-preview-app
```

Вставь содержимое файла `nginx.conf` из репозитория (не забудь заменить `your-domain.ru` на твой домен).

Активируй сайт:
```bash
sudo ln -s /etc/nginx/sites-available/youtube-preview-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL сертификат

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d твой-домен.ru -d www.твой-домен.ru
```

### 6. DNS настройка

В панели Timeweb → DNS-управление:
- A-запись `@` → IP сервера
- A-запись `www` → IP сервера

Подожди 5-30 минут.

### 7. Автоматический деплой (опционально)

Для автоматического деплоя при пуше в GitHub:

```bash
# На сервере установи webhook или используй GitHub Actions
# Или запускай deploy.sh вручную:
./deploy.sh
```

## Обновление проекта

```bash
cd /var/www/youtube-preview-app
git pull origin develop
npm install
npm run build
sudo systemctl reload nginx
```

## Важно

- Edge Function `generate-preview` остаётся в Supabase — на VPS она не нужна
- Переменные окружения фронтенда: `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` уже захардкожены в коде
- Для смены домена обнови конфиг Nginx и DNS

## Troubleshooting

**Сайт не открывается:**
```bash
sudo nginx -t                    # проверь конфиг
sudo systemctl status nginx      # проверь статус
sudo journalctl -u nginx -f      # логи
```

**Ошибки при сборке:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```
