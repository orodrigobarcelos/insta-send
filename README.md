# Template: Bot de Instagram com Node.js + Playwright

Este projeto é um **template didático** para criar um bot de Instagram usando **Node.js**, **Express** e **Playwright**.

Ele foi pensado para ser usado em aula com alunos, servindo como base para:

- **Enviar mensagens diretas (DM)** para perfis do Instagram
- **Comentar automaticamente em posts** (por usuário ou por shortcode)
- Expor essas ações via **API REST** (HTTP), facilitando integração com ferramentas externas (ex.: UChat)

---

## 1. Requisitos

- Node.js 18+ instalado
- Conta de Instagram (para autenticar no navegador)
- Chave da **RapidAPI** (para buscar informações do perfil/post)

---

## 2. Instalação do projeto

1. Faça o download/clonagem deste template
2. Dentro da pasta do projeto, instale as dependências:

```bash
npm install
```

---

## 3. Configuração do ambiente (.env)

O projeto usa variáveis de ambiente para guardar dados sensíveis.

Já existe um arquivo **`.env.example`** na raiz, com o modelo:

```env
RAPIDAPI_KEY=YOUR_RAPIDAPI_KEY_HERE
PORT=3001
```

### Passo a passo

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Edite o arquivo `.env` e preencha:

- `RAPIDAPI_KEY`: sua chave da RapidAPI
- `PORT` (opcional): porta HTTP do servidor (padrão 3001)

> **Importante:** o arquivo `.env` já está no `.gitignore`, então não será versionado.

---

## 4. Primeiro passo: autenticação no Instagram

Antes de usar a API para enviar mensagens/comentários, o bot precisa salvar um **estado de autenticação** do Instagram (cookies de login) em um arquivo `instagram-auth.json`.

Use o script de autenticação:

```bash
npm run auth
```

O que vai acontecer:

- Um navegador (Chromium) será aberto pelo Playwright
- Acesse o Instagram e faça **login manualmente** na sua conta
- Após o login, aguarde alguns segundos/minutos
- O script salvará o arquivo `instagram-auth.json` na raiz do projeto

Esse arquivo será reutilizado nos próximos usos, evitando repetir login toda vez.

> **Dica para aula:** peça para cada aluno usar a própria conta de testes, nunca a conta principal.

---

## 5. Subindo o servidor da API

Após configurar `.env` e gerar `instagram-auth.json`, você pode subir o servidor HTTP.

### Modo normal

```bash
npm start
```

### Modo desenvolvimento (com auto-reload via nodemon)

```bash
npm run dev
```

Por padrão o servidor sobe em:

```text
http://localhost:3001/
```

Você pode testar o healthcheck com:

```bash
curl http://localhost:3001/
```

A resposta esperada é um JSON simples indicando que o servidor está online.

---

## 6. Endpoints principais da API

Os endpoints são definidos em `src/instagram-api-server.js`.

### 6.1. Healthcheck

- **Método:** `GET`
- **URL:** `/`
- **Descrição:** verifica se o servidor está online

Exemplo (terminal):

```bash
curl http://localhost:3001/
```

---

### 6.2. Enviar DM por username

- **Método:** `POST`
- **URL:** `/api/send-message`
- **Body (JSON):**

```json
{
  "username": "nome_do_usuario",
  "message": "Sua mensagem aqui"
}
```

Exemplo com `curl`:

```bash
curl -X POST http://localhost:3001/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"username":"NOME_DO_USUARIO","message":"Sua mensagem aqui"}'
```

Esse endpoint:

- Busca/constrói a conversa com o usuário
- Usa o navegador (Playwright) para enviar a mensagem

---

### 6.3. Comentar no primeiro post de um usuário (via RapidAPI)

- **Método:** `POST`
- **URL:** `/api/comment-via-rapidapi`
- **Body (JSON) – modo por `username`:**

```json
{
  "username": "nome_do_usuario",
  "comment": "Seu comentário aqui"
}
```

Fluxo interno (simplificado):

1. Usa a RapidAPI para buscar o perfil do usuário
2. Descobre o **shortcode do primeiro post** do feed
3. Abre a página do post com Playwright
4. Escreve e envia o comentário

Exemplo de chamada:

```bash
curl -X POST http://localhost:3001/api/comment-via-rapidapi \
  -H "Content-Type: application/json" \
  -d '{"username":"NOME_DO_USUARIO","comment":"Seu comentário aqui"}'
```

---

### 6.4. Comentar em um post específico (via shortcode)

O mesmo endpoint `/api/comment-via-rapidapi` também aceita **shortcode direto**.

- **Body (JSON) – modo por `shortcode`:**

```json
{
  "shortcode": "ABC123",
  "comment": "Seu comentário aqui"
}
```

Exemplo:

```bash
curl -X POST http://localhost:3001/api/comment-via-rapidapi \
  -H "Content-Type: application/json" \
  -d '{"shortcode":"ABC123","comment":"Seu comentário aqui"}'
```

Nesse modo, o backend **não** chama a RapidAPI para descobrir o post: ele já usa o shortcode informado.

---

## 7. Scripts CLI úteis (sem passar pela API)

Além dos endpoints HTTP, alguns scripts podem ser executados diretamente via linha de comando.

### 7.1. Enviar DM (modo CLI)

```bash
npm run send -- --headless
```

Ou, para enviar para uma conversa específica (`conversation-id`):

```bash
npm run send-by-id -- --conversation-id="ID_AQUI"
```

### 7.2. Enviar DM por username (via script de resolução de ID)

```bash
npm run send-by-username
```

Esse script usa a RapidAPI para buscar informações do usuário, resolve o ID/conversa e então dispara a mensagem.

---

## 8. Estrutura de pastas do template

A estrutura foi simplificada para uso em aula:

```text
.
├── src/
│   ├── instagram-api-server.js       # Servidor Express (endpoints da API)
│   ├── instagram-auth-state.js       # Script de login/autenticação (gera instagram-auth.json)
│   ├── instagram-dm-sender.js        # Lógica para enviar DMs via Playwright
│   ├── instagram-user-id.js          # Integração com RapidAPI + cache de IDs
│   ├── instagram-comment-working.js  # Função robusta para comentar em posts (por shortcode)
│   ├── instagram-shortcode-api.js    # Busca shortcode do primeiro post (RapidAPI)
│   └── instagram-post-commenter.js   # Usa o shortcode do primeiro post para comentar
│
├── examples/
│   ├── test-*.js                     # Vários scripts de teste (DM, comentários, rapidapi, etc.)
│   ├── exemplo-chamada-api.js        # Exemplo simples de uso da API
│   ├── debug-*.js                    # Scripts de debug de seletores/elementos
│   ├── uchat-preprocessing-script.js # Exemplo de integração com UChat (pré-processamento)
│   └── ...                           # Outros testes/experimentos
│
├── scripts/
│   ├── server-maintenance.sh         # Scripts auxiliares de manutenção/deploy (opcionais)
│   └── ...
│
├── docs/
│   └── INTEGRACAO_INSTA.md           # Documento detalhado da integração original
│
├── .env.example                      # Modelo de configuração de ambiente
├── .gitignore                        # Arquivos/pastas ignoradas no versionamento
├── package.json                      # Configuração do projeto Node.js
├── package-lock.json                 # Lockfile de dependências
└── README.md                         # Este arquivo
```

> **Para os alunos:** a pasta mais importante é a `src/`. As demais (`examples/`, `docs/`, `scripts/`) servem como material de apoio.

---

## 9. Boas práticas e alertas

- **Não commitar `.env`, `instagram-auth.json` ou chaves reais** em repositórios públicos
- Use **contas de teste** do Instagram em ambiente de aprendizado
- O Instagram pode mudar a interface a qualquer momento; isso pode quebrar seletores do Playwright, exigindo ajustes no código
- Execuções em modo `headless` podem falhar se o login ainda não estiver bem estabelecido

---

## 10. Ideias de exercícios para alunos

Algumas sugestões de atividades usando este template:

- **Exercício 1:** adicionar um novo endpoint `/api/ping` que retorna `{ "pong": true }`
- **Exercício 2:** criar um endpoint que envia a mesma mensagem para uma lista de usernames
- **Exercício 3:** logar todas as requisições em um arquivo de log (ex.: `logs/requests.log`)
- **Exercício 4:** criar um endpoint que retorna os últimos N comentários feitos pelo bot (salvos em memória ou arquivo)
- **Exercício 5:** adaptar um script de `examples/` para integrar com outra ferramenta além do UChat

---

## 11. Suporte em aula

Este template foi organizado para facilitar o uso didático:

- Código principal concentrado em `src/`
- Exemplos e testes isolados em `examples/`
- Arquivos sensíveis fora do versionamento (`.env`, `instagram-auth.json`)

Se algo não funcionar (por exemplo, mudança no layout do Instagram ou da RapidAPI), o professor pode usar os scripts em `examples/` para depurar e mostrar o passo a passo de correção em aula.
