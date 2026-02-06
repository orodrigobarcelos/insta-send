const fs = require('fs');
const path = require('path');
const { getAuthFilePath } = require('./instagram-auth-state');

/**
 * Carrega o estado de autenticação a partir da variável de ambiente INSTAGRAM_AUTH_DATA
 * A variável deve conter o conteúdo do arquivo JSON codificado em Base64
 */
function loadAuthFromEnv() {
  const authFile = getAuthFilePath();
  const authDataB64 = process.env.INSTAGRAM_AUTH_DATA;

  console.log('Verificando configuração de autenticação...');

  // Se o arquivo já existe, não precisamos fazer nada (ambiente local ou persistência ativa)
  if (fs.existsSync(authFile)) {
    console.log(`Arquivo de autenticação encontrado em: ${authFile}`);
    return true;
  }

  // Se não temos a variável de ambiente, não podemos restaurar
  if (!authDataB64) {
    console.warn('AVISO: Arquivo de autenticação não encontrado e variável INSTAGRAM_AUTH_DATA não definida.');
    console.warn('O bot pode falhar ao tentar ações que requerem login.');
    return false;
  }

  try {
    console.log('Restaurando sessão a partir da variável de ambiente...');
    
    // Decodifica Base64 para String
    const authDataJson = Buffer.from(authDataB64, 'base64').toString('utf-8');
    
    // Verifica se é um JSON válido
    JSON.parse(authDataJson);
    
    // Salva no arquivo
    fs.writeFileSync(authFile, authDataJson);
    
    console.log(`Sessão restaurada com sucesso em: ${authFile}`);
    return true;
  } catch (error) {
    console.error('ERRO ao restaurar sessão da variável de ambiente:', error.message);
    return false;
  }
}

module.exports = { loadAuthFromEnv };
