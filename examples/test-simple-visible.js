/**
 * Teste simples que replica exatamente o que funcionou com tela visível
 */

const { chromium } = require('playwright');
const fs = require('fs');
const { getAuthFilePath } = require('./instagram-auth-state');

const AUTH_FILE = getAuthFilePath();
const SHORTCODE = 'DGI3xifsi15'; // Shortcode de teste
const TEST_COMMENT = 'Teste simples visível ' + new Date().toISOString();

async function testSimpleVisible() {
  console.log('=== TESTE SIMPLES COM TELA VISÍVEL ===');
  console.log(`Shortcode: ${SHORTCODE}`);
  console.log(`Comentário: "${TEST_COMMENT}"`);
  
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('Arquivo de autenticação não encontrado.');
    return;
  }
  
  // Navegador visível, como funcionou antes
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Mais lento para ver o que acontece
  });
  
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navegar para o post
    const postUrl = `https://www.instagram.com/p/${SHORTCODE}/`;
    console.log(`\nAcessando: ${postUrl}`);
    await page.goto(postUrl);
    
    // Aguardar carregamento
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('\nProcurando campo de comentário...');
    
    // Tentar encontrar o campo de comentário - abordagem simples
    const commentField = await page.waitForSelector('textarea', { 
      state: 'visible',
      timeout: 10000 
    });
    
    if (!commentField) {
      console.log('❌ Campo de comentário não encontrado');
      return;
    }
    
    console.log('✅ Campo de comentário encontrado');
    
    // Clicar no campo primeiro
    console.log('Clicando no campo...');
    await commentField.click();
    await page.waitForTimeout(1000);
    
    // Digitar o comentário - método simples que funcionou
    console.log('Digitando comentário...');
    await commentField.type(TEST_COMMENT, { delay: 100 });
    
    console.log('✅ Comentário digitado');
    await page.waitForTimeout(2000);
    
    // Procurar botão de postar
    console.log('Procurando botão de postar...');
    
    // Tentar encontrar o botão pelo texto
    const postButton = await page.getByText('Postar').first();
    
    if (!postButton) {
      console.log('❌ Botão de postar não encontrado');
      return;
    }
    
    console.log('✅ Botão encontrado, clicando...');
    await postButton.click();
    
    // Aguardar para ver se funcionou
    console.log('Aguardando confirmação...');
    await page.waitForTimeout(5000);
    
    console.log('✅ TESTE CONCLUÍDO! Verifique se o comentário apareceu.');
    
    // Aguardar entrada do usuário
    console.log('\nPressione Enter para fechar...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await browser.close();
  }
}

// Executar teste
testSimpleVisible().catch(console.error);
