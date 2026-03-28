const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { sendMessageToConversation } = require('./instagram-dm-sender');

// Configuração do RapidAPI
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'instagram-looter2.p.rapidapi.com';

/**
 * Obtém o ID do usuário do Instagram usando RapidAPI
 * @param {string} username - Nome de usuário do Instagram (sem @)
 * @returns {Promise<string|null>} - ID do usuário ou null se não encontrado
 */
async function getUserId(username) {
  if (!RAPIDAPI_KEY) {
    console.error('ERRO: RAPIDAPI_KEY não definida. Configure a variável de ambiente RAPIDAPI_KEY.');
    return null;
  }

  console.log(`Buscando ID para o usuário: ${username}`);

  try {
    // Usar o novo endpoint com método GET
    const url = `https://${RAPIDAPI_HOST}/profile?username=${username}`;

    console.log('Obtendo ID do usuário via RapidAPI...');
    console.log('URL:', url);

    const response = await axios.request({
      method: 'GET',
      url: url,
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    console.log('Dados recebidos da API:', response.data);

    // Extrair o ID do usuário da resposta (campo eimu_id)
    if (response.data && response.data.eimu_id) {
      const userId = response.data.eimu_id;
      console.log(`ID do usuário ${username}: ${userId} (eimu_id)`);
      return userId;
    }

    // Tentar extrair do campo id se eimu_id não estiver disponível
    if (response.data && response.data.id) {
      console.log(`Campo id encontrado (${response.data.id}), mas não é o ID correto para conversa.`);
    }

    // Tentar extrair de outras estruturas de dados possíveis
    if (response.data && response.data.user && response.data.user.id) {
      const userId = response.data.user.id;
      console.log(`ID do usuário ${username}: ${userId} (user.id)`);
      return userId;
    }

    // Tentar extrair de outras estruturas de dados possíveis
    if (response.data && response.data.pk) {
      const userId = response.data.pk;
      console.log(`ID do usuário ${username}: ${userId} (pk)`);
      return userId;
    }

    console.error('Erro ao obter ID do usuário: estrutura de dados inesperada');
    console.log('Resposta completa:', JSON.stringify(response.data, null, 2));
    return null;
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return null;
  }
}

/**
 * Salva o ID do usuário em um cache local para uso futuro
 * @param {string} username - Nome de usuário do Instagram
 * @param {string} userId - ID do usuário
 */
function saveUserIdToCache(username, userId) {
  const cacheFile = path.join(__dirname, 'user-id-cache.json');
  let cache = {};

  // Carregar cache existente se disponível
  if (fs.existsSync(cacheFile)) {
    try {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (error) {
      console.error('Erro ao ler cache:', error);
    }
  }

  // Adicionar/atualizar entrada no cache
  cache[username.toLowerCase()] = {
    id: userId,
    timestamp: Date.now()
  };

  // Salvar cache atualizado
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    console.log(`ID do usuário ${username} salvo no cache`);
  } catch (error) {
    console.error('Erro ao salvar cache:', error);
  }
}

/**
 * Obtém o ID do usuário do cache local, se disponível e não expirado
 * @param {string} username - Nome de usuário do Instagram
 * @param {number} maxAgeMs - Idade máxima do cache em milissegundos (padrão: 30 dias)
 * @returns {string|null} - ID do usuário ou null se não encontrado ou expirado
 */
function getUserIdFromCache(username, maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
  const cacheFile = path.join(__dirname, 'user-id-cache.json');

  if (!fs.existsSync(cacheFile)) {
    return null;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const entry = cache[username.toLowerCase()];

    if (entry && entry.id && entry.timestamp) {
      const age = Date.now() - entry.timestamp;

      if (age <= maxAgeMs) {
        console.log(`ID do usuário ${username} encontrado no cache: ${entry.id}`);
        return entry.id;
      } else {
        console.log(`Cache para ${username} expirado (${Math.round(age / (24 * 60 * 60 * 1000))} dias)`);
        return null;
      }
    }
  } catch (error) {
    console.error('Erro ao ler cache:', error);
  }

  return null;
}

/**
 * Obtém o ID do usuário (do cache ou da API) e envia uma mensagem
 * @param {string} username - Nome de usuário do Instagram
 * @param {string} message - Mensagem a ser enviada
 * @param {Object} options - Opções adicionais (headless, etc)
 * @returns {Promise<Object>} - Resultado da operação
 */
async function sendMessageByUsername(username, message, options = {}) {
  // Verificar se o ID do usuário foi fornecido nas opções
  let userId = options.userId;

  // Se não fornecido, tentar obter ID do cache primeiro
  if (!userId) {
    userId = getUserIdFromCache(username);
  }

  // Se tem userId (fornecido ou do cache), usar direct/t/ direto
  if (userId) {
    console.log(`ID encontrado para ${username}: ${userId} — usando direct/t/`);
    return await sendMessageToConversation(userId, message, options);
  }

  // Sem cache: usar ig.me/m/username (sem RapidAPI)
  console.log(`Sem ID em cache para ${username} — usando ig.me/m/${username}`);
  const result = await sendMessageToConversation(null, message, { ...options, username });

  // Se deu certo e temos o conversationId do redirect, cachear pra próxima vez
  if (result.success && result.conversationId) {
    saveUserIdToCache(username, result.conversationId);
    console.log(`ConversationId ${result.conversationId} salvo no cache para ${username}`);
  }

  return result;
}

// Exportar funções
module.exports = {
  getUserId,
  getUserIdFromCache,
  saveUserIdToCache,
  sendMessageByUsername
};

// Se este script for executado diretamente
if (require.main === module) {
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  let headless = false;

  // Verificar se a opção --headless está presente
  const headlessIndex = args.indexOf('--headless');
  if (headlessIndex !== -1) {
    headless = true;
    args.splice(headlessIndex, 1);
  }

  if (args.length < 2) {
    console.log('Uso:');
    console.log('  node instagram-user-id.js [--headless] username "Sua mensagem aqui"');
    console.log('');
    console.log('Nota: Configure a variável de ambiente RAPIDAPI_KEY antes de executar.');
    console.log('  export RAPIDAPI_KEY=sua_chave_aqui');
    process.exit(1);
  }

  const username = args[0];
  const message = args[1];

  // Verificar se a chave da API está configurada
  if (!RAPIDAPI_KEY) {
    console.error('ERRO: RAPIDAPI_KEY não definida. Configure a variável de ambiente:');
    console.error('  export RAPIDAPI_KEY=sua_chave_aqui');
    process.exit(1);
  }

  // Enviar mensagem
  sendMessageByUsername(username, message, { headless })
    .then(result => {
      console.log('Resultado:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Erro fatal:', err);
      process.exit(1);
    });
}
