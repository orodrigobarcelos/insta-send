/**
 * Versão que funcionou - baseada no que o consultor disse
 * Usa apenas click() e type() sem fill()
 */

const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');
const { launchBrowser, setupResourceBlocking, handleInstagramChallenge } = require('./browser-config');

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

  // Se page foi fornecida externamente (browser persistente), usar ela
  const externalPage = options.page || null;
  let browser = null;
  let page;

  if (externalPage) {
    page = externalPage;
  } else {
    const headless = options.headless !== undefined ? options.headless : false;
    const slowMo = options.slowMo !== undefined ? options.slowMo : 100;
    browser = await launchBrowser({ headless, slowMo });
    const context = await browser.newContext({
      storageState: AUTH_FILE,
      locale: 'pt-BR'
    });
    page = await context.newPage();
    await setupResourceBlocking(page);
  }

  try {
    // 1. Acessar Post
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`Acessando: ${postUrl}`);
    await page.goto(postUrl);

    // Aguardar carregamento
    await page.waitForTimeout(5000);

    // Tratar telas de verificacao do Instagram
    await handleInstagramChallenge(page);

    try {
      await page.waitForSelector('textarea, article', { timeout: 15000 });
    } catch (e) { console.log('Seletores iniciais nao detectados em 15s, prosseguindo...'); }

    // 2. Encontrar Campo de Comentário
    console.log('Procurando campo de comentário...');

    const commentSelectors = [
      'textarea[placeholder="Adicione um comentário..."]',
      'textarea[aria-label="Adicione um comentário..."]',
      'textarea[placeholder="Add a comment…"]',
      'textarea[aria-label="Add a comment…"]',
      'textarea[placeholder="Add a comment..."]',
      'textarea[aria-label="Add a comment..."]',
      'form[role="presentation"] textarea',
      'textarea'
    ];

    let commentField = null;
    let workingSelector = null;

    for (const selector of commentSelectors) {
      try {
        commentField = await page.$(selector);
        if (commentField) {
          console.log(`Campo encontrado com: ${selector}`);
          workingSelector = selector;
          break;
        }
      } catch (e) { continue; }
    }

    // Fallback via evaluate se não achar por seletor
    if (!commentField) {
      console.log('Tentando encontrar via evaluateHandle...');
      commentField = await page.evaluateHandle(() => {
        const textareas = Array.from(document.querySelectorAll('textarea'));
        return textareas.find(t =>
          t.placeholder?.includes('coment') ||
          t.getAttribute('aria-label')?.includes('coment')
        ) || textareas[0];
      });
    }

    if (!commentField) {
      throw new Error('Campo de comentário não encontrado');
    }

    // 3. Clicar no campo para ativar (React recria o textarea ao focar)
    try {
      await commentField.click();
      await page.waitForTimeout(1500);
    } catch (e) {
      console.log('Erro ao clicar (pode já estar focado/detached):', e.message);
    }

    // Re-query do textarea após React re-render (elemento original pode ter sido destruído)
    let activeField = null;
    if (workingSelector) {
      activeField = await page.$(workingSelector);
    }
    if (!activeField) {
      activeField = await page.$('textarea');
    }

    // Garantir foco no campo atualizado
    if (activeField) {
      await activeField.click();
      await page.waitForTimeout(500);
    }

    console.log(`Digitando: "${comment}"`);

    // Usar type() — dispara eventos React corretamente
    await page.keyboard.type(comment, { delay: 30 });
    await page.waitForTimeout(1000);

    // Verificar se o texto entrou no campo
    const fieldValue = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      return ta ? ta.value : '(textarea não encontrada)';
    });
    console.log(`Valor no campo após digitar: "${fieldValue}" (${fieldValue.length} chars)`);

    if (!fieldValue || fieldValue.length === 0) {
      console.log('ALERTA: keyboard.type() não inseriu texto! Tentando fallback com fill()...');
      if (activeField) {
        await activeField.fill(comment);
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000);

    // 4. Submeter o comentário
    // Estratégia 1: Enter (funciona na maioria das versões do Instagram web)
    console.log('Tentando submeter via Enter...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    // Verificar se funcionou (campo limpo = sucesso)
    const fieldAfterEnter = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      return ta ? ta.value : '';
    });

    if (fieldAfterEnter.length > 0) {
      // Enter não funcionou, tentar clicar no botão
      console.log('Enter não submeteu. Procurando botão Publicar...');

      const buttonSelectors = [
        'div[role="button"]:has-text("Publicar")',
        'button:has-text("Publicar")',
        'div[role="button"]:has-text("Postar")',
        'button:has-text("Postar")',
        'div[role="button"]:has-text("Post")',
        'button:has-text("Post")',
        'form button[type="submit"]',
        'button[type="submit"]'
      ];

      let postButton = null;
      for (const selector of buttonSelectors) {
        postButton = await page.$(selector);
        if (postButton) {
          console.log(`Botão encontrado: ${selector}`);
          break;
        }
      }

      if (postButton) {
        // Tentar click normal
        await postButton.click({ force: true });
        await page.waitForTimeout(3000);

        // Se ainda não limpou, tentar via JavaScript
        const fieldAfterClick = await page.evaluate(() => {
          const ta = document.querySelector('textarea');
          return ta ? ta.value : '';
        });

        if (fieldAfterClick.length > 0) {
          console.log('Click no botão não funcionou. Tentando via JavaScript...');
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('div[role="button"], button'));
            const postBtn = btns.find(el =>
              ['publicar', 'postar', 'post'].includes(el.textContent.trim().toLowerCase())
            );
            if (postBtn) {
              postBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            }
          });
          await page.waitForTimeout(4000);
        }
      } else {
        console.log('Botão de publicar não encontrado, tentando form submit...');
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.requestSubmit();
        });
        await page.waitForTimeout(4000);
      }
    } else {
      console.log('Comentário submetido via Enter com sucesso!');
    }

    // 5. Verificar Sucesso e Erros

    // Checar se apareceu mensagem de erro (Toast/Alert)
    const errorToast = await page.evaluate(() => {
      const toast = document.querySelector('div[role="dialog"] h3, div[role="alert"], div.x12lqup9');
      return toast ? toast.innerText : null;
    });

    if (errorToast && (errorToast.toLowerCase().includes('tente') || errorToast.toLowerCase().includes('bloqueado') || errorToast.toLowerCase().includes('community'))) {
      throw new Error(`Instagram bloqueou a ação: ${errorToast}`);
    }

    // Verificar se comentário aparece na página
    const commentFound = await page.evaluate((cmt) => {
      return document.body.innerText.includes(cmt);
    }, comment);

    // Checar se campo de texto foi limpo (indicativo de sucesso) ou se sumiu
    const isFieldEmpty = await page.evaluate((selector) => {
      if (!selector) return true; // Se não capturou seletor, assumimos sucesso pelo fluxo
      const el = document.querySelector(selector);
      return el ? el.value === '' : true; // Se sumiu ou tá vazio, é bom sinal
    }, workingSelector || 'textarea');

    if (browser) await browser.close();

    // Critério de sucesso: Achou o texto OU (Não achou erro E Campo limpou)
    const success = commentFound || isFieldEmpty;

    if (!success) {
      throw new Error('O comentário não apareceu e o campo de texto não foi limpo. Provável falha silenciosa.');
    }

    return {
      success: true,
      message: commentFound ? 'Comentário publicado e verificado!' : 'Comentário enviado (campo limpo), mas não visualizado imediatamente.',
      verified: commentFound,
      postUrl,
      shortcode,
      warning: !commentFound ? 'Comentário não encontrado visualmente, verificar no App.' : null
    };

  } catch (error) {
    console.error('Erro:', error.message);
    const screenshotPath = path.join(__dirname, 'error-working-approach.png');
    await page.screenshot({ path: screenshotPath }).catch(() => {});
    if (browser) await browser.close();

    return {
      success: false,
      error: error.message,
      screenshotPath,
      postUrl: `https://www.instagram.com/p/${shortcode}/`,
      shortcode
    }
  }
}

module.exports = { commentOnPost };
