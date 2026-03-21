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

  // Adicionar proxy se configurado via variaveis de ambiente
  const proxyHost = process.env.PROXY_HOST;
  const proxyPort = process.env.PROXY_PORT;
  if (proxyHost && proxyPort) {
    config.proxy = {
      server: `http://${proxyHost}:${proxyPort}`,
      username: process.env.PROXY_USER || '',
      password: process.env.PROXY_PASS || ''
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

module.exports = { launchBrowser, setupResourceBlocking };
