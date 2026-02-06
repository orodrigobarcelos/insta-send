const axios = require('axios');

/**
 * Testa o endpoint de comentário usando shortcode direto
 */
async function testShortcodeDirect() {
  try {
    console.log('Testando comentário via shortcode direto...');
    
    // Shortcode de um post do Instagram para teste
    const shortcode = 'DNfvyAVgxUv'; // Shortcode atualizado para teste
    const comment = 'Teste de comentário via shortcode direto ' + new Date().toISOString();
    
    console.log(`Enviando comentário para o post com shortcode: ${shortcode}`);
    console.log(`Comentário: "${comment}"`);
    
    // Chamada para o endpoint usando shortcode direto
    const response = await axios.post('http://localhost:3001/api/comment-via-rapidapi', {
      shortcode,
      comment
    });
    
    console.log('\nResposta da API:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ Teste com shortcode direto bem-sucedido!');
    } else {
      console.log('\n❌ Teste com shortcode direto falhou.');
      console.log('Erro:', response.data.error);
    }
  } catch (error) {
    console.error('\n❌ Erro ao executar teste com shortcode direto:');
    if (error.response) {
      console.error('Resposta de erro:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

/**
 * Testa o endpoint de comentário usando username (método original)
 */
async function testUsernameMethod() {
  try {
    console.log('\nTestando comentário via username (método original)...');
    
    const username = 'pablomarcal1'; // Substitua por um username real para teste
    const comment = 'Teste de comentário via username ' + new Date().toISOString();
    
    console.log(`Enviando comentário para o post mais recente de @${username}`);
    console.log(`Comentário: "${comment}"`);
    
    // Chamada para o endpoint usando username
    const response = await axios.post('http://localhost:3001/api/comment-via-rapidapi', {
      username,
      comment
    });
    
    console.log('\nResposta da API:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ Teste com username bem-sucedido!');
    } else {
      console.log('\n❌ Teste com username falhou.');
      console.log('Erro:', response.data.error);
    }
  } catch (error) {
    console.error('\n❌ Erro ao executar teste com username:');
    if (error.response) {
      console.error('Resposta de erro:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Executar os testes
async function runTests() {
  console.log('=== TESTES DO ENDPOINT DE COMENTÁRIO ===\n');
  
  // Teste com shortcode direto
  await testShortcodeDirect();
  
  // Teste com username (método original)
  await testUsernameMethod();
  
  console.log('\n=== TESTES CONCLUÍDOS ===');
}

runTests();
