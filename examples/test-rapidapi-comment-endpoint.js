const axios = require('axios');

// Configuração do teste
const API_URL = 'http://localhost:3001';
const USERNAME = 'orodrigobarcelos'; // Usuário para teste
const COMMENT = `Teste de comentário via endpoint RapidAPI ${new Date().toISOString()}`;

/**
 * Testa o endpoint de comentário via RapidAPI
 */
async function testCommentViaRapidAPI() {
  console.log('=== TESTE DO ENDPOINT /api/comment-via-rapidapi ===\n');
  console.log(`Usuário: @${USERNAME}`);
  console.log(`Comentário: "${COMMENT}"`);
  
  try {
    console.log('\nEnviando requisição...');
    const response = await axios.post(`${API_URL}/api/comment-via-rapidapi`, {
      username: USERNAME,
      comment: COMMENT
    });
    
    console.log('\nResposta recebida:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ TESTE BEM-SUCEDIDO!');
      console.log(`Comentário enviado no post: ${response.data.postUrl}`);
      console.log(`Screenshot salvo em: ${response.data.screenshotPath}`);
    } else {
      console.log('\n❌ TESTE FALHOU');
      console.log(`Erro: ${response.data.error}`);
    }
  } catch (error) {
    console.error('\n❌ ERRO NA REQUISIÇÃO:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Resposta de erro:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

// Executar o teste
testCommentViaRapidAPI();
