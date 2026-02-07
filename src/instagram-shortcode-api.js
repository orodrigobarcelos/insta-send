const axios = require('axios');
require('dotenv').config();

// Configuração da RapidAPI
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'instagram-looter2.p.rapidapi.com';

/**
 * Obtém o shortcode do primeiro post do usuário via RapidAPI
 * @param {string} username - Nome de usuário do Instagram
 * @returns {Promise<Object>} - Objeto com resultado da operação
 */
async function getFirstPostShortcode(username) {
  try {
    console.log(`Buscando dados do perfil para: @${username}`);

    const url = `https://instagram-looter2.p.rapidapi.com/profile?username=${username}`;

    const response = await axios.request({
      method: 'GET',
      url: url,
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    // Verificar se há postagens e encontrar o shortcode
    if (response.data &&
      response.data.edge_owner_to_timeline_media &&
      response.data.edge_owner_to_timeline_media.edges &&
      response.data.edge_owner_to_timeline_media.edges.length > 0) {

      console.log(`Primeira postagem de @${username} encontrada`);
      const firstPost = response.data.edge_owner_to_timeline_media.edges[0].node;
      const shortcode = firstPost.shortcode;

      return {
        success: true,
        shortcode,
        postUrl: `https://www.instagram.com/p/${shortcode}/`,
        postData: firstPost
      };
    } else {
      console.log(`Nenhuma postagem encontrada via API para @${username}. Tentando fallback com Playwright...`);
      // Fallback para Playwright
      return await getShortcodeWithPlaywright(username);
    }
  } catch (error) {
    console.error('Erro ao buscar dados do perfil via API:', error.message);
    console.log('Tentando fallback com Playwright...');
    return await getShortcodeWithPlaywright(username);
  }
}

/**
 * Obtém o shortcode usando Playwright (scraping) como fallback
 */
async function getShortcodeWithPlaywright(username) {
  const { chromium } = require('playwright');
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
    browser = await chromium.launch({
      headless: true, // Sempre headless no servidor
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Importante para Docker/Railway
    });

    const context = await browser.newContext({
      storageState: AUTH_FILE
    });

    const page = await context.newPage();

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
