#!/bin/bash

# Script de manutenção para o servidor Instagram Bot
# Coloque este arquivo no servidor e configure um cron job para executá-lo diariamente
# Exemplo: 0 2 * * * /opt/instagram-bot/server-maintenance.sh >> /var/log/instagram-maintenance.log 2>&1

echo "=== Iniciando manutenção do servidor $(date) ==="

# 1. Limpar arquivos temporários do Playwright
echo "Limpando arquivos temporários do Playwright..."
find /tmp -name 'playwright-*' -type d -mtime +1 -exec rm -rf {} \; 2>/dev/null || true

# 2. Limpar screenshots de erro antigos
echo "Limpando screenshots de erro antigos..."
find /opt/instagram-bot -name 'error-*.png' -type f -mtime +7 -delete

# 3. Verificar espaço em disco e executar limpeza se necessário
echo "Verificando espaço em disco..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

# Função para limpeza agressiva
limpeza_agressiva() {
  echo "EXECUTANDO LIMPEZA AGRESSIVA DE DISCO!"
  
  # Truncar todos os arquivos de log do Docker (muito eficaz)
  echo "Truncando logs do Docker..."
  find /var/lib/docker/containers -name '*.log' -exec truncate -s 0 {} \; 2>/dev/null || true
  
  # Truncar todos os arquivos de log do sistema
  echo "Truncando logs do sistema..."
  find /var/log -type f -name '*.log' -exec truncate -s 0 {} \; 2>/dev/null || true
  
  # Limpar imagens e contêineres Docker não utilizados
  echo "Limpando recursos Docker não utilizados..."
  docker system prune -af --volumes 2>/dev/null || true
  
  # Verificar o espaço em disco após a limpeza
  DISK_USAGE_AFTER=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
  echo "Uso de disco após limpeza agressiva: $DISK_USAGE_AFTER%"
}

# Sempre executar limpeza básica
echo "Executando limpeza básica..."
# Limpar cache de pacotes
apt-get clean
apt-get autoclean

# Limpar logs antigos
find /var/log -type f -name "*.gz" -delete
find /var/log -type f -name "*.log.*" -delete

# Limpar diretório /tmp
find /tmp -type f -mtime +3 -delete

# Se o uso do disco for alto, realizar limpeza mais agressiva
if [ "$DISK_USAGE" -gt 80 ]; then
  echo "ALERTA: Uso de disco acima de 80% ($DISK_USAGE%)! Executando limpeza agressiva..."
  limpeza_agressiva
fi

# Verificar novamente o espaço em disco após limpeza
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 95 ]; then
  echo "ALERTA CRÍTICO: Uso de disco ainda acima de 95% após limpeza! Enviando notificação..."
  # Aqui você pode adicionar um comando para enviar uma notificação por email ou outro método
fi

# 4. Reiniciar o serviço se necessário
RESTART_NEEDED=false

# Verificar se o processo está consumindo muita memória
MEM_USAGE=$(pm2 jlist | grep -o '"memory":[0-9]*' | grep -o '[0-9]*' | head -1)
if [ -n "$MEM_USAGE" ] && [ "$MEM_USAGE" -gt 200000000 ]; then
  echo "Uso de memória alto ($MEM_USAGE bytes). Reiniciando serviço..."
  RESTART_NEEDED=true
fi

# Verificar tempo de execução
UPTIME=$(pm2 jlist | grep -o '"pm2_uptime":[0-9]*' | grep -o '[0-9]*' | head -1)
CURRENT_TIME=$(date +%s000)
if [ -n "$UPTIME" ] && [ -n "$CURRENT_TIME" ]; then
  RUNTIME=$(( (CURRENT_TIME - UPTIME) / 86400000 ))
  if [ "$RUNTIME" -gt 7 ]; then
    echo "Serviço em execução há mais de 7 dias. Reiniciando para manutenção..."
    RESTART_NEEDED=true
  fi
fi

if [ "$RESTART_NEEDED" = true ]; then
  echo "Reiniciando o serviço Instagram Bot..."
  pm2 restart instagram-bot
fi

echo "=== Manutenção concluída $(date) ==="
