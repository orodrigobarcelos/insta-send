const express = require('express');
const path = require('path');
const cors = require('cors');
const { sendMessageByUsername } = require('./instagram-user-id');
const { commentOnFirstPost } = require('./instagram-post-commenter');
// Usar a versão robusta da função commentOnPost
const { commentOnPost } = require('./instagram-comment-working');
const { getFirstPostShortcode } = require('./instagram-shortcode-api');
const { loadAuthFromEnv } = require('./auth-loader');
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

// Sessao de login ativa (browser aberto aguardando 2FA)
let loginSession = null;

// Limpar sessao de login apos timeout
function clearLoginSession() {
  if (loginSession) {
    console.log('Limpando sessao de login...');
    loginSession.browser.close().catch(() => {});
    loginSession = null;
  }
}

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

// Endpoint de login - etapa 1: username + senha (sem auth)
app.post('/api/instagram-login', async (req, res) => {
  try {
    const { token, username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username e senha sao obrigatorios.' });
    }

    // Limpar sessao anterior se existir
    clearLoginSession();

    const { launchBrowser, setupResourceBlocking } = require('./browser-config');

    console.log(`Iniciando login para @${username}...`);
    const browser = await launchBrowser({ headless: true, slowMo: 100 });
    const context = await browser.newContext({ locale: 'pt-BR' });
    const page = await context.newPage();
    await setupResourceBlocking(page);

    // 1. Acessar pagina de login do Instagram
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Pagina carregada, aguardando elementos...');
    await page.waitForTimeout(5000);

    // 2. Esperar por qualquer campo de login (ate 60s)
    try {
      await page.waitForSelector('input[name="email"], input[name="username"], input[type="password"], input[name="pass"]', { timeout: 60000 });
      console.log('Campo de login encontrado!');
    } catch (e) {
      console.log('Campos nao apareceram. Tirando screenshot...');
      const fs = require('fs');
      const pathMod = require('path');
      fs.writeFileSync(pathMod.join(__dirname, 'login-debug.png'), await page.screenshot());
      await browser.close();
      return res.status(400).json({ success: false, error: 'Campos de login nao encontrados. Tente novamente.' });
    }

    // 3. Preencher username (Instagram usa name="email" ou name="username")
    const usernameField = await page.$('input[name="email"], input[name="username"]');
    if (usernameField) {
      console.log('Campo de username encontrado, preenchendo...');
      await usernameField.fill(username);
      await page.waitForTimeout(500);
    }

    // 4. Preencher senha (Instagram usa name="pass" ou type="password")
    const passwordField = await page.$('input[name="pass"], input[type="password"], input[name="password"]');
    if (passwordField) {
      console.log('Campo de senha encontrado, preenchendo...');
      await passwordField.fill(password);
      await page.waitForTimeout(1000);
    } else {
      await browser.close();
      return res.status(400).json({ success: false, error: 'Campo de senha nao encontrado.' });
    }

    // 5. Clicar em Entrar/Log In
    console.log('Clicando em Entrar...');
    await page.evaluate(() => {
      // Procurar botao visivel com texto Entrar/Log In
      const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const btn = btns.find(b => ['entrar', 'log in'].includes(b.textContent.trim().toLowerCase()));
      if (btn) btn.click();
      else {
        // Fallback: submit o formulario diretamente
        const form = document.querySelector('form');
        if (form) form.submit();
      }
    });
    console.log('Clicou em Entrar, aguardando resposta...');
    await page.waitForTimeout(15000);

    // Debug: screenshot apos login
    const fs2 = require('fs');
    const path2 = require('path');
    fs2.writeFileSync(path2.join(__dirname, 'after-login.png'), await page.screenshot());
    console.log('Screenshot pos-login salvo.');

    // 6. Verificar erro de senha
    const loginError = await page.evaluate(() => {
      const el = document.querySelector('#slfErrorAlert, [role="alert"], p[data-testid="login-error-message"]');
      if (el) return el.textContent;
      // Procurar qualquer texto de erro na pagina
      const allText = document.body.innerText;
      if (allText.includes('incorretas') || allText.includes('incorrect')) {
        return 'Senha incorreta. Verifique suas credenciais.';
      }
      return null;
    });

    if (loginError) {
      await browser.close();
      return res.status(401).json({ success: false, error: loginError });
    }

    // 7. Verificar se pede 2FA
    const has2FA = await page.evaluate(() => {
      // Buscar por seletores conhecidos
      const field = document.querySelector('input[name="verificationCode"], input[name="security_code"], input[aria-label*="Security"], input[aria-label*="erifica"], input[aria-label*="segurança"], input[autocomplete="one-time-code"]');
      if (field) return true;
      // Buscar pelo texto da pagina
      const text = document.body.innerText.toLowerCase();
      return text.includes('código de segurança') || text.includes('security code') || text.includes('autenticação') || text.includes('two-factor');
    });

    if (has2FA) {
      console.log('2FA detectado — aguardando codigo...');
      // Guardar sessao aberta (timeout de 5 min)
      loginSession = { browser, context, page, token, timeout: setTimeout(clearLoginSession, 300000) };
      return res.json({ success: true, need2fa: true, message: 'Digite o codigo do autenticador.' });
    }

    // 6. Tratar telas pos-login
    const saveInfoBtn = await page.$('button:has-text("Agora não"), button:has-text("Not Now")');
    if (saveInfoBtn) { await saveInfoBtn.click(); await page.waitForTimeout(3000); }

    const notifBtn = await page.$('button:has-text("Agora não"), button:has-text("Not Now")');
    if (notifBtn) { await notifBtn.click(); await page.waitForTimeout(3000); }

    // 7. Verificar se logou
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('input[name="username"]') && !document.querySelector('input[type="password"]');
    });

    if (!isLoggedIn) {
      await browser.close();
      return res.status(401).json({ success: false, error: 'Login falhou. Verifique suas credenciais.' });
    }

    // 8. Salvar sessao
    console.log('Login OK sem 2FA! Salvando...');
    if (token) await saveSessionToRailway(context, token);
    await browser.close();

    return res.json({ success: true, message: 'Login realizado e sessao salva!' });

  } catch (error) {
    clearLoginSession();
    console.error('Erro no login:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint 2FA - etapa 2: codigo do autenticador (sem auth)
app.post('/api/instagram-2fa', async (req, res) => {
  try {
    const { token, code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Codigo 2FA obrigatorio.' });
    }

    if (!loginSession) {
      return res.status(400).json({ success: false, error: 'Sessao de login expirada. Faca login novamente.' });
    }

    const { page, context, browser } = loginSession;
    clearTimeout(loginSession.timeout);

    console.log(`Inserindo codigo 2FA: ${code}`);

    // 1. Preencher codigo
    const codeField = await page.$('input[name="verificationCode"], input[name="security_code"], input[aria-label*="Security"], input[aria-label*="erifica"], input[aria-label*="segurança"], input[autocomplete="one-time-code"]');
    if (!codeField) {
      clearLoginSession();
      return res.status(400).json({ success: false, error: 'Campo de 2FA nao encontrado. Tente fazer login novamente.' });
    }

    await codeField.fill(code);
    await page.waitForTimeout(1000);

    // 2. Confirmar
    const confirmBtn = await page.$('button:has-text("Confirmar"), button[type="submit"], button:has-text("Confirm")');
    if (confirmBtn) {
      await confirmBtn.click();
      console.log('Codigo enviado, aguardando...');
      await page.waitForTimeout(10000);
    }

    // 3. Verificar erro de codigo
    const codeError = await page.evaluate(() => {
      const el = document.querySelector('[role="alert"], #twoFactorErrorAlert');
      return el ? el.textContent : null;
    });

    if (codeError) {
      // Nao fechar o browser - usuario pode tentar novamente
      loginSession.timeout = setTimeout(clearLoginSession, 300000);
      return res.status(401).json({ success: false, error: `Codigo invalido: ${codeError}` });
    }

    // 4. Tratar telas pos-login
    const saveInfoBtn = await page.$('button:has-text("Agora não"), button:has-text("Not Now")');
    if (saveInfoBtn) { await saveInfoBtn.click(); await page.waitForTimeout(3000); }

    const notifBtn = await page.$('button:has-text("Agora não"), button:has-text("Not Now")');
    if (notifBtn) { await notifBtn.click(); await page.waitForTimeout(3000); }

    // 5. Salvar sessao
    console.log('2FA OK! Salvando sessao...');
    const railwayToken = token || loginSession.token;
    if (railwayToken) await saveSessionToRailway(context, railwayToken);

    await browser.close();
    loginSession = null;

    return res.json({ success: true, message: 'Login com 2FA realizado e sessao salva!' });

  } catch (error) {
    clearLoginSession();
    console.error('Erro no 2FA:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
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

    // Enviar a mensagem usando o script existente (em modo headless)
    // Passar userId nas opções se disponível
    const result = await sendMessageByUsername(username, message, {
      headless: true,
      userId: userId || null
    });

    // Retornar o resultado
    return res.json(result);
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

    // Comentar na postagem usando a versão robusta (em modo headless)
    const result = await commentOnPost(shortcode, comment, {
      headless: true,
      maxRetries: 3 // Tentar até 3 vezes em caso de falha
    });

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

    // 2. Comentar na postagem usando a versão robusta
    console.log(`Comentando na postagem ${shortcode}...`);
    const commentResult = await commentOnPost(shortcode, comment, {
      headless: true,
      maxRetries: 3 // Tentar até 3 vezes em caso de falha
    });

    // 3. Retornar resultado combinado
    return res.json({
      ...commentResult,
      shortcode,
      postUrl,
      username: username || null
    });
  } catch (error) {
    console.error('Erro ao processar solicitação de comentário via RapidAPI:', error);
    return res.status(500).json({
      success: false,
      error: `Erro ao processar solicitação de comentário via RapidAPI: ${error.message}`
    });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
