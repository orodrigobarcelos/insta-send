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

// Health check (sem auth)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    configured: !!API_KEY && !!process.env.RAPIDAPI_KEY
  });
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
