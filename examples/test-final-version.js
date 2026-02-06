/**
 * Teste da versão final com seletores em português
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';
const TEST_USERNAME = 'orodrigobarcelos';
const TEST_COMMENT = `Teste final português! ${new Date().toISOString()}`;

async function testFinalVersion() {
  console.log('='.repeat(60));
  console.log('TESTE VERSÃO FINAL - SELETORES EM PORTUGUÊS');
  console.log('='.repeat(60));
  
  console.log(`\nTestando comentário para: @${TEST_USERNAME}`);
  console.log(`Comentário: "${TEST_COMMENT}"`);
  
  try {
    console.log('\nEnviando requisição para /api/comment-via-rapidapi...');
    const startTime = Date.now();
    
    const response = await axios.post(`${API_BASE_URL}/api/comment-via-rapidapi`, {
      username: TEST_USERNAME,
      comment: TEST_COMMENT
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\nResposta recebida em ${duration} segundos:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ TESTE BEM-SUCEDIDO!');
      console.log(`Comentário enviado para: ${response.data.postUrl}`);
      if (response.data.verified) {
        console.log('✅ Comentário verificado na página');
      } else {
        console.log('⚠️ Comentário enviado mas não verificado');
      }
    } else {
      console.log('\n❌ TESTE FALHOU!');
      console.log(`Erro: ${response.data.error}`);
      if (response.data.screenshotPath) {
        console.log(`Screenshot: ${response.data.screenshotPath}`);
      }
    }
    
  } catch (error) {
    console.log('\n❌ ERRO NA REQUISIÇÃO!');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Dados: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`Erro: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

testFinalVersion().catch(console.error);
