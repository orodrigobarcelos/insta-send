/**
 * Versão que funcionou - baseada no que o consultor disse
 * Usa apenas click() e type() sem fill()
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

const AUTH_FILE = getAuthFilePath();

async function commentOnPost(shortcode, comment, options = {}) {
  if (!fs.existsSync(AUTH_FILE)) {
    return {
      success: false,
      error: 'Arquivo de autenticação não encontrado.'
    };
  }

  console.log(`Comentando no post: ${shortcode}`);
  console.log(`Comentário: "${comment}"`);

  const headless = options.headless !== undefined ? options.headless : false;
  const slowMo = options.slowMo !== undefined ? options.slowMo : 100;

  const browser = await chromium.launch({ 
    headless,
    slowMo
  });

  const context = await browser.newContext({
    storageState: AUTH_FILE
  });

  const page = await context.newPage();

  try {
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`Acessando: ${postUrl}`);
    await page.goto(postUrl);

    // Aguardar carregamento
    await page.waitForTimeout(5000);

    // Procurar campo de comentário em português
    console.log('Procurando campo de comentário...');
    
    // Tentar múltiplos seletores
    const selectors = [
      'textarea[placeholder="Adicionar um comentário..."]',
      'textarea[placeholder="Add a comment..."]',
      'textarea[aria-label="Adicionar um comentário..."]',
      'textarea[aria-label="Add a comment..."]',
      'textarea'
    ];

    let commentField = null;
    for (const selector of selectors) {
      try {
        commentField = await page.waitForSelector(selector, { timeout: 5000 });
        if (commentField) {
          console.log(`Campo encontrado com: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!commentField) {
      throw new Error('Campo de comentário não encontrado');
    }

    // Clicar no campo primeiro
    console.log('Clicando no campo...');
    await commentField.click();
    await page.waitForTimeout(1000);

    // Limpar campo e digitar - SEM usar fill()
    console.log('Digitando comentário...');
    await page.keyboard.press('Control+a'); // Selecionar tudo
    await page.keyboard.press('Delete'); // Deletar
    await page.keyboard.type(comment, { delay: 50 }); // Digitar

    await page.waitForTimeout(1500);

    // Procurar botão Postar
    console.log('Procurando botão Postar...');
    
    const buttonSelectors = [
      'button:has-text("Postar")',
      'button:has-text("Post")',
      'div[role="button"]:has-text("Postar")',
      'div[role="button"]:has-text("Post")'
    ];

    let postButton = null;
    for (const selector of buttonSelectors) {
      try {
        postButton = await page.waitForSelector(selector, { timeout: 3000 });
        if (postButton) {
          console.log(`Botão encontrado com: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!postButton) {
      throw new Error('Botão Postar não encontrado');
    }

    console.log('Clicando em Postar...');
    await postButton.click();

    // Aguardar envio
    await page.waitForTimeout(3000);

    // Verificar se comentário aparece
    const commentFound = await page.evaluate((cmt) => {
      const elements = Array.from(document.querySelectorAll('span, div'));
      return elements.some(el => el.textContent && el.textContent.includes(cmt));
    }, comment);

    await browser.close();

    return {
      success: true,
      message: `Comentário enviado no post ${shortcode}`,
      verified: commentFound,
      postUrl,
      shortcode
    };

  } catch (error) {
    console.error('Erro:', error.message);

    const screenshotPath = path.join(__dirname, 'error-working-approach.png');
    await page.screenshot({ path: screenshotPath });

    await browser.close();

    return {
      success: false,
      error: error.message,
      screenshotPath,
      postUrl: `https://www.instagram.com/p/${shortcode}/`,
      shortcode
    };
  }
}

module.exports = { commentOnPost };
