const { chromium } = require('playwright');

/**
 * Lanca o browser Playwright com proxy (se configurado) e args de seguranca
 * @param {Object} options - {headless, slowMo}
 * @returns {Promise<Browser>}
 */
async function launchBrowser(options = {}) {
  const config = {
    headless: options.headless !== undefined ? options.headless : true,
    slowMo: options.slowMo !== undefined ? options.slowMo : 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  // Modo visual para login via noVNC
  if (options.visual) {
    config.headless = false;
    if (!process.env.DISPLAY) process.env.DISPLAY = ':99';
    config.args.push('--window-position=0,0', '--window-size=1280,720', '--disable-infobars', '--hide-scrollbars');
  }

  // Adicionar proxy: prioridade para options.proxy, fallback para env
  const proxyHost = options.proxy?.host || process.env.PROXY_HOST;
  const proxyPort = options.proxy?.port || process.env.PROXY_PORT;
  if (proxyHost && proxyPort) {
    config.proxy = {
      server: `http://${proxyHost}:${proxyPort}`,
      username: options.proxy?.user || process.env.PROXY_USER || '',
      password: options.proxy?.pass || process.env.PROXY_PASS || ''
    };
    console.log(`Proxy configurado: ${proxyHost}:${proxyPort}`);
  }

  return await chromium.launch(config);
}

/**
 * Bloqueia imagens, fontes e videos para economizar banda do proxy
 * Chamar APOS criar a page e ANTES de navegar
 * @param {Page} page - Pagina do Playwright
 */
async function setupResourceBlocking(page) {
  await page.route('**/*.{png,jpg,jpeg,gif,webp,mp4,webm}', route => route.abort());
}

/**
 * Detecta e trata telas de verificacao do Instagram (ex: "Continuar como...")
 * Chamar APOS page.goto() e waitForTimeout inicial
 * @param {Page} page - Pagina do Playwright
 */
async function handleInstagramChallenge(page) {
  try {
    // Tela "Continuar como [usuario]"
    const continueBtn = await page.$('button:has-text("Continuar"), div[role="button"]:has-text("Continuar")');
    if (continueBtn) {
      console.log('Tela de verificacao detectada: "Continuar como..." — clicando...');
      await continueBtn.click();
      await page.waitForTimeout(5000);
      return true;
    }

    // Tela "Salvar informacoes de login"
    const saveInfoBtn = await page.$('button:has-text("Agora não"), button:has-text("Ahora no"), button:has-text("Not Now")');
    if (saveInfoBtn) {
      console.log('Tela "Salvar informacoes" detectada — clicando "Agora não"...');
      await saveInfoBtn.click();
      await page.waitForTimeout(3000);
      return true;
    }

    // Tela de notificacoes
    const notifBtn = await page.$('button:has-text("Agora não"), button:has-text("Not Now")');
    if (notifBtn) {
      console.log('Tela de notificacoes detectada — clicando "Agora não"...');
      await notifBtn.click();
      await page.waitForTimeout(3000);
      return true;
    }
  } catch (e) {
    console.log('Nenhuma tela de verificacao detectada.');
  }
  return false;
}

module.exports = { launchBrowser, setupResourceBlocking, handleInstagramChallenge };
