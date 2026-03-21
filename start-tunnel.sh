#!/bin/bash

# Cores para o terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Iniciando Túnel Cloudflare para Bot Instagram ===${NC}"

# Verificar se cloudflared está instalado
if ! command -v cloudflared &> /dev/null; then
    echo "Erro: cloudflared não encontrado. Instalando via brew..."
    brew install cloudflared
fi

echo -e "${GREEN}Criando túnel para porta 3000...${NC}"
echo "Sua URL pública aparecerá abaixo (procure por linhas terminando em .trycloudflare.com)"
echo "---------------------------------------------------"

# Iniciar o túnel
cloudflared tunnel --url http://localhost:3000
