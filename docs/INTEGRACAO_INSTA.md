# Documentação do Instagram Bot

## Visão Geral

Este projeto é um bot automatizado para envio de mensagens diretas no Instagram, desenvolvido em Node.js utilizando Playwright para automação de navegador. O sistema está hospedado em uma VPS da Contabo e oferece uma API REST para envio de mensagens.

## Arquitetura do Sistema

### Componentes Principais

1. **API REST** (`instagram-api-server.js`)
   - Fornece endpoints para envio de mensagens
   - Porta: 3000
   - Endpoints:
     - `GET /`: Verifica status do servidor
     - `POST /api/send-message`: Envia mensagem para um usuário do Instagram

2. **Módulo de Envio de Mensagens** (`instagram-dm-sender.js`)
   - Implementa a automação do navegador usando Playwright
   - Funções principais:
     - `sendDirectMessage`: Envia mensagem para um usuário pelo nome de usuário
     - `sendMessageToConversation`: Envia mensagem para uma conversa existente usando ID

3. **Módulo de Obtenção de ID de Usuário** (`instagram-user-id.js`)
   - Obtém o ID do usuário do Instagram usando a API do RapidAPI
   - Implementa sistema de cache local para IDs
   - Funções principais:
     - `getUserId`: Obtém ID do usuário via RapidAPI
     - `getUserIdFromCache`: Busca ID no cache local
     - `saveUserIdToCache`: Salva ID no cache local
     - `sendMessageByUsername`: Combina obtenção de ID e envio de mensagem

4. **Autenticação do Instagram** (`instagram-auth-state.js`)
   - Gerencia o estado de autenticação do Instagram
   - Salva cookies e tokens de sessão para reuso

5. **Scripts Auxiliares**
   - `send-multiple-messages.js`: Envia mensagens para múltiplos usuários
   - `send-without-close.js`: Envia mensagem mantendo o navegador aberto
   - `continue-messages.js`: Continua envio de mensagens após interrupção

6. **Manutenção do Servidor** (`server-maintenance.sh`)
   - Script de manutenção para limpeza de arquivos temporários
   - Gerenciamento de espaço em disco
   - Reinício automático do serviço quando necessário

## Dependências Externas

1. **RapidAPI - Instagram Scraper Stable API**
   - Usado para obter IDs de usuários do Instagram
   - Chave API: [REMOVIDA POR SEGURANÇA]
   - Host: `instagram-scraper-stable-api.p.rapidapi.com`
   - Endpoint: `/ig_get_fb_profile_v3.php`

2. **Playwright**
   - Automação de navegador para interagir com o Instagram
   - Utiliza o navegador Chromium

3. **PM2**
   - Gerenciador de processos para Node.js
   - Mantém o serviço em execução e gerencia reinícios

## Infraestrutura

### VPS (Contabo)

- **IP**: [REMOVIDO POR SEGURANÇA]
- **Hostname**: [REMOVIDO POR SEGURANÇA]
- **Sistema Operacional**: Ubuntu 20.04 (64 Bit)
- **Localização**: St. Louis (US Central)

### Estrutura de Diretórios no Servidor

```
/opt/instagram-bot/
├── api/                    # Arquivos da API
├── background/             # Scripts de background
├── chromium/               # Binários do Chromium
├── instagram-api-server.js # Servidor da API
├── instagram-auth.json     # Estado de autenticação
├── instagram-auth-state.js # Gerenciamento de autenticação
├── instagram-dm-sender.js  # Módulo de envio de mensagens
├── instagram-user-id.js    # Módulo de obtenção de ID
├── node_modules/           # Dependências
├── package.json            # Configuração do projeto
├── server-maintenance.sh   # Script de manutenção
└── user-id-cache.json      # Cache de IDs de usuários
```

## Problemas Conhecidos e Soluções

### 1. Erro na Obtenção de ID de Usuário

**Problema**: Falha ao obter o ID do usuário via RapidAPI.

**Possíveis causas**:
- Chave da API expirada ou com limite excedido
- Mudanças na estrutura de resposta da API
- Problemas de conexão com a API

**Soluções**:
- Obter uma nova chave da API em https://rapidapi.com/restyler/api/instagram-scraper-stable-api
- Atualizar a chave no servidor: `export RAPIDAPI_KEY=nova_chave`
- Verificar logs para entender o formato da resposta atual

### 2. Erro "No Space Left on Device"

**Problema**: Falta de espaço em disco impede operações de escrita.

**Soluções**:
- Executar o script de manutenção: `/opt/instagram-bot/server-maintenance.sh`
- Limpar recursos Docker não utilizados: `docker system prune -af --volumes`
- Limpar arquivos temporários do Playwright: `find /tmp -name 'playwright-*' -type d -exec rm -rf {} \;`

### 3. Erro no Parsing de JSON

**Problema**: Erro ao ler ou escrever arquivos de cache.

**Soluções**:
- Reconstruir o cache de IDs: `echo "{}" > /opt/instagram-bot/user-id-cache.json`
- Verificar permissões de arquivo

## Manutenção Regular

Para garantir o funcionamento contínuo do sistema, as seguintes tarefas de manutenção são recomendadas:

1. **Execução diária do script de manutenção**:
   ```bash
   crontab -e
   # Adicionar:
   0 2 * * * /opt/instagram-bot/server-maintenance.sh >> /var/log/instagram-maintenance.log 2>&1
   ```

2. **Monitoramento de espaço em disco**:
   ```bash
   df -h
   ```

3. **Monitoramento de logs**:
   ```bash
   pm2 logs instagram-bot
   ```

4. **Reinício do serviço após atualizações**:
   ```bash
   pm2 restart instagram-bot
   ```

## Uso da API

### Verificar Status do Servidor
```bash
curl http://[IP_DO_SERVIDOR]:3000/
```

### Enviar Mensagem
```bash
curl -X POST http://[IP_DO_SERVIDOR]:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"username": "nome_usuario", "message": "Sua mensagem aqui"}'
```

## Recomendações para Desenvolvimento Futuro

1. **Melhorar sistema de cache de IDs**:
   - Implementar banco de dados em vez de arquivo JSON
   - Adicionar sistema de fallback para múltiplas APIs

2. **Implementar sistema de filas**:
   - Usar Redis ou RabbitMQ para gerenciar fila de mensagens
   - Evitar sobrecarga do sistema com muitas requisições simultâneas

3. **Melhorar monitoramento**:
   - Implementar sistema de alertas para erros críticos
   - Adicionar métricas de desempenho e uso

4. **Segurança**:
   - Implementar autenticação na API
   - Proteger endpoints com rate limiting
