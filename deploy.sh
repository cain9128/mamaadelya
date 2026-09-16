#!/bin/bash
set -e

# Скрипт запускается НА сервере из папки репозитория.
# Сайт отдаётся nginx из папки сборки dist — копировать файлы в корень репозитория НЕ нужно.
# Причина: в корне лежит dev-версия index.html (подключает /src/main.jsx), из-за неё
# сайт после git pull открывался пустой белой страницей.

echo "🚀 Deploying youtube-preview-app to VPS..."

# Configuration
REPO_DIR="/var/www/youtube-preview-app"
NGINX_CONF="/etc/nginx/sites-available/youtube-preview-app"
DOMAIN="your-domain.ru"  # Change this to your domain

echo "📥 Pulling latest code..."
cd "$REPO_DIR"
git pull --ff-only

echo "📦 Building production version..."
npm install
npm run build

echo "📁 Checking build output..."
test -f "$REPO_DIR/dist/index.html" || { echo "❌ dist/index.html не найден — сборка не удалась"; exit 1; }

echo "🔧 Setting permissions..."
sudo chown -R www-data:www-data "$REPO_DIR"
sudo chmod -R 755 "$REPO_DIR"

echo "🌐 Configuring Nginx..."
sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root $REPO_DIR/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header X-XSS-Protection "1; mode=block";

    # Main SPA route
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # index.html не кэшируем: иначе после деплоя браузер будет ссылаться на старый бандл
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-cache";
    }
}
EOF

echo "✅ Enabling site..."
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo "🔒 Setting up SSL..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || true

echo "🎉 Deployment complete!"
echo "🌍 Your site should be available at: https://$DOMAIN"

