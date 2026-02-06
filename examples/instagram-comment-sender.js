const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

const AUTH_FILE = getAuthFilePath();

/**
 * Comenta em um post específico do Instagram usando o shortcode
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
    await page.goto(postUrl);

    // Esperar o post carregar e o campo de comentário aparecer
    console.log('Aguardando carregamento da página e campo de comentário...');
    
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
    
    // Tentar cada seletor até encontrar um que funcione
    let commentField = null;
    for (const selector of commentFieldSelectors) {
      console.log(`Tentando seletor: ${selector}`);
      try {
        // Usar waitForSelector com timeout menor para cada tentativa
        await page.waitForSelector(selector, { timeout: 5000 });
        commentField = await page.$(selector);
        if (commentField) {
          console.log(`Campo de comentário encontrado com seletor: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`Seletor ${selector} não encontrado, tentando próximo...`);
      }
    }

    // Se não encontrou o campo de comentário com nenhum seletor
    if (!commentField) {
      // Tirar screenshot para debug
      const errorScreenshot = path.join(__dirname, 'comment-field-not-found.png');
      await page.screenshot({ path: errorScreenshot });
      
      throw new Error(`Campo de comentário não encontrado. Screenshot salvo em: ${errorScreenshot}`);
    }

    // Digitar o comentário
    console.log(`Digitando comentário: "${comment}"`);
    await commentField.fill(comment);

    // Tirar screenshot antes de publicar
    const beforeSubmitScreenshot = path.join(__dirname, 'before-submit.png');
    await page.screenshot({ path: beforeSubmitScreenshot });
    console.log(`Screenshot antes de enviar salvo em: ${beforeSubmitScreenshot}`);

    // Tentar encontrar o botão de publicar de várias maneiras
    console.log('Procurando botão de publicar...');
    
    try {
      // Método 1: Tentar encontrar pelo texto exato "Postar"
      console.log('Tentando encontrar botão com texto "Postar"');
      const postarButton = await page.getByText('Postar', { exact: true });
      if (await postarButton.isVisible()) {
        console.log('Botão "Postar" encontrado com getByText!');
        await postarButton.click();
        console.log('Clicou no botão "Postar"');
        await page.waitForTimeout(1000); // Pequena pausa para confirmar o clique
      } else {
        console.log('Botão "Postar" não está visível');
        
        // Método 2: Tentar localizar por texto parcial
        console.log('Tentando localizar botão com texto parcial');
        const buttons = await page.$$('button');
        let clicked = false;
        
        for (const button of buttons) {
          const buttonText = await button.textContent();
          console.log(`Botão encontrado com texto: "${buttonText}"`);
          
          if (buttonText && (buttonText.includes('Postar') || buttonText.includes('Post') || 
                            buttonText.includes('Publicar') || buttonText.includes('Comment'))) {
            console.log(`Clicando no botão com texto: "${buttonText}"`);
            await button.click();
            clicked = true;
            break;
          }
        }
        
        // Método 3: Se ainda não conseguiu clicar, tenta usar JavaScript direto
        if (!clicked) {
          console.log('Tentando clicar via JavaScript...');
          await page.evaluate(() => {
            // Tenta encontrar botões por texto
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitButton = buttons.find(b => {
              const text = b.textContent || '';
              return text.includes('Postar') || text.includes('Post') || 
                     text.includes('Publicar') || text.includes('Comment');
            });
            
            if (submitButton) {
              submitButton.click();
              return true;
            }
            
            // Se não encontrar por texto, tenta o botão após o campo de comentário
            const textarea = document.querySelector('textarea[placeholder="Adicione um comentário..."]');
            if (textarea) {
              const form = textarea.closest('form');
              if (form) {
                const button = form.querySelector('button');
                if (button) {
                  button.click();
                  return true;
                }
              }
            }
            
            return false;
          });
          console.log('Tentativa de clique via JavaScript concluída');
        }
      }
    } catch (e) {
      console.log(`Erro ao tentar clicar no botão: ${e.message}`);
      
      // Método 4: Último recurso - tentar enviar com Enter no campo de comentário
      console.log('Tentando enviar com Enter no campo de comentário...');
      try {
        // Obter o campo de comentário novamente para garantir que está conectado ao DOM
        const freshCommentField = await page.$('textarea[placeholder="Adicione um comentário..."]');
        if (freshCommentField) {
          await freshCommentField.press('Enter');
          console.log('Pressionou Enter no campo de comentário');
        } else {
          console.log('Campo de comentário não encontrado para pressionar Enter');
        }
      } catch (enterError) {
        console.log(`Erro ao pressionar Enter: ${enterError.message}`);
      }
    }

    // Esperar para confirmar envio
    await page.waitForTimeout(3000);

    // Tirar screenshot final
    const finalScreenshot = path.join(__dirname, 'comment-sent.png');
    await page.screenshot({ path: finalScreenshot });
    console.log(`Screenshot final salvo em: ${finalScreenshot}`);

    // Verificar se o comentário aparece (busca por spans com o texto)
    const commentFound = await page.evaluate((cmt) => {
      const elements = Array.from(document.querySelectorAll('span'));
      return elements.some(el => el.textContent.includes(cmt));
    }, comment);

    if (commentFound) {
      console.log('Comentário enviado e verificado com sucesso!');
    } else {
      console.log('Comentário enviado, mas não foi possível confirmar na interface.');
    }

    await browser.close();

    return {
      success: true,
      message: `Comentário enviado no post ${shortcode}`,
      verified: commentFound,
      screenshotPath: finalScreenshot
    };

  } catch (error) {
    console.error('Erro ao comentar:', error);

    const screenshotPath = path.join(__dirname, 'error-comment-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot de erro salvo em: ${screenshotPath}`);

    await browser.close();

    return {
      success: false,
      error: error.message,
      screenshotPath
    };
  }
}

/**
 * Comenta no primeiro post (mais recente) de um usuário do Instagram
 * @param {string} username - Nome de usuário do Instagram (sem @)
 * @param {string} comment - Comentário a ser enviado
 * @param {Object} options - Opções como headless e slowMo
 * @returns {Promise<Object>} - Resultado da operação
 */
async function commentOnFirstPost(username, comment, options = {}) {
  if (!fs.existsSync(AUTH_FILE)) {
    return {
      success: false,
      error: 'Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.'
    };
  }

  console.log(`Iniciando comentário no primeiro post de @${username}...`);

  const headless = options.headless !== undefined ? options.headless : false;
  const slowMo = options.slowMo !== undefined ? options.slowMo : 50;

  const browser = await chromium.launch({ 
    headless,
    slowMo
  });

  const context = await browser.newContext({
    storageState: AUTH_FILE
  });

  const page = await context.newPage();

  try {
    // Navegar para o perfil do usuário
    console.log(`Acessando perfil: @${username}`);
    await page.goto(`https://www.instagram.com/${username}/`);

    // Esperar os posts carregarem (seletor para a grade de posts)
    await page.waitForSelector('a[href^="/p/"]', { timeout: 30000 });

    // Encontrar e clicar no primeiro post (o mais recente, top-left na grade)
    console.log('Clicando no primeiro post...');
    const firstPostLink = await page.locator('a[href^="/p/"]').first();
    
    // Extrair o shortcode do link antes de clicar
    const href = await firstPostLink.getAttribute('href');
    const shortcode = href.split('/p/')[1].replace(/\//g, '');
    console.log(`Shortcode do primeiro post: ${shortcode}`);
    
    await firstPostLink.click();

    // Usar a mesma lógica de comentar em post por shortcode
    // Esperar o post carregar e o campo de comentário aparecer
    console.log('Aguardando carregamento da página e campo de comentário...');
    
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
    
    // Tentar cada seletor até encontrar um que funcione
    let commentField = null;
    for (const selector of commentFieldSelectors) {
      console.log(`Tentando seletor: ${selector}`);
      try {
        // Usar waitForSelector com timeout menor para cada tentativa
        await page.waitForSelector(selector, { timeout: 5000 });
        commentField = await page.$(selector);
        if (commentField) {
          console.log(`Campo de comentário encontrado com seletor: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`Seletor ${selector} não encontrado, tentando próximo...`);
      }
    }

    // Se não encontrou o campo de comentário com nenhum seletor
    if (!commentField) {
      // Tirar screenshot para debug
      const errorScreenshot = path.join(__dirname, 'comment-field-not-found.png');
      await page.screenshot({ path: errorScreenshot });
      
      throw new Error(`Campo de comentário não encontrado. Screenshot salvo em: ${errorScreenshot}`);
    }

    // Digitar o comentário
    console.log(`Digitando comentário: "${comment}"`);
    await commentField.fill(comment);

    // Tirar screenshot antes de publicar
    const beforeSubmitScreenshot = path.join(__dirname, 'before-submit.png');
    await page.screenshot({ path: beforeSubmitScreenshot });
    console.log(`Screenshot antes de enviar salvo em: ${beforeSubmitScreenshot}`);

    // Tentar encontrar o botão de publicar de várias maneiras
    console.log('Procurando botão de publicar...');
    
    try {
      // Método 1: Tentar encontrar pelo texto exato "Postar"
      console.log('Tentando encontrar botão com texto "Postar"');
      const postarButton = await page.getByText('Postar', { exact: true });
      if (await postarButton.isVisible()) {
        console.log('Botão "Postar" encontrado com getByText!');
        await postarButton.click();
        console.log('Clicou no botão "Postar"');
        await page.waitForTimeout(1000); // Pequena pausa para confirmar o clique
      } else {
        console.log('Botão "Postar" não está visível');
        
        // Método 2: Tentar localizar por texto parcial
        console.log('Tentando localizar botão com texto parcial');
        const buttons = await page.$$('button');
        let clicked = false;
        
        for (const button of buttons) {
          const buttonText = await button.textContent();
          console.log(`Botão encontrado com texto: "${buttonText}"`);
          
          if (buttonText && (buttonText.includes('Postar') || buttonText.includes('Post') || 
                            buttonText.includes('Publicar') || buttonText.includes('Comment'))) {
            console.log(`Clicando no botão com texto: "${buttonText}"`);
            await button.click();
            clicked = true;
            break;
          }
        }
        
        // Método 3: Se ainda não conseguiu clicar, tenta usar JavaScript direto
        if (!clicked) {
          console.log('Tentando clicar via JavaScript...');
          await page.evaluate(() => {
            // Tenta encontrar botões por texto
            const buttons = Array.from(document.querySelectorAll('button'));
            const submitButton = buttons.find(b => {
              const text = b.textContent || '';
              return text.includes('Postar') || text.includes('Post') || 
                     text.includes('Publicar') || text.includes('Comment');
            });
            
            if (submitButton) {
              submitButton.click();
              return true;
            }
            
            // Se não encontrar por texto, tenta o botão após o campo de comentário
            const textarea = document.querySelector('textarea[placeholder="Adicione um comentário..."]');
            if (textarea) {
              const form = textarea.closest('form');
              if (form) {
                const button = form.querySelector('button');
                if (button) {
                  button.click();
                  return true;
                }
              }
            }
            
            return false;
          });
          console.log('Tentativa de clique via JavaScript concluída');
        }
      }
    } catch (e) {
      console.log(`Erro ao tentar clicar no botão: ${e.message}`);
      
      // Método 4: Último recurso - tentar enviar com Enter no campo de comentário
      console.log('Tentando enviar com Enter no campo de comentário...');
      try {
        // Obter o campo de comentário novamente para garantir que está conectado ao DOM
        const freshCommentField = await page.$('textarea[placeholder="Adicione um comentário..."]');
        if (freshCommentField) {
          await freshCommentField.press('Enter');
          console.log('Pressionou Enter no campo de comentário');
        } else {
          console.log('Campo de comentário não encontrado para pressionar Enter');
        }
      } catch (enterError) {
        console.log(`Erro ao pressionar Enter: ${enterError.message}`);
      }
    }

    // Esperar para confirmar envio
    await page.waitForTimeout(3000);

    // Tirar screenshot final
    const finalScreenshot = path.join(__dirname, 'comment-sent.png');
    await page.screenshot({ path: finalScreenshot });
    console.log(`Screenshot final salvo em: ${finalScreenshot}`);

    // Verificar se o comentário aparece (busca por spans com o texto)
    const commentFound = await page.evaluate((cmt) => {
      const elements = Array.from(document.querySelectorAll('span'));
      return elements.some(el => el.textContent.includes(cmt));
    }, comment);

    if (commentFound) {
      console.log('Comentário enviado e verificado com sucesso!');
    } else {
      console.log('Comentário enviado, mas não foi possível confirmar na interface.');
    }

    await browser.close();

    return {
      success: true,
      message: `Comentário enviado no primeiro post de @${username} (shortcode: ${shortcode})`,
      verified: commentFound,
      shortcode,
      screenshotPath: finalScreenshot
    };

  } catch (error) {
    console.error('Erro ao comentar:', error);

    const screenshotPath = path.join(__dirname, 'error-comment-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot de erro salvo em: ${screenshotPath}`);

    await browser.close();

    return {
      success: false,
      error: error.message,
      screenshotPath
    };
  }
}

// Exportar as funções
module.exports = {
  commentOnPost,
  commentOnFirstPost
};

// Para executar diretamente via linha de comando
if (require.main === module) {
  const args = process.argv.slice(2);
  let headless = false;
  let mode = 'shortcode'; // padrão: comentar por shortcode

  // Verificar flags
  const headlessIndex = args.indexOf('--headless');
  if (headlessIndex !== -1) {
    headless = true;
    args.splice(headlessIndex, 1);
  }

  const userModeIndex = args.indexOf('--user');
  if (userModeIndex !== -1) {
    mode = 'user';
    args.splice(userModeIndex, 1);
  }

  if (args.length < 2) {
    if (mode === 'shortcode') {
      console.log('Uso: node instagram-comment-sender.js [--headless] [--user] shortcode "Seu comentário aqui"');
    } else {
      console.log('Uso: node instagram-comment-sender.js [--headless] [--user] username "Seu comentário aqui"');
    }
    process.exit(1);
  }

  const target = args[0]; // shortcode ou username
  const comment = args[1];

  if (mode === 'user') {
    commentOnFirstPost(target, comment, { headless })
      .then(result => {
        console.log('Resultado:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
      });
  } else {
    commentOnPost(target, comment, { headless })
      .then(result => {
        console.log('Resultado:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
      });
  }
}
