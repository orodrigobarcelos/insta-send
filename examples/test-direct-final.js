/**
 * Teste direto da função final sem passar pelo servidor API
 */

const { commentOnPost } = require('./instagram-comment-sender-final');

const SHORTCODE = 'DGI3xifsi15';
const TEST_COMMENT = 'Teste direto final! ' + new Date().toISOString();

async function testDirectly() {
  console.log('=== TESTE DIRETO DA FUNÇÃO FINAL ===');
  console.log(`Shortcode: ${SHORTCODE}`);
  console.log(`Comentário: "${TEST_COMMENT}"`);
  
  try {
    const result = await commentOnPost(SHORTCODE, TEST_COMMENT, {
      headless: false, // Visível para debug
      slowMo: 100
    });
    
    console.log('\nResultado:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ SUCESSO!');
    } else {
      console.log('\n❌ FALHOU!');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
}

testDirectly().catch(console.error);
