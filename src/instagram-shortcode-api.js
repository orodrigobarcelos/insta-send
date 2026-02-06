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
      console.log(`Nenhuma postagem encontrada para @${username}`);
      console.log('Estrutura de resposta da API:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return {
        success: false,
        error: 'Nenhuma postagem encontrada ou estrutura de resposta inesperada',
        apiResponse: response.data
      };
    }
  } catch (error) {
    console.error('Erro ao buscar dados do perfil:', error.message);
    
    return {
      success: false,
      error: `Erro ao buscar dados do perfil: ${error.message}`,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    };
  }
}

module.exports = {
  getFirstPostShortcode
};
