/**
 * Teste da API em modo headless (invisível) - modo produção
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';
const USERNAME = 'orodrigobarcelos';
const TEST_COMMENT = 'Teste API headless! ' + new Date().toISOString();

async function testApiHeadless() {
  console.log('=== TESTE API MODO HEADLESS (PRODUÇÃO) ===');
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
      console.log('\n🎉 SUCESSO! Comentário enviado em modo headless!');
      if (response.data.verified) {
        console.log('✅ Comentário verificado na página');
      }
      if (response.data.postUrl) {
        console.log(`🔗 Post: ${response.data.postUrl}`);
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

testApiHeadless().catch(console.error);
