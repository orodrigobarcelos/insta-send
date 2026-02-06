/**
 * Script para testar o endpoint robusto de comentários via RapidAPI
 * Este teste verifica se a nova implementação robusta resolve o problema de elemento desconectado
 */

const axios = require('axios');

// Configuração
const API_URL = 'http://localhost:3001';
const TEST_USERNAME = 'orodrigobarcelos'; // Usuário para testar
const TEST_COMMENT = 'Ótimo conteúdo! Teste automatizado ' + new Date().toISOString();

async function testRobustCommentEndpoint() {
  console.log('='.repeat(50));
  console.log('TESTE DO ENDPOINT ROBUSTO DE COMENTÁRIOS VIA RAPIDAPI');
  console.log('='.repeat(50));
  
  console.log(`\nTestando comentário para o usuário: @${TEST_USERNAME}`);
  console.log(`Comentário: "${TEST_COMMENT}"`);
  
  try {
    console.log('\nEnviando requisição para o endpoint /api/comment-via-rapidapi...');
    
    const startTime = Date.now();
    
    const response = await axios.post(`${API_URL}/api/comment-via-rapidapi`, {
      username: TEST_USERNAME,
      comment: TEST_COMMENT
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`\nResposta recebida em ${duration.toFixed(2)} segundos:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n✅ TESTE BEM-SUCEDIDO!');
      console.log(`Comentário enviado com sucesso para @${TEST_USERNAME}`);
      console.log(`Shortcode do post: ${response.data.shortcode}`);
      console.log(`URL do post: ${response.data.postUrl}`);
      
      if (response.data.screenshotPath) {
        console.log(`Screenshot salvo em: ${response.data.screenshotPath}`);
      }
      
      if (response.data.attempt) {
        console.log(`Sucesso na tentativa ${response.data.attempt}`);
      }
    } else {
      console.log('\n❌ TESTE FALHOU!');
      console.log(`Erro: ${response.data.error}`);
      
      if (response.data.screenshotPath) {
        console.log(`Screenshot de erro salvo em: ${response.data.screenshotPath}`);
      }
    }
    
  } catch (error) {
    console.log('\n❌ ERRO NA REQUISIÇÃO:');
    
    if (error.response) {
      // O servidor respondeu com um status de erro
      console.log(`Status: ${error.response.status}`);
      console.log('Dados:');
      console.log(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.log('Sem resposta do servidor. Verifique se o servidor está rodando.');
    } else {
      // Erro ao configurar a requisição
      console.log(`Erro: ${error.message}`);
    }
  }
  
  console.log('\n='.repeat(50));
}

// Executar o teste
testRobustCommentEndpoint();
