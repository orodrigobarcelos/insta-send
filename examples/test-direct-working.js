/**
 * Teste direto da versão working sem passar pelo servidor
 */

const { commentOnPost } = require('./instagram-comment-working');

const SHORTCODE = 'DGI3xifsi15';
const TEST_COMMENT = 'Teste direto working! ' + new Date().toISOString();

async function testDirectWorking() {
  console.log('=== TESTE DIRETO VERSÃO WORKING ===');
  console.log(`Shortcode: ${SHORTCODE}`);
  console.log(`Comentário: "${TEST_COMMENT}"`);
  
  try {
    const result = await commentOnPost(SHORTCODE, TEST_COMMENT, {
      headless: false, // Visível para debug
      slowMo: 200
    });
    
    console.log('\nResultado:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCESSO!');
      if (result.verified) {
        console.log('✅ Comentário verificado na página');
      }
    } else {
      console.log('\n❌ FALHOU!');
      console.log(`Erro: ${result.error}`);
      if (result.screenshotPath) {
        console.log(`Screenshot: ${result.screenshotPath}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
}

testDirectWorking().catch(console.error);
