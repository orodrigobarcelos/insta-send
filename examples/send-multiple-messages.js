const { sendMessageByUsername } = require('./instagram-user-id');

// Lista de usuários e seus nomes de usuário do Instagram
const users = [
  { name: 'Alef', username: 'escreve.dor' },
  { name: 'Rodrigo', username: 'rsilvamello' },
  { name: 'Caetano', username: 'caetanolaudelino' },
  { name: 'Val', username: 'val.limamkt' },
  { name: 'Paulo', username: 'phvelosobarros' },
  { name: 'Erik', username: 'urucarneuruguaya' },
  { name: 'Gabriel', username: 'petspa_petrolina' },
  { name: 'Rafael', username: 'rafael_salvan' },
  { name: 'Fabiana', username: 'fabianapaschoa' },
  { name: 'Bruno', username: 'brunoreinstein' },
  { name: 'Rodolfo', username: 'rodolfoclivatti.adv' },
  { name: 'Bruno', username: 'brunobrasil2' },
  { name: 'Alex', username: 'totalqualitymedicina' },
  { name: 'Guilherme', username: 'guilherme.saloio' },
  { name: 'Romulo', username: 'robertacsampaio' },
  { name: 'Marcel', username: 'marcelbranco' },
  { name: 'Gabriel', username: '_gabrielvaladares' },
  { name: 'Romão', username: 'romao.olinda' },
  { name: 'Rafael', username: 'rafaribeiro.com.br' },
  { name: 'Vanessa', username: 'vanessamontorograficos' },
  { name: 'Rogério', username: 'rogerio_sva' },
  { name: 'Mateus', username: 'mateuscastr' },
  { name: 'Vinícius', username: 'vinicius_bezerra1' },
  { name: 'Lucas', username: 'lucaslourenco' },
  { name: 'Daniel', username: 'danieldental_' },
  { name: 'Willian', username: 'willianferraris' },
  { name: 'Paulo', username: 'passeiosturisticosemporto' },
  { name: 'Renato', username: 'artecompimenta' },
  { name: 'Marcus', username: 'polomoveis_' },
  { name: 'Diogo', username: 'dsbrokerimoveis' },
  { name: 'Hugo', username: 'hugo.startsi' },
  { name: 'Adriano', username: 'adtrafegodigital' },
  { name: 'Marcos', username: 'newprofessionalsbr' },
  { name: 'Lidia', username: 'lidiarodriguesbh' },
  { name: 'Luciano', username: 'lucianodivisorias' },
  { name: 'Cássio', username: 'cassioaragaooficial' },
  { name: 'Cris', username: 'ccsconhecimentocontinuodoser' },
  { name: 'Fabricio', username: '_fabricio_olliveira_' },
  { name: 'Peter', username: 'inglesicao' },
  { name: 'Mauro', username: 'jjuniormoraes' },
  { name: 'Rubens', username: 'rubens.capozzoli' },
  { name: 'Royner', username: 'royneralejandro_' },
  { name: 'Elaine', username: 'elaine' },
  { name: 'Ronny', username: 'ronnygabriel025' },
  { name: 'Diony', username: 'dr.dionymelo' },
  { name: 'Josimar', username: 'ramaodontologia' },
  { name: 'Miguel', username: 'migueldamiani_' },
  { name: 'Ezequiel', username: 'ezequielchissonde.med' },
  { name: 'Ely', username: 'elymoraesribeiro' },
  { name: 'Rafael', username: 'rafa_inocencio' },
  { name: 'Rodrigo', username: 'rodrigosoaresb_' },
  { name: 'Emerson', username: 'emerso' },
  { name: 'Lucas', username: 'lamscompany' },
  { name: 'Gustavo', username: 'gustavogalhardo_' }
];

// Função para enviar mensagem para um usuário
async function sendMessage(user) {
  try {
    console.log(`Enviando mensagem para ${user.name} (${user.username})...`);
    
    const message = `EEi ${user.name}, blzinhaa? podendo falar ai?`;
    
    // Usar sendMessageByUsername que utiliza a API do RapidAPI para obter o ID do usuário
    const result = await sendMessageByUsername(user.username, message, { headless: true });
    
    if (result.success) {
      console.log(`✅ Mensagem enviada com sucesso para ${user.name} (${user.username})`);
      return { user, success: true, result };
    } else {
      console.error(`❌ Erro ao enviar mensagem para ${user.name} (${user.username}): ${result.error}`);
      return { user, success: false, error: result.error };
    }
  } catch (error) {
    console.error(`❌ Exceção ao enviar mensagem para ${user.name} (${user.username}): ${error.message}`);
    console.error('Detalhes do erro:', error);
    return { user, success: false, error: error.message };
  }
}

// Função para enviar mensagens com intervalo entre elas
async function sendMessagesWithDelay() {
  console.log(`Iniciando envio de mensagens para ${users.length} usuários...`);
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Intervalo entre mensagens (em milissegundos) - 10 segundos
  const DELAY_BETWEEN_MESSAGES = 10000;
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    console.log(`\n[${i+1}/${users.length}] Processando ${user.name} (${user.username})...`);
    
    const result = await sendMessage(user);
    
    if (result.success) {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
    
    // Se não for o último usuário, aguarde o intervalo
    if (i < users.length - 1) {
      console.log(`Aguardando ${DELAY_BETWEEN_MESSAGES/1000} segundos antes da próxima mensagem...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES));
    }
  }
  
  // Relatório final
  console.log('\n\n======= RELATÓRIO FINAL =======');
  console.log(`Total de usuários: ${users.length}`);
  console.log(`Mensagens enviadas com sucesso: ${results.successful.length}`);
  console.log(`Mensagens com falha: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nUsuários com falha no envio:');
    results.failed.forEach(result => {
      console.log(`- ${result.user.name} (${result.user.username}): ${result.error}`);
    });
  }
  
  return results;
}

// Executar o script
sendMessagesWithDelay().then(results => {
  console.log('Processo concluído!');
}).catch(error => {
  console.error('Erro no processo:', error);
});
