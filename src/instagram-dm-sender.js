const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');
const { launchBrowser, setupResourceBlocking } = require('./browser-config');

// Arquivo de autenticação
const AUTH_FILE = getAuthFilePath();

/**
 * Envia uma mensagem para um usuário do Instagram
 * @param {string} username - Nome de usuário do Instagram (sem @)
 * @param {string} message - Mensagem a ser enviada
 * @returns {Promise<Object>} - Resultado da operação
 */
async function sendDirectMessage(username, message, options = {}) {
  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    return {
      success: false,
      error: 'Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.'
    };
  }

  console.log(`Iniciando envio de mensagem para @${username}...`);
  
  // Opções padrão
  const headless = options.headless !== undefined ? options.headless : false;
  const slowMo = options.slowMo !== undefined ? options.slowMo : 50;
  
  // Iniciar o navegador com o estado de autenticação
  const browser = await launchBrowser({ headless, slowMo });

  const context = await browser.newContext({
    storageState: AUTH_FILE,
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  await setupResourceBlocking(page);

  try {
    // Navegar para a página de mensagens diretas
    console.log('Acessando a página de mensagens diretas...');
    await page.goto('https://www.instagram.com/direct/inbox/');
    
    // Esperar a página carregar
    await page.waitForSelector('svg[aria-label="Nova mensagem"]', { timeout: 30000 });
    
    // Clicar no botão de nova mensagem
    console.log('Clicando no botão de nova mensagem...');
    await page.click('svg[aria-label="Nova mensagem"]');
    
    // Esperar o modal de busca aparecer
    await page.waitForSelector('input[placeholder="Pesquisar..."]', { timeout: 10000 });
    
    // Digitar o nome de usuário
    console.log(`Buscando usuário: @${username}...`);
    await page.fill('input[placeholder="Pesquisar..."]', username);
    
    // Esperar os resultados da busca (com timeout maior)
    await page.waitForTimeout(3000);
    
    // Selecionar o usuário nos resultados da busca
    const userFound = await page.evaluate((username) => {
      // Procurar por elementos que contenham o nome de usuário
      const elements = Array.from(document.querySelectorAll('div[role="button"]'));
      const userElement = elements.find(el => 
        el.textContent.toLowerCase().includes(username.toLowerCase())
      );
      
      if (userElement) {
        userElement.click();
        return true;
      }
      return false;
    }, username);
    
    if (!userFound) {
      console.error(`Usuário @${username} não encontrado nos resultados da busca.`);
      await browser.close();
      return {
        success: false,
        error: `Usuário @${username} não encontrado.`
      };
    }
    
    // Clicar no botão "Chat" ou "Próximo"
    console.log('Selecionando usuário e iniciando conversa...');
    
    // Esperar o botão "Chat" ou "Próximo" aparecer
    await page.waitForSelector('button[tabindex="0"]', { timeout: 5000 });
    
    // Clicar no botão (pode ser "Chat" ou "Próximo" dependendo da interface)
    await page.click('button[tabindex="0"]');
    
    // Esperar a página de conversa carregar
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
    
    // Digitar a mensagem
    console.log(`Digitando mensagem: "${message}"`);
    await page.fill('div[contenteditable="true"]', message);
    
    // Pressionar Enter para enviar
    console.log('Enviando mensagem...');
    await page.press('div[contenteditable="true"]', 'Enter');
    
    // Esperar um pouco para garantir que a mensagem foi enviada
    await page.waitForTimeout(3000);
    
    // Verificar se a mensagem aparece na conversa
    const messageFound = await page.evaluate((msg) => {
      const elements = Array.from(document.querySelectorAll('div[role="row"]'));
      return elements.some(el => el.textContent.includes(msg));
    }, message);
    
    if (messageFound) {
      console.log('Mensagem enviada com sucesso!');
    } else {
      console.log('Mensagem enviada, mas não foi possível confirmar na interface.');
    }
    
    // Tentar extrair o ID da conversa da URL
    let conversationId = null;
    try {
      const url = page.url();
      const match = url.match(/\/direct\/t\/([0-9]+)/);
      if (match && match[1]) {
        conversationId = match[1];
        console.log(`ID da conversa capturado: ${conversationId}`);
        
        // Se encontrou o ID, salvar no cache
        try {
          const cacheFile = path.join(__dirname, 'user-id-cache.json');
          let cache = {};
          
          // Carregar cache existente se disponível
          if (fs.existsSync(cacheFile)) {
            cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          }
          
          // Adicionar/atualizar entrada no cache
          cache[username.toLowerCase()] = {
            id: conversationId,
            timestamp: Date.now()
          };
          
          // Salvar cache atualizado
          fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
          console.log(`ID do usuário ${username} salvo no cache`);
        } catch (cacheError) {
          console.error('Erro ao salvar ID no cache:', cacheError);
        }
      }
    } catch (urlError) {
      console.error('Erro ao extrair ID da conversa:', urlError);
    }
    
    // Fechar o navegador
    await browser.close();
    
    return {
      success: true,
      message: conversationId ? `Mensagem enviada para conversa ${conversationId}` : `Mensagem enviada para @${username}`,
      conversationId,
      verified: messageFound
    };
    
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    
    // Tirar screenshot em caso de erro
    const screenshotPath = path.join(__dirname, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot de erro salvo em: ${screenshotPath}`);
    
    // Fechar o navegador
    await browser.close();
    
    return {
      success: false,
      error: error.message,
      screenshotPath
    };
  }
}

/**
 * Envia uma mensagem para uma conversa existente usando o ID da conversa
 * @param {string} conversationId - ID da conversa no Instagram
 * @param {string} message - Mensagem a ser enviada
 * @returns {Promise<Object>} - Resultado da operação
 */
async function sendMessageToConversation(conversationId, message, options = {}) {
  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    return {
      success: false,
      error: 'Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.'
    };
  }

  console.log(`Iniciando envio de mensagem para conversa ID: ${conversationId}...`);
  
  // Opções padrão
  const headless = options.headless !== undefined ? options.headless : false;
  const slowMo = options.slowMo !== undefined ? options.slowMo : 50;
  
  // Iniciar o navegador com o estado de autenticação
  const browser = await launchBrowser({ headless, slowMo });

  const context = await browser.newContext({
    storageState: AUTH_FILE,
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  await setupResourceBlocking(page);

  try {
    // Navegar diretamente para a conversa usando o ID
    const conversationUrl = `https://www.instagram.com/direct/t/${conversationId}/`;
    console.log(`Acessando a conversa: ${conversationUrl}`);
    await page.goto(conversationUrl);
    
    // Esperar a página de conversa carregar (campo de mensagem)
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 30000 });
    
    // Digitar a mensagem
    console.log(`Digitando mensagem: "${message}"`);
    await page.fill('div[contenteditable="true"]', message);
    
    // Pressionar Enter para enviar
    console.log('Enviando mensagem...');
    await page.press('div[contenteditable="true"]', 'Enter');
    
    // Esperar um pouco para garantir que a mensagem foi enviada
    await page.waitForTimeout(3000);
    
    // Verificar se a mensagem aparece na conversa
    const messageFound = await page.evaluate((msg) => {
      const elements = Array.from(document.querySelectorAll('div[role="row"]'));
      return elements.some(el => el.textContent.includes(msg));
    }, message);
    
    if (messageFound) {
      console.log('Mensagem enviada com sucesso!');
    } else {
      console.log('Mensagem enviada, mas não foi possível confirmar na interface.');
    }
    
    // Fechar o navegador
    await browser.close();
    
    return {
      success: true,
      message: `Mensagem enviada para conversa ${conversationId}`,
      verified: messageFound
    };
    
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    
    // Tirar screenshot em caso de erro
    const screenshotPath = path.join(__dirname, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot de erro salvo em: ${screenshotPath}`);
    
    // Fechar o navegador
    await browser.close();
    
    return {
      success: false,
      error: error.message,
      screenshotPath
    };
  }
}

// Exportar funções
module.exports = {
  sendDirectMessage,
  sendMessageToConversation
};

// Exportar funções para uso em outros scripts
module.exports = {
  sendDirectMessage,
  sendMessageToConversation
};

// Se este script for executado diretamente
if (require.main === module) {
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  let headless = false; // Padrão: navegador visível
  
  // Verificar se a opção --headless está presente
  const headlessIndex = args.indexOf('--headless');
  if (headlessIndex !== -1) {
    headless = true;
    // Remover a opção --headless dos argumentos
    args.splice(headlessIndex, 1);
  }
  
  if (args.length < 2) {
    console.log('Uso:');
    console.log('Para enviar por nome de usuário:');
    console.log('  node instagram-dm-sender.js [--headless] username "Sua mensagem aqui"');
    console.log('Para enviar por ID de conversa:');
    console.log('  node instagram-dm-sender.js [--headless] --conversation-id 123456789 "Sua mensagem aqui"');
    process.exit(1);
  }
  
  // Verificar se estamos usando ID de conversa ou nome de usuário
  if (args[0] === '--conversation-id') {
    if (args.length < 3) {
      console.log('Erro: Faltando ID da conversa ou mensagem');
      process.exit(1);
    }
    
    const conversationId = args[1];
    const message = args[2];
    
    sendMessageToConversation(conversationId, message, { headless })
      .then(result => {
        console.log('Resultado:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
      });
  } else {
    const username = args[0];
    const message = args[1];
    
    sendDirectMessage(username, message, { headless })
      .then(result => {
        console.log('Resultado:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
      });
  }
}
