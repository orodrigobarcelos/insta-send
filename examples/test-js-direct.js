/**
 * Script para testar a interação direta via JavaScript com os elementos do Instagram
 * Esta abordagem evita o uso de métodos Playwright que podem falhar com elementos desconectados
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

const AUTH_FILE = getAuthFilePath();
const SHORTCODE = 'DGI3xifsi15'; // Shortcode de teste
const TEST_COMMENT = 'Teste de comentário via JavaScript direto ' + new Date().toISOString();

async function testJavaScriptDirect() {
  console.log('='.repeat(50));
  console.log('TESTE DE COMENTÁRIO VIA JAVASCRIPT DIRETO');
  console.log('='.repeat(50));
  
  if (!fs.existsSync(AUTH_FILE)) {
    console.error('Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.');
    return;
  }
  
  console.log(`\nIniciando teste para shortcode: ${SHORTCODE}`);
  console.log(`Comentário: "${TEST_COMMENT}"`);
  
  const browser = await chromium.launch({
    headless: false, // Modo visível para depuração
    slowMo: 100 // Desacelerar para visualização
  });
  
  const context = await browser.newContext({
    storageState: AUTH_FILE,
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navegar para o post
    const postUrl = `https://www.instagram.com/p/${SHORTCODE}/`;
    console.log(`\nAcessando o post: ${postUrl}`);
    await page.goto(postUrl);
    
    // Esperar carregamento completo
    console.log('Aguardando carregamento da página...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Tirar screenshot inicial
    const initialScreenshot = path.join(__dirname, 'js-direct-initial.png');
    await page.screenshot({ path: initialScreenshot });
    console.log(`Screenshot inicial salvo em: ${initialScreenshot}`);
    
    // Usar JavaScript direto para encontrar o campo de comentário
    console.log('\nProcurando campo de comentário via JavaScript...');
    
    const commentFieldFound = await page.evaluate(() => {
      // Lista de possíveis seletores
      const selectors = [
        'textarea[placeholder="Adicione um comentário..."]',
        'textarea[placeholder="Add a comment..."]',
        'textarea[aria-label="Adicione um comentário..."]',
        'textarea[aria-label="Add a comment..."]',
        'form[role="presentation"] textarea',
        'section form textarea',
        'textarea'
      ];
      
      // Verificar cada seletor
      for (const selector of selectors) {
        console.log(`Tentando seletor: ${selector}`);
        const element = document.querySelector(selector);
        
        if (element && document.body.contains(element)) {
          // Armazenar o seletor que funcionou para uso posterior
          window.__workingSelector = selector;
          return true;
        }
      }
      
      return false;
    });
    
    if (!commentFieldFound) {
      console.log('❌ Campo de comentário não encontrado!');
      const errorScreenshot = path.join(__dirname, 'js-direct-no-field.png');
      await page.screenshot({ path: errorScreenshot });
      console.log(`Screenshot salvo em: ${errorScreenshot}`);
      return;
    }
    
    console.log('✅ Campo de comentário encontrado!');
    
    // Digitar o comentário usando JavaScript direto
    console.log(`\nDigitando comentário via JavaScript: "${TEST_COMMENT}"`);
    
    const commentTyped = await page.evaluate((comment) => {
      try {
        const selector = window.__workingSelector;
        if (!selector) return false;
        
        const textarea = document.querySelector(selector);
        if (!textarea || !document.body.contains(textarea)) return false;
        
        // Focar no elemento
        textarea.focus();
        
        // Limpar qualquer texto existente
        textarea.value = '';
        
        // Definir o valor
        textarea.value = comment;
        
        // Disparar eventos para garantir que o Instagram reconheça a entrada
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        return true;
      } catch (e) {
        console.error('Erro ao digitar comentário:', e);
        return false;
      }
    }, TEST_COMMENT);
    
    if (!commentTyped) {
      console.log('❌ Não foi possível digitar o comentário!');
      const errorScreenshot = path.join(__dirname, 'js-direct-typing-failed.png');
      await page.screenshot({ path: errorScreenshot });
      console.log(`Screenshot salvo em: ${errorScreenshot}`);
      return;
    }
    
    console.log('✅ Comentário digitado com sucesso!');
    
    // Tirar screenshot após digitar
    const afterTypingScreenshot = path.join(__dirname, 'js-direct-after-typing.png');
    await page.screenshot({ path: afterTypingScreenshot });
    console.log(`Screenshot após digitar salvo em: ${afterTypingScreenshot}`);
    
    // Clicar no botão de publicar usando JavaScript direto
    console.log('\nProcurando e clicando no botão de publicar via JavaScript...');
    
    const buttonClicked = await page.evaluate(() => {
      try {
        // Estratégia 1: Procurar botões com texto específico
        const buttonTexts = ['Postar', 'Post', 'Publicar', 'Comment'];
        const buttons = Array.from(document.querySelectorAll('button'));
        
        for (const button of buttons) {
          const text = button.textContent || '';
          if (buttonTexts.some(btnText => text.includes(btnText))) {
            // Verificar se o botão está visível
            const rect = button.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              console.log(`Encontrado botão com texto: ${text}`);
              button.click();
              return true;
            }
          }
        }
        
        // Estratégia 2: Procurar o botão no formulário que contém o textarea
        const textarea = document.querySelector(window.__workingSelector);
        if (textarea) {
          // Navegar até o formulário pai
          let parent = textarea.parentElement;
          while (parent && parent.tagName !== 'FORM' && parent !== document.body) {
            parent = parent.parentElement;
          }
          
          if (parent && parent.tagName === 'FORM') {
            // Encontrar o botão dentro do formulário
            const formButton = parent.querySelector('button');
            if (formButton) {
              console.log('Encontrado botão no formulário');
              formButton.click();
              return true;
            }
          }
          
          // Estratégia 3: Procurar botão próximo ao textarea
          let currentNode = textarea;
          while (currentNode && currentNode !== document.body) {
            const nearbyButton = currentNode.querySelector('button');
            if (nearbyButton) {
              console.log('Encontrado botão próximo ao textarea');
              nearbyButton.click();
              return true;
            }
            currentNode = currentNode.parentElement;
          }
        }
        
        // Estratégia 4: Procurar botão com atributo de envio
        const submitButtons = document.querySelectorAll('button[type="submit"]');
        if (submitButtons.length > 0) {
          console.log('Encontrado botão de envio');
          submitButtons[0].click();
          return true;
        }
        
        return false;
      } catch (e) {
        console.error('Erro ao clicar no botão:', e);
        return false;
      }
    });
    
    if (!buttonClicked) {
      console.log('❌ Não foi possível clicar no botão de publicar!');
      const errorScreenshot = path.join(__dirname, 'js-direct-button-failed.png');
      await page.screenshot({ path: errorScreenshot });
      console.log(`Screenshot salvo em: ${errorScreenshot}`);
      return;
    }
    
    console.log('✅ Botão clicado com sucesso!');
    
    // Aguardar para verificar se o comentário foi publicado
    console.log('\nAguardando confirmação do envio...');
    await page.waitForTimeout(5000);
    
    // Tirar screenshot final
    const finalScreenshot = path.join(__dirname, 'js-direct-final.png');
    await page.screenshot({ path: finalScreenshot });
    console.log(`Screenshot final salvo em: ${finalScreenshot}`);
    
    // Verificar se o comentário aparece na página
    const commentFound = await page.evaluate((comment) => {
      try {
        const elements = Array.from(document.querySelectorAll('span'));
        return elements.some(el => el.textContent.includes(comment));
      } catch (e) {
        return false;
      }
    }, TEST_COMMENT);
    
    if (commentFound) {
      console.log('\n✅ TESTE BEM-SUCEDIDO! Comentário encontrado na página.');
    } else {
      console.log('\n⚠️ Comentário não encontrado na página, mas o processo foi concluído sem erros.');
    }
    
    // Aguardar entrada do usuário para fechar
    console.log('\nPressione Enter para fechar o navegador...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    console.error('\n❌ ERRO DURANTE O TESTE:', error);
    
    // Screenshot de erro
    const errorScreenshot = path.join(__dirname, 'js-direct-error.png');
    await page.screenshot({ path: errorScreenshot });
    console.log(`Screenshot de erro salvo em: ${errorScreenshot}`);
  } finally {
    // Fechar o navegador
    await browser.close();
    console.log('\nTeste finalizado.');
  }
}

// Executar o teste
testJavaScriptDirect().catch(console.error);
