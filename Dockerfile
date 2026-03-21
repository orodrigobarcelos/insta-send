# Usar imagem oficial do Playwright que já vem com os navegadores e dependências
FROM mcr.microsoft.com/playwright:v1.51.1-jammy

# Instalar dependencias para display virtual + VNC + noVNC
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    matchbox-window-manager \
    x11-xkb-utils \
    python3-pip \
    python3-numpy \
    && pip3 install --no-cache-dir websockify \
    && git clone --depth 1 https://github.com/novnc/noVNC.git /opt/novnc \
    && rm -rf /var/lib/apt/lists/* /root/.cache

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências do projeto
RUN npm ci

# Copiar o resto do código fonte
COPY . .

# Tornar script de startup executavel
RUN chmod +x scripts/start-with-vnc.sh

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production
ENV DISPLAY=:99

# Expor a porta
EXPOSE 3000

# Comando para iniciar (Xvfb + x11vnc + websockify + Node)
CMD ["./scripts/start-with-vnc.sh"]
