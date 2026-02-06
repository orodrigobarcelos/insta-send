const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Arquivo onde salvaremos o estado de autenticação
const AUTH_FILE = path.join(__dirname, 'instagram-auth.json');

/**
 * Salva o estado de autenticação do Instagram após login manual
 * Isso só precisa ser executado uma vez, ou quando os cookies expirarem
 */
async function saveAuthState() {
  console.log('Iniciando processo de salvamento de estado de autenticação...');
  
  // Inicia o navegador em modo visível para permitir interação manual
  const browser = await chromium.launch({ 
    headless: false, // Navegador visível
    slowMo: 50 // Torna as ações mais lentas para visualização
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navega para o Instagram
  await page.goto('https://www.instagram.com/');
  console.log('Página do Instagram carregada');
  
  // Instruções para o usuário
  console.log('\n==== INSTRUÇÕES ====');
  console.log('1. Faça login manualmente na sua conta do Instagram');
  console.log('2. Navegue um pouco pelo Instagram para garantir que a sessão está ativa');
  console.log('3. O estado será salvo automaticamente após 2 minutos');
  console.log('4. Você pode fechar o navegador após ver a mensagem "Estado de autenticação salvo"');
  console.log('=====================\n');
  
  // Espera 2 minutos para dar tempo ao usuário de fazer login manualmente
  console.log('Aguardando 2 minutos para você fazer login...');
  await page.waitForTimeout(120000); // 2 minutos
  
  // Verifica se parece estar logado
  const isLoggedIn = await page.evaluate(() => {
    // Se não encontrarmos o formulário de login, provavelmente estamos logados
    return !document.querySelector('input[name="username"]');
  });
  
  if (!isLoggedIn) {
    console.error('ERRO: Parece que você não fez login. Tente novamente.');
    await browser.close();
    return false;
  }
  
  // Salva o estado (cookies, localStorage, etc)
  await context.storageState({ path: AUTH_FILE });
  console.log(`Estado de autenticação salvo em: ${AUTH_FILE}`);
  
  // Fecha o navegador
  await browser.close();
  console.log('Navegador fechado. Processo concluído!');
  
  return true;
}

/**
 * Testa se o estado de autenticação salvo funciona
 */
async function testAuthState() {
  if (!fs.existsSync(AUTH_FILE)) {
    console.error(`Arquivo de autenticação não encontrado: ${AUTH_FILE}`);
    console.error('Execute saveAuthState() primeiro');
    return false;
  }
  
  console.log('Testando estado de autenticação salvo...');
  
  // Inicia o navegador usando o estado salvo
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: AUTH_FILE
  });
  
  const page = await context.newPage();
  
  // Navega para o Instagram
  await page.goto('https://www.instagram.com/');
  
  // Espera um pouco para verificar se estamos logados
  await page.waitForTimeout(5000);
  
  // Verifica se estamos logados
  const isLoggedIn = await page.evaluate(() => {
    return !document.querySelector('input[name="username"]');
  });
  
  if (isLoggedIn) {
    console.log('SUCESSO: Estado de autenticação funciona corretamente!');
    
    // Navega para a página de DM para confirmar acesso
    await page.goto('https://www.instagram.com/direct/inbox/');
    await page.waitForTimeout(5000);
    
    console.log('Verificando acesso à caixa de entrada de mensagens...');
    
    // Fecha o navegador após 10 segundos
    await page.waitForTimeout(10000);
    await browser.close();
    
    return true;
  } else {
    console.error('ERRO: Não foi possível fazer login com o estado salvo.');
    console.error('O estado pode ter expirado. Execute saveAuthState() novamente.');
    
    await browser.close();
    return false;
  }
}

// Exporta as funções para uso em outros scripts
module.exports = {
  saveAuthState,
  testAuthState,
  getAuthFilePath: () => AUTH_FILE
};

// Se este script for executado diretamente
if (require.main === module) {
  // Verifica se já existe um arquivo de autenticação
  if (fs.existsSync(AUTH_FILE)) {
    console.log(`Arquivo de autenticação encontrado: ${AUTH_FILE}`);
    console.log('Testando se o estado ainda é válido...');
    
    testAuthState()
      .then(isValid => {
        if (!isValid) {
          console.log('\nO estado de autenticação expirou ou é inválido.');
          console.log('Iniciando processo para salvar novo estado...\n');
          return saveAuthState();
        }
      })
      .catch(err => {
        console.error('Erro:', err);
      });
  } else {
    console.log('Nenhum arquivo de autenticação encontrado.');
    console.log('Iniciando processo para salvar estado...\n');
    
    saveAuthState()
      .catch(err => {
        console.error('Erro:', err);
      });
  }
}
