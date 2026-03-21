#!/bin/bash
set -e

# 1. Iniciar Xvfb (display virtual)
echo "[startup] Iniciando Xvfb no display :99..."
Xvfb :99 -screen 0 1280x720x24 -ac &
export DISPLAY=:99
sleep 2

# 2. Configurar teclado brasileiro
echo "[startup] Configurando teclado pt-BR..."
setxkbmap -layout br 2>/dev/null || echo "[startup] setxkbmap nao disponivel, usando layout padrao"

# 3. Iniciar matchbox (window manager que maximiza tudo sem decoracao)
echo "[startup] Iniciando matchbox-window-manager..."
matchbox-window-manager -use_titlebar no -use_cursor no &
sleep 1

# 3. Iniciar x11vnc (VNC server, porta interna 5900)
echo "[startup] Iniciando x11vnc na porta 5900..."
x11vnc -display :99 -forever -nopw -shared -rfbport 5900 -noxdamage -threads &
sleep 1

# 3. Iniciar websockify (porta interna 6080, bridge VNC→WebSocket)
echo "[startup] Iniciando websockify na porta 6080..."
websockify --web /opt/novnc 6080 localhost:5900 &
sleep 1

echo "[startup] VNC stack pronto. Iniciando Node.js..."

# 4. Iniciar Node.js (foreground)
exec node src/instagram-api-server.js
