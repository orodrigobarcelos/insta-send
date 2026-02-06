#!/bin/bash

echo "=== DIAGNÓSTICO E CORREÇÃO DO SERVIDOR ==="

ssh root@147.93.131.155 << 'EOF'
echo "1. Verificando se o serviço está rodando..."
pm2 status

echo "2. Verificando se a porta 3001 está sendo usada..."
netstat -tlnp | grep 3001

echo "3. Verificando logs do PM2..."
pm2 logs instagram-bot --lines 10

echo "4. Verificando firewall..."
ufw status

echo "5. Liberando porta 3001 no firewall..."
ufw allow 3001

echo "6. Verificando se o servidor está escutando em todas as interfaces..."
ss -tlnp | grep 3001

echo "7. Reiniciando o serviço..."
pm2 restart instagram-bot

echo "8. Aguardando inicialização..."
sleep 5

echo "9. Testando localmente..."
curl -s http://localhost:3001/ || echo "Erro no teste local"

echo "10. Verificando novamente as portas..."
ss -tlnp | grep 3001
EOF

echo "=== DIAGNÓSTICO CONCLUÍDO ==="
