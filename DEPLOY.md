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

Сборка кладёт готовый сайт в папку `dist/`. Именно её и должен отдавать nginx.

> ⚠️ **Нельзя делать `root` на корень репозитория `/var/www/youtube-preview-app`.**
> В корне лежит `index.html` для режима разработки: он подключает `/src/main.jsx`.
> Браузер не умеет исполнять JSX-исходники, поэтому страница остаётся пустой (белый экран).
> После `git pull` этот файл перезаписывается и ломает работающий сайт.

### 4. Настройка Nginx

Создай конфиг:
```bash
sudo nano /etc/nginx/sites-available/youtube-preview-app
```

Вставь содержимое файла `nginx.conf` из репозитория (не забудь заменить `your-domain.ru` на твой домен).
Ключевая строка — путь до папки сборки:

```nginx
root /var/www/youtube-preview-app/dist;
```

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

Копировать файлы из `dist/` в корень репозитория **не нужно** — nginx отдаёт папку `dist` напрямую.
После `git pull` ничего не перезаписывается, белый экран не появляется.

Проверить, что nginx реально смотрит на сборку:

```bash
grep -n 'root ' /etc/nginx/sites-available/youtube-preview-app
# должно быть: root /var/www/youtube-preview-app/dist;
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

**Белый (пустой) экран — сайт отдаёт dev-index.html:**
```bash
# Проверь, что отдаёт сервер: если в ответе есть /src/main.jsx — nginx смотрит на корень репозитория
curl -s https://previewgen.ru/ | grep -n 'main.jsx'
```
Причина: `root` в nginx указывает на корень репозитория, а не на `dist`.
В корне лежит dev-версия `index.html` с `<script type="module" src="/src/main.jsx">`,
которая перезаписывается при `git pull` и даёт пустую страницу.

Лечится правкой `root` и перезагрузкой nginx. Сначала найди конфиг сайта:
```bash
sudo grep -rln 'root /var/www/youtube-preview-app' /etc/nginx/
```
и замени путь на папку сборки (в типовом варианте из этого репозитория файл —
`/etc/nginx/sites-available/youtube-preview-app`):
```bash
sudo sed -i 's#root /var/www/youtube-preview-app;#root /var/www/youtube-preview-app/dist;#' \
  /etc/nginx/sites-available/youtube-preview-app
sudo nginx -t && sudo systemctl reload nginx
```
Важно: перед этим на сервере должна существовать папка `dist/` со сборкой
(`cd /var/www/youtube-preview-app && npm install && npm run build`).

Быстрая заплатка без правки nginx (действует до следующего `git pull`): положить
собранный `index.html` в корень репозитория — именно его отдаёт nginx в текущей схеме:
```bash
cd /var/www/youtube-preview-app
npm run build              # если папки dist/ на сервере ещё нет
cp dist/index.html index.html
```
`index.html` отслеживается git, поэтому перед следующим обновлением верни его
исходную версию, иначе `git pull` откажется работать:
```bash
cd /var/www/youtube-preview-app && git checkout -- index.html
```
Надёжнее сразу поправить `root` — тогда корневой `index.html` вообще перестаёт влиять на сайт.

**Ошибки при сборке:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```
