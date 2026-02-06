# Usar imagem oficial do Playwright que já vem com os navegadores e dependências
FROM mcr.microsoft.com/playwright:v1.51.1-jammy

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências do projeto
# Usamos chown porque a imagem do playwright pode rodar como root ou pwuser
# mas queremos garantir permissões corretas
RUN npm ci

# Copiar o resto do código fonte
COPY . .

# Definir variáveis de ambiente padrão
ENV PORT=3000
ENV NODE_ENV=production

# Expor a porta
EXPOSE 3000

# Comando para iniciar a aplicação
# Nota: rodamos "start" que executa "node src/instagram-api-server.js"
CMD ["npm", "start"]
