const axios = require('axios');
const { launchBrowser, setupResourceBlocking } = require('./browser-config');
require('dotenv').config();

// Configuração da RapidAPI
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';

/**
 * Obtém o shortcode do primeiro post do usuário via RapidAPI (Scraper Stable)
 * @param {string} username - Nome de usuário do Instagram
 * @returns {Promise<Object>} - Objeto com resultado da operação
 */
async function getFirstPostShortcode(username) {
  try {
    console.log(`Buscando dados do perfil para: @${username} via Stable API`);

    // Endpoint da nova API Stable
    const url = `https://${RAPIDAPI_HOST}/get_ig_user_posts.php`;

    // Dados para envio via x-www-form-urlencoded
    const data = new URLSearchParams();
    data.append('username_or_url', username);
    data.append('amount', '3'); // Pede os 3 últimos posts

    const response = await axios.request({
      method: 'POST',
      url: url,
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: data
    });

    // Verificar se há postagens e encontrar o shortcode (JSON Path: $.posts[0].node.code)
    if (response.data &&
      response.data.posts &&
      response.data.posts.length > 0) {

      console.log(`Primeira postagem de @${username} encontrada`);

      const firstPostNode = response.data.posts[0].node;
      const shortcode = firstPostNode.code;
      const caption = firstPostNode.caption ? firstPostNode.caption.text : '';

      // Tenta pegar a imagem de capa (qualidade média [1] ou alta [0])
      let imageUrl = '';
      if (firstPostNode.image_versions2 && firstPostNode.image_versions2.candidates) {
        if (firstPostNode.image_versions2.candidates.length > 1) {
          imageUrl = firstPostNode.image_versions2.candidates[1].url;
        } else if (firstPostNode.image_versions2.candidates.length > 0) {
          imageUrl = firstPostNode.image_versions2.candidates[0].url;
        }
      }

      return {
        success: true,
        shortcode,
        postUrl: `https://www.instagram.com/p/${shortcode}/`,
        caption,
        imageUrl,
        postData: firstPostNode
      };
    } else {
      console.log(`Nenhuma postagem encontrada via API para @${username}. Tentando fallback com Playwright...`);
      // Fallback para Playwright
      return await getShortcodeWithPlaywright(username);
    }
  } catch (error) {
    console.error('Erro ao buscar dados do perfil via API:', error.message);
    if (error.response) console.error('Detalhes do erro API:', error.response.data);

    console.log('Tentando fallback com Playwright...');
    return await getShortcodeWithPlaywright(username);
  }
}

/**
 * Obtém o shortcode usando Playwright (scraping) como fallback
 */
async function getShortcodeWithPlaywright(username) {
  const path = require('path');
  const fs = require('fs');
  // Ajustar caminho para o arquivo de auth
  const AUTH_FILE = path.join(__dirname, 'instagram-auth.json');

  console.log(`Iniciando fallback via Playwright para @${username}...`);

  if (!fs.existsSync(AUTH_FILE)) {
    return {
      success: false,
      error: 'Arquivo de autenticação não encontrado para fallback.'
    };
  }

  let browser = null;
  try {
    browser = await launchBrowser({ headless: true });

    const context = await browser.newContext({
      storageState: AUTH_FILE,
      locale: 'pt-BR'
    });

    const page = await context.newPage();
    await setupResourceBlocking(page);

    // Ir para o perfil
    const profileUrl = `https://www.instagram.com/${username}/`;
    console.log(`Acessando perfil: ${profileUrl}`);
    await page.goto(profileUrl);

    // Esperar carregar
    await page.waitForTimeout(5000);

    // Tentar encontrar o primeiro post (link que contém /p/)
    // Seleciona todos os links
    const shortcode = await page.evaluate(() => {
      // Procura links que tenham /p/ na estrutura (posts)
      // Geralmente os posts estão em articles ou divs com role="presentation"
      const links = Array.from(document.querySelectorAll('a'));
      const postLink = links.find(a => a.href.includes('/p/'));

      if (postLink) {
        // Extrair o código: /p/CODE/
        const match = postLink.href.match(/\/p\/([^\/]+)/);
        return match ? match[1] : null;
      }
      return null;
    });

    if (shortcode) {
      console.log(`Shortcode encontrado via Playwright: ${shortcode}`);
      return {
        success: true,
        shortcode,
        postUrl: `https://www.instagram.com/p/${shortcode}/`,
        method: 'playwright-fallback'
      };
    } else {
      // Tentar tirar screenshot para debug se falhar
      const debugPath = path.join(__dirname, 'debug-fallback-fail.png');
      await page.screenshot({ path: debugPath });
      console.log(`Falha no fallback. Screenshot salvo em: ${debugPath}`);
      return {
        success: false,
        error: 'Shortcode não encontrado via scraping',
        debugScreenshot: debugPath
      };
    }

  } catch (error) {
    console.error('Erro no fallback Playwright:', error);
    return {
      success: false,
      error: `Erro no fallback: ${error.message}`
    };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  getFirstPostShortcode
};
