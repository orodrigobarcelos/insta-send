const { sendMessageByUsername } = require('./instagram-user-id');

// Testar o envio de mensagem usando o sistema atualizado
async function testUpdatedSystem() {
  const username = 'brunabretas1';
  const message = 'Teste do sistema atualizado - ' + new Date().toISOString();
  
  console.log(`Testando envio de mensagem para ${username} com o sistema atualizado`);
  console.log(`Mensagem: "${message}"`);
  
  try {
    const result = await sendMessageByUsername(username, message, { 
      headless: true // Modo oculto para teste
    });
    
    console.log('Resultado:', result);
    
    if (result.success) {
      console.log('✅ Teste concluído com sucesso!');
    } else {
      console.log('❌ Teste falhou:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Erro durante o teste:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar o teste
testUpdatedSystem()
  .then(() => {
    console.log('Teste finalizado.');
  })
  .catch(error => {
    console.error('Erro fatal:', error);
  });
