const axios = require('axios');
const { commentOnPost } = require('./instagram-comment-sender');
require('dotenv').config();

// Configuração da RapidAPI
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'instagram-looter2.p.rapidapi.com';
const USERNAME = 'orodrigobarcelos'; // Usuário para teste

/**
 * Obtém o shortcode do primeiro post do usuário via RapidAPI
 * @param {string} username - Nome de usuário do Instagram
 * @returns {Promise<string|null>} - Shortcode do primeiro post ou null se não encontrado
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
      
      console.log('\nPrimeira postagem encontrada:');
      const firstPost = response.data.edge_owner_to_timeline_media.edges[0].node;
      console.log('Shortcode:', firstPost.shortcode);
      console.log('URL da postagem:', `https://www.instagram.com/p/${firstPost.shortcode}/`);
      
      return firstPost.shortcode;
    } else {
      console.log('Estrutura de resposta da API:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Tentar encontrar qualquer campo que possa conter postagens
      console.log('\nBuscando campos que possam conter postagens:');
      for (const key in response.data) {
        if (typeof response.data[key] === 'object' && response.data[key] !== null) {
          console.log(`Verificando campo: ${key}`);
        }
      }
      
      return null;
    }
  } catch (error) {
    console.error('Erro ao buscar dados do perfil:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Resposta de erro:', error.response.data);
    }
    return null;
  }
}

/**
 * Teste de ponta a ponta: obtém o shortcode via RapidAPI e comenta no post
 */
async function testEndToEnd() {
  try {
    console.log(`\n=== TESTE DE PONTA A PONTA: COMENTÁRIO NO POST DE @${USERNAME} ===\n`);
    
    // 1. Obter o shortcode do primeiro post
    console.log('1. Obtendo shortcode do primeiro post...');
    const shortcode = await getFirstPostShortcode(USERNAME);
    
    if (!shortcode) {
      console.error('Não foi possível obter o shortcode. Teste interrompido.');
      return;
    }
    
    console.log(`Shortcode obtido com sucesso: ${shortcode}`);
    
    // 2. Comentar no post usando o shortcode
    console.log('\n2. Comentando no post...');
    const commentText = `Teste automatizado de comentário via RapidAPI + Playwright ${new Date().toISOString()}`;
    
    const result = await commentOnPost(shortcode, commentText, { 
      headless: false, // Modo visível para acompanhar o processo
      slowMo: 100 // Movimento mais lento para visualização
    });
    
    // 3. Exibir resultado
    console.log('\n3. Resultado do teste:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!');
      console.log(`Comentário enviado no post: https://www.instagram.com/p/${shortcode}/`);
      console.log(`Screenshot salvo em: ${result.screenshotPath}`);
    } else {
      console.log('\n❌ TESTE FALHOU');
      console.log(`Erro: ${result.error}`);
      console.log(`Screenshot de erro salvo em: ${result.screenshotPath}`);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO FATAL NO TESTE:', error);
  }
}

// Executar o teste
testEndToEnd();
