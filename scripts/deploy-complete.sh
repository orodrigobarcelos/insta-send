#!/bin/bash

echo "=== DEPLOY COMPLETO PARA CONTABO ==="

# Arquivos principais que precisam ser atualizados
FILES=(
    "instagram-api-server.js"
    "instagram-comment-working.js"
    "instagram-user-id.js"
    "instagram-shortcode-api.js"
    "package.json"
    ".env"
)

# Transferir arquivos
echo "Transferindo arquivos..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Enviando: $file"
        scp "$file" root@147.93.131.155:/opt/instagram-bot/
    else
        echo "⚠️  Arquivo não encontrado: $file"
    fi
done

# Conectar ao servidor e reiniciar
echo "Conectando ao servidor..."
ssh root@147.93.131.155 << 'EOF'
cd /opt/instagram-bot

echo "Instalando dependências..."
npm install

echo "Parando serviço..."
pm2 stop instagram-bot

echo "Iniciando serviço..."
pm2 start instagram-api-server.js --name instagram-bot

echo "Status do serviço:"
pm2 status

echo "Testando endpoint..."
sleep 3
curl -s http://localhost:3001/ || echo "Erro no teste local"
EOF

echo "=== DEPLOY CONCLUÍDO ==="
