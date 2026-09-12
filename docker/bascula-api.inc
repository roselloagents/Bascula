# Proxy a bascula-api (SPEC-dieta-propia §1.2). Se copia a /etc/nginx/bascula-api.inc.
# El upstream va en una variable y con el resolver de Docker para que nginx arranque aunque
# bascula-api todavía no exista y siga a su IP nueva tras cada redespliegue.
resolver 127.0.0.11 valid=10s ipv6=off;
set $bascula_api http://bascula-api:8787;
proxy_pass $bascula_api$request_uri;
proxy_http_version 1.1;
proxy_read_timeout 90s;
proxy_send_timeout 90s;
client_max_body_size 64k;
client_body_timeout 30s;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
add_header Cache-Control "no-store" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
