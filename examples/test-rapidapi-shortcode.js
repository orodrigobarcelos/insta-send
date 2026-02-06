const axios = require('axios');

// Substitua pela sua chave da RapidAPI
const RAPIDAPI_KEY = 'COLOQUE_SUA_CHAVE_AQUI';
const RAPIDAPI_HOST = 'instagram-looter2.p.rapidapi.com';
const USERNAME = 'brunabretas1'; // Usuário para teste

async function getProfileData() {
  try {
    console.log(`Buscando dados do perfil para: @${USERNAME}`);
    
    const url = `https://instagram-looter2.p.rapidapi.com/profile?username=${USERNAME}`;
    
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

// Executar a função
getProfileData()
  .then(shortcode => {
    if (shortcode) {
      console.log(`\nShortcode encontrado: ${shortcode}`);
      console.log(`URL para comentar: https://www.instagram.com/p/${shortcode}/`);
    } else {
      console.log('\nNão foi possível encontrar o shortcode.');
    }
  })
  .catch(err => console.error('Erro fatal:', err));
