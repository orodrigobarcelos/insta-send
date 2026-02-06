const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

// Arquivo de autenticação
const AUTH_FILE = getAuthFilePath();

/**
 * Envia uma mensagem para uma conversa existente usando o ID da conversa e mantém o navegador aberto
 * @param {string} conversationId - ID da conversa no Instagram
 * @param {string} message - Mensagem a ser enviada
 * @returns {Promise<Object>} - Resultado da operação
 */
async function sendMessageKeepOpen(conversationId, message, options = {}) {
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
  const browser = await chromium.launch({ 
    headless: headless,
    slowMo: slowMo
  });
  
  const context = await browser.newContext({
    storageState: AUTH_FILE
  });
  
  const page = await context.newPage();
  
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
    
    // NÃO fechar o navegador
    console.log('Navegador mantido aberto. Pressione Ctrl+C para encerrar o script.');
    
    return {
      success: true,
      message: `Mensagem enviada para conversa ${conversationId}`,
      verified: messageFound,
      browser, // Retornar o browser para que possa ser fechado manualmente depois
      page // Retornar a página para referência
    };
    
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    
    // Tirar screenshot em caso de erro
    const screenshotPath = path.join(__dirname, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot de erro salvo em: ${screenshotPath}`);
    
    // NÃO fechar o navegador em caso de erro
    console.log('Navegador mantido aberto mesmo após erro. Pressione Ctrl+C para encerrar o script.');
    
    return {
      success: false,
      error: error.message,
      screenshotPath,
      browser, // Retornar o browser para que possa ser fechado manualmente depois
      page // Retornar a página para referência
    };
  }
}

// Se o script for executado diretamente
if (require.main === module) {
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Uso:');
    console.log('  node send-without-close.js conversationId "Sua mensagem aqui"');
    process.exit(1);
  }
  
  const conversationId = args[0];
  const message = args[1];
  
  // Enviar mensagem
  sendMessageKeepOpen(conversationId, message, { headless: false, slowMo: 100 })
    .then(result => {
      console.log('Resultado:', result.success ? 'Sucesso' : 'Falha');
      // Não encerrar o processo para manter o navegador aberto
    })
    .catch(error => {
      console.error('Erro:', error);
      // Não encerrar o processo para manter o navegador aberto
    });
}

module.exports = { sendMessageKeepOpen };
