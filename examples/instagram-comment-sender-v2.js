const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

const AUTH_FILE = getAuthFilePath();

/**
 * Comenta em um post específico do Instagram usando o shortcode - Versão robusta
 * @param {string} shortcode - Shortcode do post (ex: 'DKmyDswgyjh')
 * @param {string} comment - Comentário a ser enviado
 * @param {Object} options - Opções como headless e slowMo
 * @returns {Promise<Object>} - Resultado da operação
 */
async function commentOnPost(shortcode, comment, options = {}) {
  if (!fs.existsSync(AUTH_FILE)) {
    return {
      success: false,
      error: 'Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.'
    };
  }

  console.log(`Iniciando comentário no post com shortcode: ${shortcode}...`);

  const headless = options.headless !== undefined ? options.headless : false;
  const slowMo = options.slowMo !== undefined ? options.slowMo : 50;
  const maxRetries = options.maxRetries || 3;

  const browser = await chromium.launch({ 
    headless,
    slowMo
  });

  const context = await browser.newContext({
    storageState: AUTH_FILE
  });

  const page = await context.newPage();

  try {
    // Navegar diretamente para o post usando o shortcode
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`Acessando o post: ${postUrl}`);
    
    // Função para tentar comentar com várias tentativas
    async function attemptToComment(retries = maxRetries) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`Tentativa ${attempt} de ${retries} para comentar...`);
        
        try {
          // Navegar para a página a cada tentativa para garantir estado limpo
          if (attempt > 1) {
            await page.goto(postUrl, { waitUntil: 'networkidle' });
          } else {
            await page.goto(postUrl);
            await page.waitForLoadState('networkidle');
          }
          
          // Esperar carregamento completo
          await page.waitForTimeout(3000);
          
          // Tirar screenshot do estado inicial
          const initialScreenshot = path.join(__dirname, `attempt-${attempt}-initial.png`);
          await page.screenshot({ path: initialScreenshot });
          console.log(`Screenshot inicial da tentativa ${attempt} salvo em: ${initialScreenshot}`);
          
          // Lista de possíveis seletores para o campo de comentário
          const commentFieldSelectors = [
            'textarea[placeholder="Adicione um comentário..."]',
            'textarea[placeholder="Add a comment..."]',
            'textarea[aria-label="Adicione um comentário..."]',
            'textarea[aria-label="Add a comment..."]',
            'form[role="presentation"] textarea',
            'section form textarea',
            'textarea',
            'form textarea'
          ];
          
          // Tentar encontrar o campo de comentário
          let commentField = null;
          let workingSelector = null;
          
          for (const selector of commentFieldSelectors) {
            console.log(`Tentando seletor: ${selector}`);
            try {
              await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
              
              // Verificar se o elemento está realmente disponível e conectado ao DOM
              const isConnected = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el && document.body.contains(el);
              }, selector);
              
              if (isConnected) {
                console.log(`Seletor válido encontrado: ${selector}`);
                commentField = await page.$(selector);
                workingSelector = selector;
                break;
              }
            } catch (e) {
              console.log(`Seletor ${selector} não encontrado ou erro: ${e.message}`);
            }
          }
          
          if (!commentField) {
            console.log('Campo de comentário não encontrado, tentando novamente...');
            continue;
          }
          
          // Tentar digitar o comentário com diferentes métodos
          console.log(`Digitando comentário: "${comment}"`);
          let commentTyped = false;
          
          // Estratégia 1: Usar JavaScript direto para definir o valor com múltiplas abordagens
          console.log('Tentativa 1: Usando JavaScript direto para definir valor...');
          const jsSuccess = await page.evaluate((selector, text) => {
            try {
              const textarea = document.querySelector(selector);
              if (textarea && document.body.contains(textarea)) {
                // Focar no elemento primeiro
                textarea.focus();
                textarea.click();
                
                // Aguardar um pouco para garantir que o foco foi estabelecido
                setTimeout(() => {
                  // Limpar qualquer conteúdo existente
                  textarea.value = '';
                  textarea.innerHTML = '';
                  
                  // Definir o valor usando múltiplas propriedades
                  textarea.value = text;
                  textarea.textContent = text;
                  
                  // Disparar eventos de input em sequência
                  textarea.dispatchEvent(new Event('focus', { bubbles: true }));
                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  textarea.dispatchEvent(new Event('change', { bubbles: true }));
                  textarea.dispatchEvent(new Event('keyup', { bubbles: true }));
                  
                  // Verificar se o valor foi definido
                  console.log('Valor definido:', textarea.value);
                }, 100);
                
                return true;
              }
              return false;
            } catch (e) {
              console.error('Erro no JavaScript direto:', e);
              return false;
            }
          }, workingSelector, comment);
          
          if (jsSuccess) {
            console.log('✅ JavaScript direto funcionou!');
            // Aguardar um pouco para garantir que o valor foi processado
            await page.waitForTimeout(1000);
            commentTyped = true;
          }
          
          // Estratégia 2: Se o JavaScript direto falhar, tentar método Playwright com novo handle
          if (!jsSuccess) {
            console.log('Tentativa 2: Usando método Playwright com novo handle...');
            try {
              // Obter um novo handle do elemento para garantir que está conectado
              const freshCommentField = await page.$(workingSelector);
              if (freshCommentField) {
                // Verificar se está conectado antes de interagir
                const isConnected = await page.evaluate(el => document.body.contains(el), freshCommentField);
                if (isConnected) {
                  // Tentar preencher o campo usando JavaScript direto
                  await page.evaluate((el, text) => {
                    el.focus();
                    el.value = text;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                  }, freshCommentField, comment);
                  commentTyped = true;
                  console.log('✅ Comentário digitado com método fill (novo handle)');
                }
              }
            } catch (fillError) {
              console.log(`Erro ao usar fill com novo handle: ${fillError.message}`);
            }
          }
          
          // Estratégia 3: Tentar método de digitação caractere por caractere
          if (!commentTyped && !jsSuccess) {
            console.log('Tentativa 3: Usando keyboard.type...');
            try {
              // Obter outro handle fresco
              const freshCommentField = await page.$(workingSelector);
              if (freshCommentField) {
                await freshCommentField.click();
                await page.keyboard.type(comment, { delay: 50 });
                commentTyped = true;
                console.log('✅ Comentário digitado com keyboard.type');
              }
            } catch (typeError) {
              console.log(`Erro ao usar keyboard.type: ${typeError.message}`);
            }
          }
          
          // Verificar se algum método funcionou
          if (!jsSuccess && !commentTyped) {
            console.log('Não foi possível digitar o comentário, tentando próxima tentativa...');
            continue;
          }
          
          console.log('✅ Comentário inserido com sucesso!');
          
          // Tirar screenshot antes de publicar
          const beforeSubmitScreenshot = path.join(__dirname, `attempt-${attempt}-before-submit.png`);
          await page.screenshot({ path: beforeSubmitScreenshot });
          console.log(`Screenshot antes de enviar salvo em: ${beforeSubmitScreenshot}`);
          
          // Tentar encontrar e clicar no botão de publicar
          let buttonClicked = false;
          
          // Método 1: Usar JavaScript diretamente (mais confiável para elementos que podem se desconectar)
          try {
            buttonClicked = await page.evaluate(() => {
              try {
                // Estratégia 1: Procurar botões com texto específico
                const buttonTexts = ['Postar', 'Post', 'Publicar', 'Comment'];
                const buttons = Array.from(document.querySelectorAll('button'));
                
                for (const button of buttons) {
                  const text = button.textContent || '';
                  if (buttonTexts.some(btnText => text.includes(btnText))) {
                    // Verificar se o botão está visível
                    const rect = button.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                      button.click();
                      return true;
                    }
                  }
                }
                
                // Estratégia 2: Procurar o botão no formulário que contém o textarea
                const textarea = document.querySelector('textarea');
                if (textarea) {
                  // Navegar até o formulário pai
                  let parent = textarea.parentElement;
                  while (parent && parent.tagName !== 'FORM' && parent !== document.body) {
                    parent = parent.parentElement;
                  }
                  
                  if (parent && parent.tagName === 'FORM') {
                    // Encontrar o botão dentro do formulário
                    const formButton = parent.querySelector('button');
                    if (formButton) {
                      formButton.click();
                      return true;
                    }
                  }
                  
                  // Estratégia 3: Procurar botão próximo ao textarea
                  let currentNode = textarea;
                  while (currentNode && currentNode !== document.body) {
                    const nearbyButton = currentNode.querySelector('button');
                    if (nearbyButton) {
                      nearbyButton.click();
                      return true;
                    }
                    currentNode = currentNode.parentElement;
                  }
                }
                
                // Estratégia 4: Procurar botão com atributo de envio
                const submitButtons = document.querySelectorAll('button[type="submit"]');
                if (submitButtons.length > 0) {
                  submitButtons[0].click();
                  return true;
                }
                
                return false;
              } catch (e) {
                console.error('Erro ao clicar no botão via JS:', e);
                return false;
              }
            });
            
            if (buttonClicked) {
              console.log('Clicou no botão via JavaScript direto');
            }
          } catch (btnError1) {
            console.log(`Erro ao executar JavaScript para clicar: ${btnError1.message}`);
          }
          
          // Método 2: Usar getByText se o JavaScript falhar
          if (!buttonClicked) {
            try {
              const postarButton = page.getByText('Postar', { exact: true });
              if (await postarButton.isVisible()) {
                await postarButton.click();
                buttonClicked = true;
                console.log('Clicou no botão "Postar" com getByText');
              }
            } catch (btnError2) {
              console.log(`Erro ao clicar com getByText: ${btnError2.message}`);
            }
          }
          
          // Método 3: Tentar clicar usando seletores específicos
          if (!buttonClicked) {
            const buttonSelectors = [
              'button[type="submit"]',
              'form button',
              'section form button',
              'button'
            ];
            
            for (const selector of buttonSelectors) {
              try {
                const button = await page.$(selector);
                if (button) {
                  await button.click();
                  buttonClicked = true;
                  console.log(`Clicou no botão com seletor: ${selector}`);
                  break;
                }
              } catch (btnError3) {
                console.log(`Erro ao clicar com seletor ${selector}: ${btnError3.message}`);
              }
            }
          }
          
          // Se conseguiu clicar no botão, esperar e verificar
          if (buttonClicked) {
            console.log('Aguardando confirmação do envio...');
            await page.waitForTimeout(5000);
            
            // Tirar screenshot final
            const finalScreenshot = path.join(__dirname, `attempt-${attempt}-final.png`);
            await page.screenshot({ path: finalScreenshot });
            
            // Verificar se o comentário aparece
            const commentFound = await page.evaluate((cmt) => {
              const elements = Array.from(document.querySelectorAll('span'));
              return elements.some(el => el.textContent.includes(cmt));
            }, comment);
            
            if (commentFound) {
              console.log('Comentário enviado e verificado com sucesso!');
              return {
                success: true,
                message: `Comentário enviado no post ${shortcode}`,
                verified: true,
                attempt,
                screenshotPath: finalScreenshot
              };
            } else {
              console.log('Botão clicado, mas comentário não encontrado na página');
            }
          } else {
            console.log('Não foi possível clicar no botão de publicar');
          }
          
        } catch (attemptError) {
          console.log(`Erro na tentativa ${attempt}: ${attemptError.message}`);
        }
        
        // Esperar antes da próxima tentativa
        if (attempt < retries) {
          console.log(`Aguardando 5 segundos antes da próxima tentativa...`);
          await page.waitForTimeout(5000);
        }
      }
      
      // Se chegou aqui, todas as tentativas falharam
      const errorScreenshot = path.join(__dirname, 'all-attempts-failed.png');
      await page.screenshot({ path: errorScreenshot });
      
      return {
        success: false,
        error: `Não foi possível comentar após ${retries} tentativas`,
        screenshotPath: errorScreenshot
      };
    }
    
    // Executar a função de tentativas
    const result = await attemptToComment();
    await browser.close();
    return result;
    
  } catch (error) {
    console.error('Erro fatal ao comentar:', error);
    
    const screenshotPath = path.join(__dirname, 'error-fatal-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    
    await browser.close();
    
    return {
      success: false,
      error: `Erro fatal: ${error.message}`,
      screenshotPath
    };
  }
}

// Exportar a função
module.exports = {
  commentOnPost
};

// Para executar diretamente via linha de comando
if (require.main === module) {
  const args = process.argv.slice(2);
  let headless = false;
  
  // Verificar flags
  const headlessIndex = args.indexOf('--headless');
  if (headlessIndex !== -1) {
    headless = true;
    args.splice(headlessIndex, 1);
  }
  
  if (args.length < 2) {
    console.log('Uso: node instagram-comment-sender-v2.js [--headless] shortcode "Seu comentário aqui"');
    process.exit(1);
  }
  
  const shortcode = args[0];
  const comment = args[1];
  
  commentOnPost(shortcode, comment, { headless })
    .then(result => {
      console.log('Resultado:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Erro fatal:', err);
      process.exit(1);
    });
}
