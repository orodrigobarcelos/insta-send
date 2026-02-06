const axios = require('axios');
const { chromium } = require('playwright');
const path = require('path');

// Configuração do RapidAPI
const RAPIDAPI_KEY = '92228bdd1amsh0e05279bc93d520p10ecebjsn60f3b00191e4';
const RAPIDAPI_HOST = 'real-time-instagram-scraper-api1.p.rapidapi.com';

/**
 * Teste do novo endpoint para obter o ID do usuário
 */
async function testNewEndpoint(username) {
  console.log(`Testando novo endpoint para o usuário: ${username}`);
  
  try {
    // Novo endpoint conforme solicitado
    const url = `https://${RAPIDAPI_HOST}/v1/user_info_web?username=${username}&nocors=true`;
    
    console.log('URL:', url);
    
    const response = await axios.request({
      method: 'GET',
      url: url,
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    console.log('Resposta recebida!');
    
    // Verificar se o campo eimu_id existe na resposta
    if (response.data && response.data.data && response.data.data.eimu_id) {
      const eimuId = response.data.data.eimu_id;
      console.log(`Campo eimu_id encontrado para ${username}: ${eimuId}`);
      
      // Testar envio de mensagem com o novo ID
      await testSendMessage(username, eimuId);
      
      return eimuId;
    } else {
      console.log('Campo eimu_id não encontrado. Resposta completa:');
      console.log(JSON.stringify(response.data, null, 2));
      return null;
    }
  } catch (error) {
    console.error('Erro ao testar novo endpoint:', error.message);
    if (error.response) {
      console.error('Detalhes do erro:', error.response.data);
    }
    return null;
  }
}

/**
 * Testa o envio de mensagem usando o novo ID
 */
async function testSendMessage(username, userId) {
  console.log(`Testando envio de mensagem para ${username} com ID ${userId}`);
  
  const browser = await chromium.launch({ 
    headless: true // Modo oculto conforme solicitado
  });
  
  try {
    // Carregar o estado de autenticação salvo
    const authPath = path.join(__dirname, 'instagram-auth.json');
    const context = await browser.newContext({
      storageState: authPath
    });
    
    const page = await context.newPage();
    
    // Navegar para a conversa usando o novo ID
    const url = `https://www.instagram.com/direct/t/${userId}`;
    console.log(`Navegando para: ${url}`);
    
    await page.goto(url, { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    
    // Verificar se estamos na página correta
    const currentUrl = page.url();
    console.log(`URL atual: ${currentUrl}`);
    
    // Verificar se a caixa de texto está disponível
    const textboxExists = await page.waitForSelector('div[role="textbox"]', { 
      timeout: 5000,
      state: 'visible' 
    }).then(() => true).catch(() => false);
    
    if (textboxExists) {
      console.log('Caixa de texto encontrada, podemos enviar mensagens!');
      
      // Enviar uma mensagem de teste
      const testMessage = 'Teste do novo endpoint - ' + new Date().toISOString();
      await page.fill('div[role="textbox"]', testMessage);
      await page.press('div[role="textbox"]', 'Enter');
      
      console.log('Mensagem enviada com sucesso!');
      await page.waitForTimeout(2000);
      
      return true;
    } else {
      console.log('Caixa de texto não encontrada, não foi possível enviar mensagem');
      await page.screenshot({ path: 'error-textbox.png' });
      return false;
    }
  } catch (error) {
    console.error('Erro ao testar envio de mensagem:', error);
    return false;
  } finally {
    await browser.close();
  }
}

// Executar o teste com o usuário especificado
const username = 'brunabretas1';

testNewEndpoint(username)
  .then(result => {
    if (result) {
      console.log('Teste concluído com sucesso!');
    } else {
      console.log('Teste falhou.');
    }
  })
  .catch(error => {
    console.error('Erro durante o teste:', error);
  });
