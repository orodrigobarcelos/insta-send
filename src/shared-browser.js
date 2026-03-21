const fs = require('fs');
const { launchBrowser, setupResourceBlocking, handleInstagramChallenge } = require('./browser-config');
const { getAuthFilePath } = require('./instagram-auth-state');

let browser = null;
let context = null;
let isInitializing = false;
let initPromise = null;

/**
 * Inicializa o browser persistente com sessao autenticada.
 * Se ja estiver inicializado, retorna imediatamente.
 * Se estiver em processo de inicializacao, aguarda.
 */
async function init() {
  if (browser && browser.isConnected()) return;

  // Evitar inicializacao duplicada
  if (isInitializing && initPromise) return initPromise;

  isInitializing = true;
  initPromise = _doInit();
  try {
    await initPromise;
  } finally {
    isInitializing = false;
    initPromise = null;
  }
}

async function _doInit() {
  const AUTH_FILE = getAuthFilePath();

  console.log('[shared-browser] Iniciando browser persistente...');
  browser = await launchBrowser({ headless: true, slowMo: 50 });

  // Detectar desconexao e limpar
  browser.on('disconnected', () => {
    console.log('[shared-browser] Browser desconectou. Sera reiniciado no proximo uso.');
    browser = null;
    context = null;
  });

  // Criar contexto com sessao se disponivel
  const contextOptions = { locale: 'pt-BR' };
  if (fs.existsSync(AUTH_FILE)) {
    contextOptions.storageState = AUTH_FILE;
  }
  context = await browser.newContext(contextOptions);

  console.log('[shared-browser] Browser persistente pronto.');
}

/**
 * Retorna uma nova page do browser persistente.
 * Inicializa o browser se necessario (auto-recovery).
 * Ja aplica setupResourceBlocking na page.
 */
async function getPage() {
  await init();
  const page = await context.newPage();
  await setupResourceBlocking(page);
  return page;
}

/**
 * Fecha uma page apos uso.
 */
async function releasePage(page) {
  try {
    if (page && !page.isClosed()) {
      await page.close();
    }
  } catch (e) {
    // Page ja fechada ou browser desconectou
  }
}

/**
 * Fecha o browser persistente (usado no shutdown).
 */
async function shutdown() {
  if (browser) {
    console.log('[shared-browser] Encerrando browser persistente...');
    await browser.close().catch(() => {});
    browser = null;
    context = null;
  }
}

module.exports = { init, getPage, releasePage, shutdown };
