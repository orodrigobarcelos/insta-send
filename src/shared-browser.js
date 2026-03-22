const fs = require('fs');
const { launchBrowser, setupResourceBlocking, handleInstagramChallenge } = require('./browser-config');
const { getAuthFilePath } = require('./instagram-auth-state');

let browser = null;
let context = null;
let isInitializing = false;
let initPromise = null;

// Mutex: fila de operacoes para garantir que apenas uma roda por vez
const queue = [];
let busy = false;

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
 * Adquire o lock do mutex. Retorna uma promise que resolve
 * quando for a vez desta operacao executar.
 */
function acquireLock() {
  return new Promise((resolve) => {
    if (!busy) {
      busy = true;
      resolve();
    } else {
      queue.push(resolve);
      console.log(`[shared-browser] Operacao na fila (${queue.length} aguardando)`);
    }
  });
}

/**
 * Libera o lock do mutex. Se houver operacoes na fila,
 * a proxima e desbloqueada automaticamente.
 */
function releaseLock() {
  if (queue.length > 0) {
    const next = queue.shift();
    console.log(`[shared-browser] Liberando proxima operacao (${queue.length} ainda aguardando)`);
    next();
  } else {
    busy = false;
  }
}

/**
 * Retorna uma nova page do browser persistente.
 * Aguarda o mutex antes de criar a page (uma operacao por vez).
 * Ja aplica setupResourceBlocking na page.
 */
async function getPage() {
  await acquireLock();
  await init();
  const page = await context.newPage();
  await setupResourceBlocking(page);
  return page;
}

/**
 * Fecha uma page apos uso e libera o mutex.
 */
async function releasePage(page) {
  try {
    if (page && !page.isClosed()) {
      await page.close();
    }
  } catch (e) {
    // Page ja fechada ou browser desconectou
  } finally {
    releaseLock();
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
