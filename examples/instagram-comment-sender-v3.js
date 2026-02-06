/**
 * Instagram Comment Sender v3 - Versão totalmente JavaScript
 * Esta versão usa apenas JavaScript puro para interagir com elementos,
 * evitando completamente os métodos Playwright que causam erro de elemento desconectado
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

const AUTH_FILE = getAuthFilePath();

/**
 * Comenta em uma postagem do Instagram usando apenas JavaScript puro
 * @param {string} shortcode - Shortcode da postagem
 * @param {string} comment - Texto do comentário
 * @param {Object} options - Opções de configuração
 * @returns {Promise<Object>} Resultado da operação
 */
async function commentOnPost(shortcode, comment, options = {}) {
  const {
    headless = false,
    maxRetries = 3,
    screenshotOnError = true,
    screenshotOnSuccess = false
  } = options;

  console.log(`\n=== INICIANDO COMENTÁRIO ===`);
  console.log(`Shortcode: ${shortcode}`);
  console.log(`Comentário: "${comment}"`);
  console.log(`Tentativas máximas: ${maxRetries}`);

  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error('Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.');
  }

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 100
  });

  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  try {
    // Navegar para a postagem
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`\nAcessando: ${postUrl}`);
    await page.goto(postUrl);

    // Aguardar carregamento completo
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Tentar comentar com múltiplas tentativas
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n--- TENTATIVA ${attempt}/${maxRetries} ---`);

      try {
        // Usar JavaScript puro para encontrar e interagir com elementos
        const result = await page.evaluate((commentText) => {
          return new Promise((resolve) => {
            try {
              console.log('Procurando campo de comentário...');
              
              // Lista de seletores para o campo de comentário
              const commentSelectors = [
                'textarea[placeholder*="comentário"]',
                'textarea[placeholder*="comment"]',
                'textarea[aria-label*="comentário"]',
                'textarea[aria-label*="comment"]',
                'form textarea',
                'textarea'
              ];

              let commentField = null;
              let workingSelector = null;

              // Encontrar o campo de comentário
              for (const selector of commentSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                  if (element.offsetParent !== null && document.body.contains(element)) {
                    commentField = element;
                    workingSelector = selector;
                    console.log(`Campo encontrado com seletor: ${selector}`);
                    break;
                  }
                }
                if (commentField) break;
              }

              if (!commentField) {
                resolve({ success: false, error: 'Campo de comentário não encontrado' });
                return;
              }

              console.log('Inserindo comentário...');
              
              // Focar no campo
              commentField.focus();
              commentField.click();

              // Aguardar um pouco para garantir foco
              setTimeout(() => {
                try {
                  // Limpar campo
                  commentField.value = '';
                  commentField.textContent = '';

                  // Inserir texto
                  commentField.value = commentText;
                  commentField.textContent = commentText;

                  // Disparar eventos necessários
                  const events = ['focus', 'input', 'change', 'keyup'];
                  events.forEach(eventType => {
                    commentField.dispatchEvent(new Event(eventType, { bubbles: true }));
                  });

                  console.log(`Texto inserido: "${commentField.value}"`);

                  // Aguardar um pouco antes de procurar o botão
                  setTimeout(() => {
                    try {
                      console.log('Procurando botão de publicar...');

                      // Lista de estratégias para encontrar o botão
                      const strategies = [
                        // Estratégia 1: Botões com texto específico
                        () => {
                          const buttonTexts = ['Postar', 'Post', 'Publicar', 'Comment'];
                          const buttons = Array.from(document.querySelectorAll('button'));
                          
                          for (const button of buttons) {
                            const text = (button.textContent || '').trim();
                            if (buttonTexts.some(btnText => text.includes(btnText))) {
                              const rect = button.getBoundingClientRect();
                              if (rect.width > 0 && rect.height > 0 && button.offsetParent !== null) {
                                console.log(`Botão encontrado com texto: "${text}"`);
                                return button;
                              }
                            }
                          }
                          return null;
                        },

                        // Estratégia 2: Botão no mesmo formulário do textarea
                        () => {
                          let parent = commentField.parentElement;
                          while (parent && parent !== document.body) {
                            const button = parent.querySelector('button[type="submit"], button:not([type])');
                            if (button && button.offsetParent !== null) {
                              console.log('Botão encontrado no formulário');
                              return button;
                            }
                            parent = parent.parentElement;
                          }
                          return null;
                        },

                        // Estratégia 3: Botão próximo ao textarea
                        () => {
                          const container = commentField.closest('div, section, form');
                          if (container) {
                            const buttons = container.querySelectorAll('button');
                            for (const button of buttons) {
                              if (button.offsetParent !== null) {
                                console.log('Botão encontrado próximo ao textarea');
                                return button;
                              }
                            }
                          }
                          return null;
                        }
                      ];

                      let submitButton = null;
                      for (const strategy of strategies) {
                        submitButton = strategy();
                        if (submitButton) break;
                      }

                      if (!submitButton) {
                        resolve({ success: false, error: 'Botão de publicar não encontrado' });
                        return;
                      }

                      console.log('Clicando no botão...');
                      submitButton.click();

                      // Aguardar para verificar se o comentário foi enviado
                      setTimeout(() => {
                        // Verificar se o comentário aparece na página
                        const commentElements = document.querySelectorAll('span, div');
                        let commentFound = false;
                        
                        for (const element of commentElements) {
                          if (element.textContent && element.textContent.includes(commentText)) {
                            commentFound = true;
                            break;
                          }
                        }

                        resolve({
                          success: true,
                          commentFound,
                          message: commentFound ? 'Comentário enviado e encontrado na página' : 'Comentário enviado (verificação pendente)'
                        });
                      }, 3000);

                    } catch (buttonError) {
                      resolve({ success: false, error: `Erro ao clicar no botão: ${buttonError.message}` });
                    }
                  }, 1000);

                } catch (insertError) {
                  resolve({ success: false, error: `Erro ao inserir texto: ${insertError.message}` });
                }
              }, 500);

            } catch (error) {
              resolve({ success: false, error: `Erro geral: ${error.message}` });
            }
          });
        }, comment);

        console.log('Resultado da tentativa:', result);

        if (result.success) {
          console.log(`✅ SUCESSO na tentativa ${attempt}!`);
          
          if (screenshotOnSuccess) {
            const successScreenshot = path.join(__dirname, `success-comment-${shortcode}-${Date.now()}.png`);
            await page.screenshot({ path: successScreenshot });
            console.log(`Screenshot de sucesso salvo em: ${successScreenshot}`);
          }

          await browser.close();
          return {
            success: true,
            message: result.message,
            commentFound: result.commentFound,
            attempt,
            shortcode,
            postUrl
          };
        } else {
          console.log(`❌ Falha na tentativa ${attempt}: ${result.error}`);
          
          if (attempt < maxRetries) {
            console.log('Recarregando página para próxima tentativa...');
            await page.reload();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
          }
        }

      } catch (attemptError) {
        console.log(`❌ Erro na tentativa ${attempt}: ${attemptError.message}`);
        
        if (attempt < maxRetries) {
          console.log('Recarregando página para próxima tentativa...');
          await page.reload();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    console.log(`❌ FALHA após ${maxRetries} tentativas`);
    
    if (screenshotOnError) {
      const errorScreenshot = path.join(__dirname, `error-comment-${shortcode}-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot });
      console.log(`Screenshot de erro salvo em: ${errorScreenshot}`);
    }

    await browser.close();
    return {
      success: false,
      error: `Falha após ${maxRetries} tentativas`,
      shortcode,
      postUrl
    };

  } catch (error) {
    console.error('Erro fatal:', error);
    
    if (screenshotOnError) {
      const fatalErrorScreenshot = path.join(__dirname, `fatal-error-${shortcode}-${Date.now()}.png`);
      await page.screenshot({ path: fatalErrorScreenshot });
      console.log(`Screenshot de erro fatal salvo em: ${fatalErrorScreenshot}`);
    }

    await browser.close();
    throw error;
  }
}

module.exports = { commentOnPost };
