const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { sendMessageByUsername } = require('./instagram-user-id');
const { commentOnFirstPost } = require('./instagram-post-commenter');
// Usar a versão robusta da função commentOnPost
const { commentOnPost } = require('./instagram-comment-working');
const { getFirstPostShortcode } = require('./instagram-shortcode-api');
const { loadAuthFromEnv } = require('./auth-loader');
const sharedBrowser = require('./shared-browser');
require('dotenv').config();

// Tentar carregar autenticação do ambiente antes de iniciar
loadAuthFromEnv();

// Criar o aplicativo Express
const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;

// Avisos de configuracao
if (!API_KEY) console.warn('AVISO: API_KEY nao definida. Endpoints nao estarao protegidos.');
if (!process.env.RAPIDAPI_KEY) console.warn('AVISO: RAPIDAPI_KEY nao definida. Funcoes de busca de usuario/shortcode podem falhar.');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/novnc', express.static('/opt/novnc'));

// Middleware de autenticação por API Key
function authMiddleware(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({ success: false, error: 'API_KEY nao configurada. Configure as variaveis de ambiente primeiro.' });
  }
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ success: false, error: 'API key inválida ou ausente' });
  }
  next();
}

// Endpoint de setup - salva variaveis na Railway via API (sem auth)
app.post('/api/setup-railway', async (req, res) => {
  try {
    const { token, variables } = req.body;

    if (!token || !variables || typeof variables !== 'object') {
      return res.status(400).json({ success: false, error: 'Token e variables sao obrigatorios.' });
    }

    const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';

    // 1. Obter projectId e environmentId do token
    const tokenRes = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
      body: JSON.stringify({ query: '{ projectToken { projectId environmentId } }' })
    });
    const tokenData = await tokenRes.json();

    if (tokenData.errors) {
      return res.status(400).json({ success: false, error: 'Token invalido: ' + tokenData.errors.map(e => e.message).join(', ') });
    }

    const { projectId, environmentId } = tokenData.data.projectToken;

    // 2. Obter serviceId do primeiro servico do projeto
    const servicesRes = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
      body: JSON.stringify({
        query: `query($projectId: String!) { project(id: $projectId) { services { edges { node { id name } } } } }`,
        variables: { projectId }
      })
    });
    const servicesData = await servicesRes.json();

    let serviceId = null;
    if (servicesData.data?.project?.services?.edges?.length > 0) {
      serviceId = servicesData.data.project.services.edges[0].node.id;
      console.log(`ServiceId encontrado: ${serviceId}`);
    }

    // 3. Setar cada variavel (com serviceId para vincular direto ao servico)
    const savedNames = [];
    for (const [name, value] of Object.entries(variables)) {
      const input = { projectId, environmentId, name, value };
      if (serviceId) input.serviceId = serviceId;

      const upsertRes = await fetch(RAILWAY_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
        body: JSON.stringify({
          query: 'mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }',
          variables: { input }
        })
      });
      const upsertData = await upsertRes.json();
      if (upsertData.errors) {
        return res.status(400).json({ success: false, error: `Erro ao salvar ${name}: ${upsertData.errors.map(e => e.message).join(', ')}` });
      }
      savedNames.push(name);
    }

    return res.json({ success: true, saved: savedNames });
  } catch (error) {
    console.error('Erro no setup Railway:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Salvar sessao do Instagram na Railway
async function saveSessionToRailway(context, token) {
  const { getAuthFilePath } = require('./instagram-auth-state');
  const fs = require('fs');
  const AUTH_FILE = getAuthFilePath();

  const storageState = await context.storageState();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState));

  const base64 = Buffer.from(JSON.stringify(storageState)).toString('base64');
  const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';

  const tokenRes = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
    body: JSON.stringify({ query: '{ projectToken { projectId environmentId } }' })
  });
  const tokenData = await tokenRes.json();
  if (tokenData.errors) return;

  const { projectId, environmentId } = tokenData.data.projectToken;

  const servicesRes = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
    body: JSON.stringify({
      query: 'query($projectId: String!) { project(id: $projectId) { services { edges { node { id } } } } }',
      variables: { projectId }
    })
  });
  const servicesData = await servicesRes.json();
  const serviceId = servicesData.data?.project?.services?.edges?.[0]?.node?.id || null;

  const input = { projectId, environmentId, name: 'INSTAGRAM_AUTH_DATA', value: base64 };
  if (serviceId) input.serviceId = serviceId;

  await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
    body: JSON.stringify({
      query: 'mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }',
      variables: { input }
    })
  });

  console.log('Sessao salva na Railway com sucesso!');
}

// === LOGIN VISUAL VIA noVNC ===
let visualLoginSession = null;
let vncSessionToken = null;

function clearVisualLogin() {
  if (visualLoginSession) {
    console.log('Limpando sessao de login visual...');
    visualLoginSession.browser.close().catch(() => {});
    clearTimeout(visualLoginSession.timeout);
    visualLoginSession = null;
    vncSessionToken = null;
  }
}

// Iniciar login visual via noVNC (sem auth)
app.post('/api/start-visual-login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token Railway obrigatorio.' });
    }

    clearVisualLogin();

    vncSessionToken = crypto.randomBytes(32).toString('hex');

    const { launchBrowser, setupResourceBlocking } = require('./browser-config');

    console.log('Iniciando login visual via noVNC...');
    const browser = await launchBrowser({ visual: true, slowMo: 50 });
    const context = await browser.newContext({ locale: 'pt-BR' });
    const page = await context.newPage();
    await setupResourceBlocking(page);

    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    visualLoginSession = {
      browser, context, page, token,
      timeout: setTimeout(clearVisualLogin, 600000) // 10 min
    };

    return res.json({
      success: true,
      vncToken: vncSessionToken,
      message: 'Browser aberto. Use o viewer para fazer login.'
    });

  } catch (error) {
    clearVisualLogin();
    console.error('Erro ao iniciar login visual:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Concluir login visual e salvar sessao (sem auth)
app.post('/api/finish-visual-login', async (req, res) => {
  try {
    const { token } = req.body;

    if (!visualLoginSession) {
      return res.status(400).json({ success: false, error: 'Nenhuma sessao de login ativa.' });
    }

    const { page, context, browser } = visualLoginSession;
    clearTimeout(visualLoginSession.timeout);

    const currentUrl = page.url();
    console.log(`Finalizando login. URL atual: ${currentUrl}`);

    // Verificar se ainda esta na pagina de login
    const isStillOnLogin = await page.evaluate(() => {
      return !!document.querySelector('input[name="email"]') ||
             !!document.querySelector('input[name="username"]') ||
             !!document.querySelector('input[type="password"]');
    });

    if (isStillOnLogin) {
      // Reativar timeout
      visualLoginSession.timeout = setTimeout(clearVisualLogin, 600000);
      return res.status(400).json({
        success: false,
        error: 'Voce ainda nao completou o login. Continue no navegador e tente novamente.'
      });
    }

    console.log('Login concluido! Salvando sessao...');
    const railwayToken = token || visualLoginSession.token;
    if (railwayToken) await saveSessionToRailway(context, railwayToken);

    await browser.close();
    visualLoginSession = null;
    vncSessionToken = null;

    return res.json({ success: true, message: 'Login concluido e sessao salva na Railway!' });

  } catch (error) {
    clearVisualLogin();
    console.error('Erro ao finalizar login:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Status do login visual (sem auth)
app.get('/api/login-status', (req, res) => {
  if (!visualLoginSession) {
    return res.json({ active: false });
  }
  const currentUrl = visualLoginSession.page.url();
  const probablyLoggedIn = !currentUrl.includes('/accounts/login') && !currentUrl.includes('/challenge');
  return res.json({ active: true, currentUrl, probablyLoggedIn });
});

// Health check (sem auth)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    configured: !!API_KEY && !!process.env.RAPIDAPI_KEY
  });
});

// Debug: abre uma URL do Instagram e retorna screenshot (sem auth)
app.get('/api/debug-screenshot', async (req, res) => {
  try {
    const url = req.query.url || 'https://www.instagram.com/';
    const { launchBrowser, setupResourceBlocking, handleInstagramChallenge } = require('./browser-config');
    const { getAuthFilePath } = require('./instagram-auth-state');
    const fs = require('fs');
    const AUTH_FILE = getAuthFilePath();

    if (!fs.existsSync(AUTH_FILE)) {
      return res.status(500).json({ success: false, error: 'Auth file nao encontrado' });
    }

    const browser = await launchBrowser({ headless: true });
    const context = await browser.newContext({ storageState: AUTH_FILE, locale: 'pt-BR' });
    const page = await context.newPage();
    await setupResourceBlocking(page);
    await page.goto(url);
    await page.waitForTimeout(5000);
    await handleInstagramChallenge(page);
    await page.waitForTimeout(5000);

    const screenshot = await page.screenshot({ fullPage: false });
    const pageTitle = await page.title();
    const pageUrl = page.url();
    await browser.close();

    res.set('Content-Type', 'image/png');
    res.send(screenshot);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verificar IP do proxy (sem auth)
app.get('/api/check-ip', async (req, res) => {
  try {
    const { launchBrowser } = require('./browser-config');
    const browser = await launchBrowser({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://ipinfo.io/json');
    const ipData = JSON.parse(await page.textContent('body'));
    await browser.close();
    res.json({ success: true, ...ipData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint para enviar mensagem por nome de usuário
app.post('/api/send-message', authMiddleware, async (req, res) => {
  try {
    // Verificar se o corpo da requisição contém username e message
    // Aceitar userId opcional para otimização
    const { username, message, userId } = req.body;

    if (!username || !message) {
      return res.status(400).json({
        success: false,
        error: 'Username e message são obrigatórios'
      });
    }

    console.log(`Recebida solicitação para enviar mensagem para @${username}: "${message}"`);
    if (userId) {
      console.log(`ID do usuário fornecido: ${userId} (Otimizado)`);
    }

    // Usar browser persistente
    const page = await sharedBrowser.getPage();
    try {
      const result = await sendMessageByUsername(username, message, {
        headless: true,
        userId: userId || null,
        page
      });
      return res.json(result);
    } finally {
      await sharedBrowser.releasePage(page);
    }
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação: ${error.message}`
    });
  }
});

// Endpoint para comentar na primeira postagem de um usuário
app.post('/api/comment-first-post', authMiddleware, async (req, res) => {
  try {
    // Verificar se o corpo da requisição contém username e comment
    const { username, comment } = req.body;

    if (!username || !comment) {
      return res.status(400).json({
        success: false,
        error: 'Username e comment são obrigatórios'
      });
    }

    console.log(`Recebida solicitação para comentar na primeira postagem de @${username}: "${comment}"`);

    // Comentar na primeira postagem usando o script (em modo headless)
    const result = await commentOnFirstPost(username, comment, { headless: true });

    // Retornar o resultado
    return res.json(result);
  } catch (error) {
    console.error('Erro ao processar solicitação de comentário:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação de comentário: ${error.message}`
    });
  }
});

// Endpoint para comentar em uma postagem específica usando shortcode
app.post('/api/comment-post', authMiddleware, async (req, res) => {
  try {
    // Verificar se o corpo da requisição contém shortcode e comment
    const { shortcode, comment } = req.body;

    if (!shortcode || !comment) {
      return res.status(400).json({
        success: false,
        error: 'Shortcode e comment são obrigatórios'
      });
    }

    console.log(`Recebida solicitação para comentar na postagem ${shortcode}: "${comment}"`);

    // Usar browser persistente
    const page = await sharedBrowser.getPage();
    try {
      const result = await commentOnPost(shortcode, comment, {
        headless: true,
        page
      });
      return res.json(result);
    } finally {
      await sharedBrowser.releasePage(page);
    }
  } catch (error) {
    console.error('Erro ao processar solicitação de comentário:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação de comentário: ${error.message}`
    });
  }
});

// Endpoint para comentar na primeira postagem de um usuário usando RapidAPI ou shortcode direto
app.post('/api/comment-via-rapidapi', authMiddleware, async (req, res) => {
  try {
    // Verificar se o corpo da requisição contém os parâmetros necessários
    const { username, comment, shortcode: providedShortcode } = req.body;

    // Verificar se temos pelo menos username OU shortcode
    if ((!username && !providedShortcode) || !comment) {
      return res.status(400).json({
        success: false,
        error: 'É necessário fornecer username OU shortcode, e o comment é obrigatório'
      });
    }

    let shortcode = providedShortcode;
    let postUrl = shortcode ? `https://www.instagram.com/p/${shortcode}/` : null;

    // Se não tiver shortcode, mas tiver username, buscar o shortcode
    if (!shortcode && username) {
      console.log(`Recebida solicitação para comentar via RapidAPI no post de @${username}: "${comment}"`);
      console.log(`Obtendo shortcode para @${username} via RapidAPI...`);

      const shortcodeResult = await getFirstPostShortcode(username);

      if (!shortcodeResult.success) {
        return res.status(400).json({
          success: false,
          error: `Não foi possível obter o shortcode: ${shortcodeResult.error}`,
          apiResponse: shortcodeResult.apiResponse
        });
      }

      shortcode = shortcodeResult.shortcode;
      postUrl = shortcodeResult.postUrl;
      console.log(`Shortcode obtido: ${shortcode}`);
      console.log(`URL do post: ${postUrl}`);
    } else {
      console.log(`Recebida solicitação para comentar via shortcode ${shortcode}: "${comment}"`);
    }

    // 2. Comentar na postagem usando browser persistente
    console.log(`Comentando na postagem ${shortcode}...`);
    const page = await sharedBrowser.getPage();
    try {
      const commentResult = await commentOnPost(shortcode, comment, {
        headless: true,
        page
      });
      return res.json({
        ...commentResult,
        shortcode,
        postUrl,
        username: username || null
      });
    } finally {
      await sharedBrowser.releasePage(page);
    }
  } catch (error) {
    console.error('Erro ao processar solicitação de comentário via RapidAPI:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação de comentário via RapidAPI: ${error.message}`
    });
  }
});

// Proxy WebSocket para noVNC (websockify interno na porta 6080)
const wsProxy = createProxyMiddleware({
  target: 'ws://localhost:6080',
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/websockify': '' },
  on: {
    error: (err, req, res) => {
      console.error('WebSocket proxy error:', err.message);
    }
  }
});
app.use('/websockify', wsProxy);

// Iniciar o servidor e registrar handler de WebSocket upgrade
const server = app.listen(PORT, async () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);

  // Inicializar browser persistente em background
  try {
    await sharedBrowser.init();
    console.log('Browser persistente inicializado com sucesso.');
  } catch (e) {
    console.warn('Browser persistente nao inicializou agora (sera iniciado no primeiro uso):', e.message);
  }
});

server.on('upgrade', wsProxy.upgrade);

// Shutdown limpo
process.on('SIGTERM', async () => {
  console.log('SIGTERM recebido. Encerrando...');
  await sharedBrowser.shutdown();
  server.close();
});

process.on('SIGINT', async () => {
  console.log('SIGINT recebido. Encerrando...');
  await sharedBrowser.shutdown();
  server.close();
});
