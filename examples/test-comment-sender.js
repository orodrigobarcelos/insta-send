const { commentOnPost, commentOnFirstPost } = require('./instagram-comment-sender');
require('dotenv').config();

// Função para testar o comentário por shortcode
async function testCommentByShortcode() {
  // Shortcode de teste especificado pelo usuário
  const shortcode = 'DKmyDswgyjh';
  const comment = 'Teste automatizado de comentário via shortcode ' + new Date().toISOString();
  
  console.log(`Testando comentário no post com shortcode: ${shortcode}`);
  console.log(`Comentário: ${comment}`);
  
  try {
    const result = await commentOnPost(shortcode, comment, { headless: false, slowMo: 100 });
    console.log('Resultado:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Erro ao testar comentário por shortcode:', error);
    return { success: false, error: error.message };
  }
}

// Função para testar o comentário no primeiro post de um usuário
async function testCommentOnFirstPost() {
  // Nome de usuário para teste - substitua por um usuário válido
  const username = 'instagram'; // Exemplo - substitua por um usuário real
  const comment = 'Teste automatizado de comentário no primeiro post ' + new Date().toISOString();
  
  console.log(`Testando comentário no primeiro post de @${username}`);
  console.log(`Comentário: ${comment}`);
  
  try {
    const result = await commentOnFirstPost(username, comment, { headless: false, slowMo: 100 });
    console.log('Resultado:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Erro ao testar comentário no primeiro post:', error);
    return { success: false, error: error.message };
  }
}

// Executar o teste especificado via linha de comando
async function runTest() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'shortcode'; // padrão: testar por shortcode
  
  if (testType === 'user') {
    return await testCommentOnFirstPost();
  } else {
    return await testCommentByShortcode();
  }
}

// Executar o teste
runTest()
  .then(result => {
    console.log('Teste concluído!');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Erro fatal no teste:', error);
    process.exit(1);
  });
