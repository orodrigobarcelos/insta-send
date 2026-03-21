const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getAuthFilePath } = require('./instagram-auth-state');
const { launchBrowser, setupResourceBlocking, handleInstagramChallenge } = require('./browser-config');

// Arquivo de autenticação
const AUTH_FILE = getAuthFilePath();

// Configuração da RapidAPI
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST = 'instagram-looter2.p.rapidapi.com';

/**
 * Obtém o shortcode da primeira postagem de um usuário do Instagram
 * @param {string} username - Nome de usuário do Instagram
 * @returns {Promise<string|null>} - Shortcode da primeira postagem ou null se não encontrar
 */
async function getFirstPostShortcode(username) {
  try {
    console.log(`Buscando primeira postagem do usuário: ${username}`);

    const url = `https://instagram-looter2.p.rapidapi.com/profile?username=${username}`;

    const response = await axios.request({
      method: 'GET',
      url: url,
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    console.log('Dados recebidos da API:', response.data);

    // Verificar se há postagens no perfil
    if (response.data &&
      response.data.edge_owner_to_timeline_media &&
      response.data.edge_owner_to_timeline_media.edges &&
      response.data.edge_owner_to_timeline_media.edges.length > 0) {

      // Pegar a primeira postagem
      const firstPost = response.data.edge_owner_to_timeline_media.edges[0];

      if (firstPost.node && firstPost.node.shortcode) {
        const shortcode = firstPost.node.shortcode;
        console.log(`Shortcode da primeira postagem: ${shortcode}`);
        return shortcode;
      }
    }

    console.log('Nenhuma postagem encontrada para este usuário');
    return null;
  } catch (error) {
    console.error('Erro ao buscar primeira postagem:', error);
    return null;
  }
}

/**
 * Comenta em uma postagem do Instagram usando o shortcode
 * @param {string} shortcode - Shortcode da postagem
 * @param {string} comment - Comentário a ser feito
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} - Resultado da operação
 */
async function commentOnPost(shortcode, comment, options = {}) {
  // Verificar se o arquivo de autenticação existe
  if (!fs.existsSync(AUTH_FILE)) {
    return {
      success: false,
      error: 'Arquivo de autenticação não encontrado. Execute instagram-auth-state.js primeiro.'
    };
  }

  console.log(`Iniciando comentário na postagem: ${shortcode}...`);

  // Opções padrão
  const headless = options.headless !== undefined ? options.headless : false;
  const slowMo = options.slowMo !== undefined ? options.slowMo : 50;

  // Iniciar o navegador com o estado de autenticação
  const browser = await launchBrowser({ headless, slowMo });

  const context = await browser.newContext({
    storageState: AUTH_FILE,
    locale: 'pt-BR'
  });

  const page = await context.newPage();
  await setupResourceBlocking(page);

  try {
    // Navegar para a página da postagem
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;
    console.log(`Acessando a postagem: ${postUrl}`);
    await page.goto(postUrl);

    // Aguardar carregamento e tratar telas de verificacao
    console.log('Aguardando carregamento da página...');
    await page.waitForTimeout(5000);
    await handleInstagramChallenge(page);

    // Tirar screenshot para debug
    const initialScreenshot = path.join(__dirname, 'post-initial.png');
    await page.screenshot({ path: initialScreenshot });
    console.log(`Screenshot inicial salvo em: ${initialScreenshot}`);

    // Tentar encontrar o campo de comentário usando vários seletores possíveis
    console.log('Procurando campo de comentário...');

    // Lista de possíveis seletores para o campo de comentário
    const commentFieldSelectors = [
      'textarea[placeholder="Adicione um comentário..."]',
      'textarea[aria-label="Adicione um comentário..."]',
      'form[role="presentation"] textarea',
      'section form textarea',
      'textarea',
      'form textarea'
    ];

    // Tentar cada seletor até encontrar um que funcione
    let commentField = null;
    let workingSelector = null;

    for (const selector of commentFieldSelectors) {
      console.log(`Tentando seletor: ${selector}`);
      commentField = await page.$(selector);
      if (commentField) {
        console.log(`Campo de comentário encontrado com seletor: ${selector}`);
        workingSelector = selector;
        break;
      }
    }

    if (!commentField) {
      // Se não encontrou pelos seletores, tentar pela função de avaliação
      console.log('Tentando encontrar campo de comentário por avaliação...');
      commentField = await page.evaluateHandle(() => {
        // Procurar por qualquer textarea na página
        const textareas = Array.from(document.querySelectorAll('textarea'));
        return textareas.find(t =>
          (t.placeholder && t.placeholder.toLowerCase().includes('coment')) ||
          (t.getAttribute('aria-label') && t.getAttribute('aria-label').toLowerCase().includes('coment'))
        ) || textareas[0]; // Pegar o primeiro se não encontrar específico
      });
    }

    if (!commentField) {
      throw new Error('Campo de comentário não encontrado');
    }

    // Clicar no campo de comentário
    try {
      await commentField.click();
      console.log('Campo de comentário clicado');
    } catch (e) {
      console.log('Erro ao clicar (pode já estar focado ou detatched):', e.message);
    }

    // Esperar possível re-render do React
    await page.waitForTimeout(1000);

    // Digitar o comentário
    console.log(`Digitando comentário: "${comment}"`);

    if (workingSelector) {
      // Se temos o seletor, usar page.fill que é mais robusto contra elementos que mudam
      await page.fill(workingSelector, comment);
    } else {
      // Se foi via evaluateHandle, tentar preencher no elemento (se ainda existir) ou focado
      try {
        await commentField.fill(comment);
      } catch (e) {
        console.log('Erro ao preencher elemento original, tentando no elemento focado...');
        await page.keyboard.type(comment);
      }
    }

    // Esperar um pouco para garantir que o botão de publicar esteja ativo
    await page.waitForTimeout(1500);

    // Tirar screenshot antes de publicar
    const beforeSubmitScreenshot = path.join(__dirname, 'before-submit.png');
    await page.screenshot({ path: beforeSubmitScreenshot });

    // Lista de possíveis seletores para o botão de publicar
    const submitButtonSelectors = [
      'form button[type="submit"]',
      'button[type="submit"]',
      'form[role="presentation"] button',
      'button:has-text("Publicar")',
      'button:has-text("Postar")',
      'button:has-text("Post")',
      'div[role="button"]:has-text("Publicar")',
      'div[role="button"]:has-text("Postar")',
      'div[role="button"]:has-text("Post")',
      'div.x1i10hfl[role="button"]' // Classe comum no Instagram
    ];

    // Tentar cada seletor até encontrar um que funcione
    let submitButton = null;
    for (const selector of submitButtonSelectors) {
      console.log(`Tentando seletor de botão: ${selector}`);
      submitButton = await page.$(selector);
      if (submitButton) {
        console.log(`Botão de publicar encontrado com seletor: ${selector}`);
        break;
      }
    }

    if (!submitButton) {
      // Se não encontrou pelos seletores, tentar pela função de avaliação
      console.log('Tentando encontrar botão de publicar por avaliação...');
      const handle = await page.evaluateHandle(() => {
        // Procurar por botões ou divs que pareçam ser de publicar
        const candidates = Array.from(document.querySelectorAll('button, div[role="button"]'));
        return candidates.find(b =>
          b.textContent && ['publicar', 'postar', 'post', 'comment'].some(text =>
            b.textContent.toLowerCase().trim() === text
          )
        );
      });

      if (handle) {
        submitButton = handle.asElement();
        if (!submitButton) {
          console.log('Handle encontrado mas não é um elemento válido');
        }
      }
    }

    if (!submitButton) {
      throw new Error('Botão de publicar não encontrado');
    }

    // Clicar no botão de publicar
    console.log('Publicando comentário...');
    await submitButton.click();

    // Esperar um pouco para garantir que o comentário foi publicado
    await page.waitForTimeout(3000);

    // Verificar se o comentário aparece na postagem
    const commentFound = await page.evaluate((text) => {
      // Tentar diferentes seletores para encontrar comentários
      const selectors = [
        'ul[role="list"] span',
        'ul span',
        'section span',
        'div[role="button"] span'
      ];

      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.some(el => el.textContent.includes(text))) {
          return true;
        }
      }

      return false;
    }, comment);

    if (commentFound) {
      console.log('Comentário publicado com sucesso!');
    } else {
      console.log('Comentário enviado, mas não foi possível confirmar na interface.');
    }

    // Tirar screenshot para verificação
    const screenshotPath = path.join(__dirname, 'comment-success.png');
    await page.screenshot({ path: screenshotPath });

    // Fechar o navegador
    await browser.close();

    return {
      success: true,
      message: `Comentário publicado na postagem ${shortcode}`,
      verified: commentFound,
      screenshotPath
    };

  } catch (error) {
    console.error('Erro ao comentar na postagem:', error);

    // Tirar screenshot em caso de erro
    const screenshotPath = path.join(__dirname, 'error-comment-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.error(`Screenshot de erro salvo em: ${screenshotPath}`);

    // Fechar o navegador
    await browser.close();

    return {
      success: false,
      error: error.message,
      screenshotPath
    };
  }
}

/**
 * Comenta na primeira postagem de um usuário do Instagram
 * @param {string} username - Nome de usuário do Instagram
 * @param {string} comment - Comentário a ser feito
 * @param {Object} options - Opções adicionais
 * @returns {Promise<Object>} - Resultado da operação
 */
async function commentOnFirstPost(username, comment, options = {}) {
  // Obter o shortcode da primeira postagem
  const shortcode = await getFirstPostShortcode(username);

  if (!shortcode) {
    return {
      success: false,
      error: `Não foi possível encontrar postagens para o usuário ${username}`
    };
  }

  // Comentar na postagem
  return commentOnPost(shortcode, comment, options);
}

// Exportar funções
module.exports = {
  getFirstPostShortcode,
  commentOnPost,
  commentOnFirstPost
};

// Se este script for executado diretamente
if (require.main === module) {
  // Verificar argumentos da linha de comando
  const args = process.argv.slice(2);
  let headless = false; // Padrão: navegador visível

  // Verificar se a opção --headless está presente
  const headlessIndex = args.indexOf('--headless');
  if (headlessIndex !== -1) {
    headless = true;
    // Remover a opção --headless dos argumentos
    args.splice(headlessIndex, 1);
  }

  if (args.length < 2) {
    console.log('Uso:');
    console.log('Para comentar na primeira postagem de um usuário:');
    console.log('  node instagram-post-commenter.js [--headless] username "Seu comentário aqui"');
    console.log('Para comentar em uma postagem específica:');
    console.log('  node instagram-post-commenter.js [--headless] --shortcode ABC123 "Seu comentário aqui"');
    process.exit(1);
  }

  // Verificar se estamos usando shortcode ou nome de usuário
  if (args[0] === '--shortcode') {
    if (args.length < 3) {
      console.log('Erro: Faltando shortcode ou comentário');
      process.exit(1);
    }

    const shortcode = args[1];
    const comment = args[2];

    commentOnPost(shortcode, comment, { headless })
      .then(result => {
        console.log('Resultado:', result);
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
      });
  } else {
    const username = args[0];
    const comment = args[1];

    commentOnFirstPost(username, comment, { headless })
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
