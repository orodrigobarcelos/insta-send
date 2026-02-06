/**
 * Teste com usuário brunabretas1 em modo headless
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
const USERNAME = 'brunabretas1';
const TEST_COMMENT = 'Teste brunabretas1! ' + new Date().toISOString();

async function testBrunabretas1() {
  console.log('=== TESTE COM BRUNABRETAS1 ===');
  console.log(`Usuário: @${USERNAME}`);
  console.log(`Comentário: "${TEST_COMMENT}"`);
  console.log('Modo: headless (invisível)');
  
  try {
    console.log('\nEnviando requisição...');
    
    const response = await axios.post(`${API_BASE}/api/comment-via-rapidapi`, {
      username: USERNAME,
      comment: TEST_COMMENT
    }, {
      timeout: 60000 // 60 segundos
    });
    
    console.log('\n✅ RESPOSTA RECEBIDA:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 SUCESSO! Comentário enviado para brunabretas1!');
      if (response.data.verified) {
        console.log('✅ Comentário verificado na página');
      }
      if (response.data.postUrl) {
        console.log(`🔗 Post: ${response.data.postUrl}`);
      }
      if (response.data.shortcode) {
        console.log(`📝 Shortcode: ${response.data.shortcode}`);
      }
    } else {
      console.log('\n❌ FALHOU!');
      console.log(`Erro: ${response.data.error}`);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NA REQUISIÇÃO:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Dados:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testBrunabretas1().catch(console.error);
