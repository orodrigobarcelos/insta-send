const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const https = require('https');

// Função para baixar uma imagem de uma URL
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Status Code: ${response.statusCode}`));
        return;
      }
      
      const writer = fs.createWriteStream(outputPath);
      response.pipe(writer);
      
      writer.on('finish', () => {
        writer.close();
        resolve();
      });
      
      writer.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Limpar arquivo parcial
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Função principal para testar o envio de imagem
async function testSendImageDM(username, message, imageUrl) {
  // Definir o caminho para salvar a imagem temporária
  const tempImagePath = path.join(__dirname, 'temp_image.jpg');
  
  // Inicializar o navegador
  const browser = await chromium.launch({ 
    headless: false, // Definido como false para visualizar o processo
    slowMo: 50 // Desacelerar as ações para melhor visualização
  });
  
  try {
    console.log(`Baixando imagem de ${imageUrl}...`);
    await downloadImage(imageUrl, tempImagePath);
    console.log('Imagem baixada com sucesso!');
    
    // Verificar se a imagem foi baixada corretamente
    const fileStats = fs.statSync(tempImagePath);
    console.log(`Tamanho da imagem: ${fileStats.size} bytes`);
    
    if (fileStats.size === 0) {
      throw new Error('A imagem baixada está vazia');
    }
    
    // Verificar se o arquivo de autenticação existe
    const authPath = path.join(__dirname, 'instagram-auth.json');
    if (!fs.existsSync(authPath)) {
      console.error('Arquivo de autenticação não encontrado:', authPath);
      throw new Error('Arquivo de autenticação não encontrado. Execute o script de autenticação primeiro.');
    }
    
    console.log('Carregando estado de autenticação...');
    // Carregar o estado de autenticação salvo
    const context = await browser.newContext({
      storageState: authPath,
      viewport: { width: 1280, height: 800 }
    });
    
    const page = await context.newPage();
    
    // Abrir diretamente a conversa com o usuário
    console.log(`Navegando diretamente para a conversa com ${username}...`);
    await page.goto(`https://www.instagram.com/direct/t/${username}`, { timeout: 30000 });
    
    // Esperar que a página carregue
    await page.waitForLoadState('domcontentloaded');
    
    // Tirar screenshot para debug
    await page.screenshot({ path: 'direct-page.png' });
    console.log('Screenshot salvo como direct-page.png');
    
    // Verificar se estamos na página correta
    const currentUrl = page.url();
    console.log(`URL atual: ${currentUrl}`);
    
    // Esperar pelo botão de anexar mídia
    console.log('Procurando botão de anexar mídia...');
    
    try {
      // Esperar que a página esteja pronta
      await page.waitForSelector('div[role="textbox"]', { timeout: 5000 });
      
      // Procurar pelo botão de anexar mídia usando diferentes seletores
      let mediaButton = await page.$('svg[aria-label="Adicionar foto ou vídeo"]');
      
      if (!mediaButton) {
        mediaButton = await page.$('button[aria-label="Adicionar foto ou vídeo"]');
      }
      
      if (!mediaButton) {
        // Tentar encontrar por XPath
        mediaButton = await page.$('//svg[contains(@aria-label, "foto")]');
      }
      
      if (!mediaButton) {
        // Tirar screenshot para debug
        await page.screenshot({ path: 'no-media-button.png' });
        throw new Error('Botão de anexar mídia não encontrado');
      }
      
      // Clicar no botão de anexar mídia
      await mediaButton.click();
      console.log('Botão de anexar mídia clicado');
      
      // Esperar pelo input de arquivo
      await page.waitForTimeout(1000);
      
      // Procurar pelo input de arquivo
      const fileInput = await page.$('input[type="file"]');
      
      if (!fileInput) {
        await page.screenshot({ path: 'no-file-input.png' });
        throw new Error('Input de arquivo não encontrado');
      }
      
      // Fazer upload da imagem
      await fileInput.setInputFiles(tempImagePath);
      console.log('Imagem anexada');
      
      // Esperar o upload da imagem
      await page.waitForTimeout(2000);
      
      // Se houver uma mensagem, digitá-la
      if (message && message.trim() !== '') {
        console.log('Digitando mensagem...');
        await page.fill('div[role="textbox"]', message);
      }
      
      // Enviar a mensagem pressionando Enter
      console.log('Enviando mensagem...');
      await page.press('div[role="textbox"]', 'Enter');
      
      // Esperar um pouco para garantir que a mensagem foi enviada
      await page.waitForTimeout(3000);
      
      // Tirar screenshot final
      await page.screenshot({ path: 'message-sent.png' });
      
      console.log('Mensagem com imagem enviada com sucesso!');
      return { success: true, message: 'Mensagem com imagem enviada com sucesso!' };
      
    } catch (error) {
      console.error('Erro ao anexar ou enviar imagem:', error);
      await page.screenshot({ path: 'error-sending.png' });
      throw error;
    }
    
  } catch (error) {
    console.error('Erro ao enviar mensagem com imagem:', error);
    return { success: false, error: error.message };
  } finally {
    // Fechar o navegador
    await browser.close();
    
    // Remover o arquivo temporário
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
      console.log('Arquivo temporário removido');
    }
  }
}

// Executar o teste com parâmetros de exemplo
// Substitua estes valores pelos seus próprios para teste
const username = 'brunabretas1';
const message = 'Teste de envio de imagem via Playwright!';
// Usar uma imagem de exemplo mais confiável para teste
const imageUrl = 'https://i.imgur.com/3jdUKz1.jpeg';

// Verificar se o script está sendo executado diretamente
if (require.main === module) {
  testSendImageDM(username, message, imageUrl)
    .then(result => console.log(result))
    .catch(error => console.error(error));
}

module.exports = { testSendImageDM };
