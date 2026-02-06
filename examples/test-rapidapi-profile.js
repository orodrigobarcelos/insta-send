const axios = require('axios');
require('dotenv').config();

// Configuração da RapidAPI
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
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

    console.log('Resposta completa da API:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verificar se há postagens e encontrar o shortcode
    if (response.data && 
        response.data.edge_owner_to_timeline_media && 
        response.data.edge_owner_to_timeline_media.edges && 
        response.data.edge_owner_to_timeline_media.edges.length > 0) {
      
      console.log('\nPrimeira postagem encontrada:');
      const firstPost = response.data.edge_owner_to_timeline_media.edges[0].node;
      console.log('Shortcode:', firstPost.shortcode);
      console.log('URL da postagem:', `https://www.instagram.com/p/${firstPost.shortcode}/`);
      
      // Mostrar outras informações úteis
      if (firstPost.edge_media_to_caption && 
          firstPost.edge_media_to_caption.edges && 
          firstPost.edge_media_to_caption.edges.length > 0) {
        console.log('Legenda:', firstPost.edge_media_to_caption.edges[0].node.text);
      }
      
      console.log('Likes:', firstPost.edge_liked_by?.count || 'N/A');
      console.log('Comentários:', firstPost.edge_media_to_comment?.count || 'N/A');
      
    } else {
      console.log('Nenhuma postagem encontrada ou estrutura de dados diferente do esperado.');
      
      // Explorar a estrutura para encontrar posts
      console.log('\nExplorando estrutura de dados para encontrar posts:');
      Object.keys(response.data).forEach(key => {
        if (key.includes('post') || key.includes('media') || key.includes('edge')) {
          console.log(`Possível campo de posts: ${key}`);
          console.log(JSON.stringify(response.data[key], null, 2).substring(0, 500) + '...');
        }
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar dados do perfil:', error);
    if (error.response) {
      console.error('Resposta de erro:', error.response.data);
      console.error('Status:', error.response.status);
    }
    return null;
  }
}

// Executar a função
getProfileData()
  .then(() => console.log('Consulta concluída!'))
  .catch(err => console.error('Erro fatal:', err));
