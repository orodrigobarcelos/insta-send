const express = require('express');
const bodyParser = require('body-parser');
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

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Rota principal para verificar se o servidor está funcionando
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Servidor de envio de mensagens Instagram está funcionando!'
  });
});

// Endpoint para enviar mensagem por nome de usuário
app.post('/api/send-message', async (req, res) => {
  try {
    // Verificar se o corpo da requisição contém username e message
    const { username, message } = req.body;

    if (!username || !message) {
      return res.status(400).json({
        success: false,
        error: 'Username e message são obrigatórios'
      });
    }

    console.log(`Recebida solicitação para enviar mensagem para @${username}: "${message}"`);

    // Enviar a mensagem usando o script existente (em modo headless)
    const result = await sendMessageByUsername(username, message, { headless: true });

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
app.post('/api/comment-first-post', async (req, res) => {
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
app.post('/api/comment-post', async (req, res) => {
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
app.post('/api/comment-via-rapidapi', async (req, res) => {
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
