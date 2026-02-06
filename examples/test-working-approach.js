/**
 * Teste que replica a abordagem que funcionou - mais simples e direto
 */

const { chromium } = require('playwright');
const fs = require('fs');
const { getAuthFilePath } = require('./instagram-auth-state');

const AUTH_FILE = getAuthFilePath();
const SHORTCODE = 'DGI3xifsi15';
const TEST_COMMENT = 'Funcionou! ' + new Date().toISOString();

async function testWorkingApproach() {
  console.log('=== TESTE ABORDAGEM QUE FUNCIONOU ===');
  console.log(`Comentário: "${TEST_COMMENT}"`);
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300
  });
  
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Navegando para Instagram...');
    await page.goto(`https://www.instagram.com/p/${SHORTCODE}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Aguardar um pouco para carregar
    await page.waitForTimeout(5000);
    
    console.log('Procurando campo de comentário...');
    
    // Usar o seletor mais simples possível
    await page.waitForSelector('textarea', { timeout: 15000 });
    
    console.log('Campo encontrado, clicando...');
    await page.click('textarea');
    await page.waitForTimeout(1000);
    
    console.log('Digitando...');
    await page.type('textarea', TEST_COMMENT, { delay: 50 });
    
    console.log('Procurando botão...');
    await page.waitForTimeout(2000);
    
    // Clicar no botão de postar
    await page.click('button:has-text("Postar")');
    
    console.log('✅ Comentário enviado!');
    await page.waitForTimeout(3000);
    
    console.log('Pressione Enter para fechar...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    console.error('Erro:', error.message);
    await page.screenshot({ path: 'error-working-approach.png' });
  } finally {
    await browser.close();
  }
}

testWorkingApproach().catch(console.error);
