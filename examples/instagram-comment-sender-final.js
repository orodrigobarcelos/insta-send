/**
 * Instagram Comment Sender - Versão Final
 * Implementação baseada nas dicas do consultor com seletores em português
 */

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

    // Esperar o post carregar e o campo de comentário aparecer (seletor em português)
    await page.waitForSelector('textarea[placeholder="Adicionar um comentário..."]', { timeout: 30000 });

    // Clicar no campo e digitar o comentário (evitando fill() que causa erro de DOM)
    console.log(`Digitando comentário: "${comment}"`);
    await page.click('textarea[placeholder="Adicionar um comentário..."]');
    await page.type('textarea[placeholder="Adicionar um comentário..."]', comment, { delay: 50 });

    // Pequeno delay pra garantir que o botão "Postar" ative (às vezes demora)
    await page.waitForTimeout(1000);

    // Clicar no botão "Postar" (seletor baseado no texto em português)
    console.log('Clicando em "Postar"...');
    await page.getByText('Postar').click();

    // Esperar para confirmar envio
    await page.waitForTimeout(3000);

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
      postUrl,
      shortcode
    };

  } catch (error) {
    console.error('Erro ao comentar:', error);

    const screenshotPath = path.join(__dirname, 'error-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot de erro salvo em: ${screenshotPath}`);

    await browser.close();

    return {
      success: false,
      error: error.message,
      screenshotPath,
      postUrl,
      shortcode
    };
  }
}

module.exports = { commentOnPost };
