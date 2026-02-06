const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

// Arquivo de autenticação
const AUTH_FILE = getAuthFilePath();

/**
 * Script de debug para identificar elementos na página do Instagram
 * @param {string} shortcode - Shortcode da postagem para debug
 */
async function debugInstagramElements(shortcode) {
  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.');
    return;
  }

  console.log(`Iniciando debug para postagem: ${shortcode}...`);
  
  // Iniciar o navegador em modo visível com slowMo para visualização
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 100
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
    await page.waitForLoadState('networkidle');
    
    // Tirar screenshot da página
    const screenshotPath = path.join(__dirname, 'debug-page.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot salvo em: ${screenshotPath}`);
    
    // Verificar elementos principais
    console.log('\n--- Verificando elementos na página ---');
    
    // Verificar se a postagem carregou
    const postExists = await page.evaluate(() => {
      return {
        article: !!document.querySelector('article'),
        main: !!document.querySelector('main'),
        header: !!document.querySelector('header'),
        commentForm: !!document.querySelector('form[role="presentation"]'),
        textareas: Array.from(document.querySelectorAll('textarea')).map(t => ({
          placeholder: t.placeholder,
          ariaLabel: t.getAttribute('aria-label')
        })),
        forms: Array.from(document.querySelectorAll('form')).map(f => ({
          role: f.getAttribute('role'),
          method: f.method
        }))
      };
    });
    
    console.log('Elementos encontrados:', JSON.stringify(postExists, null, 2));
    
    // Aguardar para inspeção visual
    console.log('\nNavegador aberto para inspeção visual. Pressione Enter para continuar...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // Tentar encontrar o campo de comentário
    console.log('\nTentando localizar o campo de comentário...');
    
    // Tentar diferentes seletores
    const selectors = [
      'form[role="presentation"] textarea',
      'textarea[aria-label*="coment"]',
      'textarea[placeholder*="coment"]',
      'textarea',
      'form textarea'
    ];
    
    for (const selector of selectors) {
      const exists = await page.$(selector);
      console.log(`Seletor "${selector}": ${exists ? 'ENCONTRADO ✅' : 'não encontrado ❌'}`);
      
      if (exists) {
        // Tirar screenshot com highlight
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            el.style.border = '3px solid red';
          }
        }, selector);
        
        const highlightPath = path.join(__dirname, `debug-${selector.replace(/[^\w]/g, '-')}.png`);
        await page.screenshot({ path: highlightPath });
        console.log(`Screenshot com highlight salvo em: ${highlightPath}`);
      }
    }
    
    // Verificar botões
    console.log('\nVerificando botões na página...');
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent.trim(),
        type: b.type,
        disabled: b.disabled,
        ariaLabel: b.getAttribute('aria-label')
      }));
    });
    
    console.log('Botões encontrados:', JSON.stringify(buttons, null, 2));
    
    // Aguardar para inspeção visual final
    console.log('\nVerificação concluída. Pressione Enter para fechar o navegador...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    console.error('Erro durante debug:', error);
    
    // Tirar screenshot em caso de erro
    const errorPath = path.join(__dirname, 'debug-error.png');
    await page.screenshot({ path: errorPath });
    console.error(`Screenshot de erro salvo em: ${errorPath}`);
  } finally {
    // Fechar o navegador
    await browser.close();
    console.log('Debug concluído.');
  }
}

// Verificar argumentos da linha de comando
const shortcode = process.argv[2] || 'DKmyDswgyjh';

if (!shortcode) {
  console.log('Uso: node debug-instagram-elements.js <shortcode>');
  process.exit(1);
}

// Executar função de debug
debugInstagramElements(shortcode)
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
