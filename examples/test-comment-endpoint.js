const axios = require('axios');

// Configuração do teste
const API_URL = 'http://localhost:3001';
const USERNAME = 'brunabretas1'; // Substitua pelo nome de usuário de teste
const COMMENT = 'Teste de comentário automático! 👍';

// Função para testar o endpoint de comentário na primeira postagem
async function testCommentFirstPost() {
  try {
    console.log(`Testando comentário na primeira postagem de @${USERNAME}...`);
    
    const response = await axios.post(`${API_URL}/api/comment-first-post`, {
      username: USERNAME,
      comment: COMMENT
    });
    
    console.log('Resposta do servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('✅ Teste bem-sucedido!');
      if (response.data.screenshotPath) {
        console.log(`Screenshot salvo em: ${response.data.screenshotPath}`);
      }
    } else {
      console.log('❌ Teste falhou!');
      console.error('Erro:', response.data.error);
    }
    
    return response.data;
  } catch (error) {
    console.error('Erro ao fazer requisição:', error.message);
    if (error.response) {
      console.error('Resposta de erro:', error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar o teste
testCommentFirstPost()
  .then(result => {
    console.log('Teste concluído!');
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
