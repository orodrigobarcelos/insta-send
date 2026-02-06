const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

// Arquivo de autenticação
const AUTH_FILE = getAuthFilePath();

/**
 * Script para debug interativo de comentários no Instagram
 * @param {string} shortcode - Shortcode da postagem para teste
 * @param {string} comment - Comentário de teste
 */
async function debugCommentInteractive(shortcode, comment) {
  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.');
    return;
  }

  console.log(`Iniciando debug interativo para postagem: ${shortcode}...`);
  console.log(`Comentário de teste: "${comment}"`);
  
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
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('\n=== MODO DEBUG INTERATIVO ===');
    console.log('Agora você pode interagir com a página do Instagram.');
    console.log('Instruções:');
    console.log('1. Localize o campo de comentário e clique nele');
    console.log('2. Digite o comentário de teste');
    console.log('3. Clique no botão de publicar');
    console.log('\nO script vai capturar os seletores e eventos durante sua interação.');
    console.log('Pressione Enter no terminal quando quiser encerrar o debug...');
    
    // Monitorar eventos de clique
    await page.evaluate(() => {
      window._clickedElements = [];
      
      document.addEventListener('click', function(event) {
        const element = event.target;
        const info = {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          textContent: element.textContent.trim(),
          type: element.type,
          role: element.getAttribute('role'),
          ariaLabel: element.getAttribute('aria-label'),
          placeholder: element.placeholder,
          timestamp: new Date().toISOString()
        };
        
        console.log('Elemento clicado:', info);
        window._clickedElements.push(info);
      }, true);
      
      // Monitorar eventos de input
      document.addEventListener('input', function(event) {
        const element = event.target;
        console.log('Input detectado:', {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          value: element.value,
          placeholder: element.placeholder
        });
      }, true);
    });
    
    // Aguardar interação do usuário
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // Capturar os elementos clicados
    const clickedElements = await page.evaluate(() => window._clickedElements || []);
    
    console.log('\n=== ELEMENTOS CLICADOS DURANTE A INTERAÇÃO ===');
    console.log(JSON.stringify(clickedElements, null, 2));
    
    // Capturar todos os textareas na página
    const textareas = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('textarea')).map(t => ({
        tagName: t.tagName,
        id: t.id,
        className: t.className,
        placeholder: t.placeholder,
        ariaLabel: t.getAttribute('aria-label')
      }));
    });
    
    console.log('\n=== TODOS OS TEXTAREAS NA PÁGINA ===');
    console.log(JSON.stringify(textareas, null, 2));
    
    // Capturar todos os botões na página
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        tagName: b.tagName,
        id: b.id,
        className: b.className,
        textContent: b.textContent.trim(),
        type: b.type,
        disabled: b.disabled,
        ariaLabel: b.getAttribute('aria-label')
      }));
    });
    
    console.log('\n=== TODOS OS BOTÕES NA PÁGINA ===');
    console.log(JSON.stringify(buttons, null, 2));
    
    // Tirar screenshot final
    const finalScreenshotPath = path.join(__dirname, 'debug-final.png');
    await page.screenshot({ path: finalScreenshotPath });
    console.log(`\nScreenshot final salvo em: ${finalScreenshotPath}`);
    
    console.log('\nDebug interativo concluído!');
    console.log('Pressione Enter novamente para fechar o navegador...');
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
    console.log('Debug finalizado.');
  }
}

// Verificar argumentos da linha de comando
const shortcode = process.argv[2] || 'DKmyDswgyjh';
const comment = process.argv[3] || 'Teste de comentário interativo! 👍';

if (!shortcode) {
  console.log('Uso: node debug-comment-interactive.js <shortcode> [comentário]');
  process.exit(1);
}

// Executar função de debug
debugCommentInteractive(shortcode, comment)
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
