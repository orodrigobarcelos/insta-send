const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

// Arquivo de autenticação
const AUTH_FILE = getAuthFilePath();

/**
 * Script para testar elementos de comentário no Instagram
 * @param {string} shortcode - Shortcode da postagem para teste
 */
async function testCommentElements(shortcode) {
  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.');
    return;
  }

  console.log(`Iniciando teste para postagem: ${shortcode}...`);
  
  // Iniciar o navegador em modo visível com slowMo para visualização
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 50
  });
  
  const context = await browser.newContext({
    storageState: AUTH_FILE
  });
  
  const page = await context.newPage();
  
  try {
    // Navegar para a página da postagem
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`Acessando a postagem: ${postUrl}`);
    await page.goto(postUrl);
    
    // Esperar a página carregar
    console.log('Aguardando carregamento da página...');
    await page.waitForTimeout(5000);
    
    // Tirar screenshot da página
    const screenshotPath = path.join(__dirname, 'post-page.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot salvo em: ${screenshotPath}`);
    
    // Aguardar interação do usuário
    console.log('\nPor favor, interaja com a página para identificar os elementos:');
    console.log('1. Localize o campo de comentário');
    console.log('2. Digite um comentário de teste');
    console.log('3. Envie o comentário');
    console.log('\nPressione Enter quando terminar...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // Capturar o estado atual da página
    console.log('\nCapturando elementos da página...');
    
    // Tirar screenshot após interação
    const afterScreenshotPath = path.join(__dirname, 'after-interaction.png');
    await page.screenshot({ path: afterScreenshotPath });
    console.log(`Screenshot após interação salvo em: ${afterScreenshotPath}`);
    
    // Capturar elementos de formulário
    const formElements = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.map(form => ({
        role: form.getAttribute('role'),
        id: form.id,
        className: form.className,
        elements: Array.from(form.elements).map(el => ({
          tagName: el.tagName,
          type: el.type,
          id: el.id,
          name: el.name,
          className: el.className,
          placeholder: el.placeholder,
          ariaLabel: el.getAttribute('aria-label')
        }))
      }));
    });
    
    console.log('\nFormulários encontrados:');
    console.log(JSON.stringify(formElements, null, 2));
    
    // Capturar campos de texto
    const textFields = await page.evaluate(() => {
      const inputs = [
        ...Array.from(document.querySelectorAll('textarea')),
        ...Array.from(document.querySelectorAll('input[type="text"]')),
        ...Array.from(document.querySelectorAll('div[contenteditable="true"]')),
        ...Array.from(document.querySelectorAll('div[role="textbox"]'))
      ];
      
      return inputs.map(input => ({
        tagName: input.tagName,
        type: input.type,
        id: input.id,
        className: input.className,
        placeholder: input.placeholder,
        ariaLabel: input.getAttribute('aria-label'),
        role: input.getAttribute('role'),
        contentEditable: input.contentEditable
      }));
    });
    
    console.log('\nCampos de texto encontrados:');
    console.log(JSON.stringify(textFields, null, 2));
    
    // Capturar botões
    const buttons = await page.evaluate(() => {
      const btns = [
        ...Array.from(document.querySelectorAll('button')),
        ...Array.from(document.querySelectorAll('div[role="button"]')),
        ...Array.from(document.querySelectorAll('[type="submit"]'))
      ];
      
      return btns.map(btn => ({
        tagName: btn.tagName,
        type: btn.type,
        id: btn.id,
        className: btn.className,
        textContent: btn.textContent.trim(),
        ariaLabel: btn.getAttribute('aria-label'),
        disabled: btn.disabled
      }));
    });
    
    console.log('\nBotões encontrados:');
    console.log(JSON.stringify(buttons, null, 2));
    
    // Aguardar para fechar
    console.log('\nTeste concluído. Pressione Enter para fechar o navegador...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    console.error('Erro durante teste:', error);
    
    // Tirar screenshot em caso de erro
    const errorPath = path.join(__dirname, 'test-error.png');
    await page.screenshot({ path: errorPath });
    console.error(`Screenshot de erro salvo em: ${errorPath}`);
  } finally {
    // Fechar o navegador
    await browser.close();
    console.log('Teste concluído.');
  }
}

// Verificar argumentos da linha de comando
const shortcode = process.argv[2] || 'DKmyDswgyjh';

if (!shortcode) {
  console.log('Uso: node test-comment-elements.js <shortcode>');
  process.exit(1);
}

// Executar função de teste
testCommentElements(shortcode)
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
