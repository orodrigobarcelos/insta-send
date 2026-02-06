const axios = require('axios');

/**
 * Exemplo 1: Chamada da API usando shortcode diretamente
 */
async function exemploShortcodeDireto() {
  try {
    // Dados para a chamada
    const shortcode = 'C9_Iy6Hs7Ue'; // Substitua pelo shortcode real
    const comment = 'Adorei seu post! 👏';
    
    // Chamada da API
    const response = await axios.post('http://147.93.131.155:3001/api/comment-via-rapidapi', {
      shortcode: shortcode,
      comment: comment
    });
    
    console.log('Resposta da API (shortcode direto):', response.data);
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

/**
 * Exemplo 2: Chamada da API usando username (método original)
 */
async function exemploUsername() {
  try {
    // Dados para a chamada
    const username = 'pablomarcal1'; // Substitua pelo username real
    const comment = 'Conteúdo incrível! 🔥';
    
    // Chamada da API
    const response = await axios.post('http://147.93.131.155:3001/api/comment-via-rapidapi', {
      username: username,
      comment: comment
    });
    
    console.log('Resposta da API (via username):', response.data);
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

// Executar os exemplos
exemploShortcodeDireto();
setTimeout(exemploUsername, 5000); // Espera 5 segundos antes de executar o segundo exemplo
