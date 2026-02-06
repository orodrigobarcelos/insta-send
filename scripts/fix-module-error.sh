#!/bin/bash

echo "=== CORRIGINDO ERRO MODULE_NOT_FOUND ==="

ssh root@147.93.131.155 << 'EOF'
cd /opt/instagram-bot

echo "1. Parando serviço com erro..."
pm2 stop instagram-bot

echo "2. Verificando arquivos no diretório..."
ls -la

echo "3. Verificando conteúdo do instagram-api-server.js linha 5..."
sed -n '1,10p' instagram-api-server.js

echo "4. Instalando dependências..."
npm install --production

echo "5. Verificando se instagram-comment-working.js existe..."
ls -la instagram-comment-working.js

echo "6. Iniciando serviço novamente..."
pm2 start instagram-api-server.js --name instagram-bot

echo "7. Aguardando inicialização..."
sleep 5

echo "8. Verificando status..."
pm2 status

echo "9. Verificando logs de erro..."
pm2 logs instagram-bot --lines 5

echo "10. Testando endpoint na porta correta..."
curl -s http://localhost:3001/ || echo "Erro porta 3001"
curl -s http://localhost:3000/ || echo "Erro porta 3000"
EOF

echo "=== CORREÇÃO CONCLUÍDA ==="
