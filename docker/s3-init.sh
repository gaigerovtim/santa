#!/bin/sh
# Создаёт бакет и правила CORS (загрузка фото из браузера по presigned URL).
set -e
S3="aws --endpoint-url http://s3:9000 s3api"

if $S3 head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Бакет $BUCKET уже есть"
else
  $S3 create-bucket --bucket "$BUCKET"
  echo "Бакет $BUCKET создан"
fi

cat > /tmp/cors.json <<'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF
$S3 put-bucket-cors --bucket "$BUCKET" --cors-configuration file:///tmp/cors.json \
  && echo "CORS настроен" \
  || echo "Предупреждение: хранилище не поддерживает put-bucket-cors, CORS не настроен"
