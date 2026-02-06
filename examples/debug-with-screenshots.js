const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

// Arquivo de autenticação
const AUTH_FILE = getAuthFilePath();

/**
 * Script para debug com capturas de tela automáticas
 * @param {string} shortcode - Shortcode da postagem para teste
 */
async function debugWithScreenshots(shortcode) {
  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.');
    return;
  }

  // Criar pasta para screenshots se não existir
  const screenshotsDir = path.join(__dirname, 'debug_screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  console.log(`Iniciando debug com screenshots para postagem: ${shortcode}...`);
  
  // Iniciar o navegador em modo visível com slowMo para visualização
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 100
  });
  
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navegar para a página da postagem
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`Acessando a postagem: ${postUrl}`);
    await page.goto(postUrl);
    
    // Esperar a página carregar (sem usar waitForLoadState que pode causar timeout)
    console.log('Aguardando carregamento inicial...');
    await page.waitForTimeout(5000);
    
    // Screenshot inicial
    await takeScreenshot(page, screenshotsDir, 'inicial');
    
    // Monitorar eventos de clique, input e scroll
    await page.evaluate(() => {
      window._eventCounter = 0;
      
      // Função para notificar evento
      function notifyEvent(type, details) {
        window._eventCounter++;
        console.log(`[EVENT ${window._eventCounter}] ${type}:`, details);
        
        // Criar elemento para sinalizar evento para o script externo
        const signal = document.createElement('div');
        signal.id = `event-signal-${window._eventCounter}`;
        signal.setAttribute('data-event-type', type);
        signal.style.display = 'none';
        document.body.appendChild(signal);
      }
      
      // Monitorar cliques
      document.addEventListener('click', function(event) {
        const element = event.target;
        notifyEvent('click', {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          textContent: element.textContent.trim().substring(0, 50)
        });
      }, true);
      
      // Monitorar inputs
      document.addEventListener('input', function(event) {
        const element = event.target;
        notifyEvent('input', {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          value: (element.value || '').substring(0, 50)
        });
      }, true);
      
      // Monitorar scroll
      let scrollTimeout;
      document.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          notifyEvent('scroll', {
            scrollY: window.scrollY,
            scrollX: window.scrollX
          });
        }, 300);
      }, true);
    });
    
    console.log('\n=== MODO DEBUG INTERATIVO COM SCREENSHOTS ===');
    console.log('Agora você pode interagir com a página do Instagram.');
    console.log('Um screenshot será tirado automaticamente após cada interação.');
    console.log('Instruções:');
    console.log('1. Localize o campo de comentário e clique nele');
    console.log('2. Digite um comentário de teste');
    console.log('3. Clique no botão de publicar');
    console.log('\nPressione Enter no terminal quando quiser encerrar o debug...');
    
    // Loop para monitorar eventos e tirar screenshots
    let lastEventCount = 0;
    const checkInterval = 500; // Verificar a cada 500ms
    
    const monitoringPromise = new Promise(resolve => {
      const intervalId = setInterval(async () => {
        try {
          // Verificar se há novos eventos
          const currentEventCount = await page.evaluate(() => window._eventCounter || 0);
          
          if (currentEventCount > lastEventCount) {
            // Tirar screenshot para cada novo evento
            for (let i = lastEventCount + 1; i <= currentEventCount; i++) {
              // Pequena pausa para garantir que a ação foi concluída
              await page.waitForTimeout(500);
              
              // Obter tipo do evento
              const eventType = await page.evaluate(id => {
                const signal = document.getElementById(`event-signal-${id}`);
                return signal ? signal.getAttribute('data-event-type') : 'unknown';
              }, i);
              
              // Tirar screenshot
              await takeScreenshot(page, screenshotsDir, `evento-${i}-${eventType}`);
              
              // Remover o sinal do evento
              await page.evaluate(id => {
                const signal = document.getElementById(`event-signal-${id}`);
                if (signal) signal.remove();
              }, i);
            }
            
            lastEventCount = currentEventCount;
          }
        } catch (err) {
          console.error('Erro ao monitorar eventos:', err);
        }
      }, checkInterval);
      
      // Aguardar entrada do usuário para encerrar
      process.stdin.once('data', () => {
        clearInterval(intervalId);
        resolve();
      });
    });
    
    // Aguardar até que o usuário encerre o monitoramento
    await monitoringPromise;
    
    // Screenshot final
    await takeScreenshot(page, screenshotsDir, 'final');
    
    console.log('\n=== RESUMO DO DEBUG ===');
    console.log(`Total de eventos capturados: ${await page.evaluate(() => window._eventCounter || 0)}`);
    console.log(`Screenshots salvos em: ${screenshotsDir}`);
    
    // Capturar elementos importantes
    const elements = await capturePageElements(page);
    
    // Salvar elementos em um arquivo JSON
    const elementsPath = path.join(screenshotsDir, 'elementos-capturados.json');
    fs.writeFileSync(elementsPath, JSON.stringify(elements, null, 2));
    console.log(`Elementos da página salvos em: ${elementsPath}`);
    
    console.log('\nDebug concluído! Pressione Enter para fechar o navegador...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    console.error('Erro durante debug:', error);
    
    // Screenshot de erro
    await takeScreenshot(page, screenshotsDir, 'erro');
  } finally {
    // Fechar o navegador
    await browser.close();
    console.log('Debug finalizado.');
  }
}

/**
 * Tira um screenshot e salva com timestamp
 */
async function takeScreenshot(page, dir, prefix) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${prefix}-${timestamp}.png`;
  const filepath = path.join(dir, filename);
  
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`Screenshot salvo: ${filename}`);
  
  return filepath;
}

/**
 * Captura elementos importantes da página
 */
async function capturePageElements(page) {
  return await page.evaluate(() => {
    return {
      textareas: Array.from(document.querySelectorAll('textarea')).map(t => ({
        tagName: t.tagName,
        id: t.id,
        className: t.className,
        placeholder: t.placeholder,
        ariaLabel: t.getAttribute('aria-label')
      })),
      
      buttons: Array.from(document.querySelectorAll('button')).map(b => ({
        tagName: b.tagName,
        id: b.id,
        className: b.className,
        textContent: b.textContent.trim(),
        type: b.type,
        disabled: b.disabled,
        ariaLabel: b.getAttribute('aria-label')
      })),
      
      forms: Array.from(document.querySelectorAll('form')).map(f => ({
        id: f.id,
        className: f.className,
        role: f.getAttribute('role')
      })),
      
      inputs: Array.from(document.querySelectorAll('input')).map(i => ({
        tagName: i.tagName,
        id: i.id,
        className: i.className,
        type: i.type,
        placeholder: i.placeholder,
        ariaLabel: i.getAttribute('aria-label')
      }))
    };
  });
}

// Verificar argumentos da linha de comando
const shortcode = process.argv[2] || 'DKmyDswgyjh';

if (!shortcode) {
  console.log('Uso: node debug-with-screenshots.js <shortcode>');
  process.exit(1);
}

// Executar função de debug
debugWithScreenshots(shortcode)
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
