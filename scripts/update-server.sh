#!/bin/bash

# Transferir o arquivo para o servidor
echo "Transferindo instagram-user-id.js para o servidor..."
scp /Users/frankcosta/Downloads/instagram-bot-deploy/instagram-user-id.js root@147.93.131.155:/opt/instagram-bot/

# Acessar o servidor e reiniciar o serviço
echo "Reiniciando o serviço no servidor..."
ssh root@147.93.131.155 "cd /opt/instagram-bot && pm2 restart instagram-bot"

echo "Atualização concluída!"
