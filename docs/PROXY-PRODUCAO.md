# Deploy em Producao com Proxy Residencial

## Problema

O Playwright do INSTA_SEND roda local com IP residencial (casa) e funciona. Em producao (Railway), o Instagram bloqueia porque detecta IP de datacenter (EUA).

## Solucao

Usar **proxy residencial brasileiro** para que o Instagram veja um IP de casa, mesmo rodando na Railway.

## Por que proxy residencial e seguro

- O Instagram do Rodrigo ja aparece em **Campinas** quando usa 4G da Claro, e na cidade dele no Wi-Fi. Duas cidades diferentes, simultaneamente, e nunca deu problema.
- O Instagram nao exige IP fixo -- ele exige que o IP seja **residencial** (nao de datacenter).
- Dois IPs residenciais BR ao mesmo tempo e normal (parece Wi-Fi + 4G).

## Provedor escolhido: Evomi

- **Plano**: Core Residential - Pay As You Go
- **Preco**: $0.79/GB (sem compromisso, sem expiracao)
- **Features**: 54M+ IPs, rotating & sticky, geo-targeting por cidade
- **Trial**: 1 dia gratis
- **Site**: https://evomi.com/product/residential-proxies

## Estimativa de consumo (30 leads/dia)

Cada lead = 1 comentario + 1 DM = ~8-12 MB (sem bloqueio de imagens)

| Cenario | Consumo/mes | Custo/mes |
|---------|-------------|-----------|
| Sem bloqueio de imagens | ~9 GB | ~$7.11 (~R$40) |
| Com bloqueio de imagens | ~2.7 GB | ~$2.13 (~R$12) |

## Configuracao na Railway

### 1. Variaveis de ambiente (aba Variables)

```
PROXY_HOST=rp.evomi.com
PROXY_PORT=1000
PROXY_USER=seu_usuario
PROXY_PASS=sua_senha
```

Os valores exatos virao do dashboard da Evomi apos contratar.

### 2. Codigo - Adicionar proxy no Playwright

Em todos os arquivos que fazem `chromium.launch()`:

```javascript
const browser = await chromium.launch({
  headless: true,
  proxy: {
    server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
    username: process.env.PROXY_USER,
    password: process.env.PROXY_PASS
  }
});
```

### 3. Geo-targeting por cidade (via username)

Formato tipico (confirmar na doc da Evomi):
```
username: seu_usuario-country_br-city_campinas
```

### 4. Networking da Railway

Nao precisa mexer em nada. O proxy e conexao de saida -- a Railway nao bloqueia.

## Otimizacao: Bloqueio de imagens

Adicionar apos criar a page e antes de navegar (economiza ~70% de banda):

```javascript
await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2}', route => route.abort());
```

Nenhuma acao do bot depende de imagens (so usa campos de texto, botoes e seletores DOM).

## Arquivos a modificar

- `src/instagram-dm-sender.js` - adicionar proxy no launch + bloqueio de imagens
- `src/instagram-comment-working.js` - adicionar proxy no launch + bloqueio de imagens
- `src/instagram-post-commenter.js` - adicionar proxy no launch + bloqueio de imagens
- `src/instagram-api-server.js` - se cria browser diretamente, adicionar proxy

## Proximos passos

1. [ ] Testar trial gratis da Evomi (1 dia) - confirmar IPs BR e funcionamento com Instagram
2. [ ] Contratar plano Pay As You Go ($0.79/GB)
3. [ ] Implementar proxy no codigo do Playwright
4. [ ] Implementar bloqueio de imagens/fontes
5. [ ] Adicionar variaveis de ambiente na Railway
6. [ ] Deploy e testar em producao
7. [ ] Monitorar consumo de banda nos primeiros dias

## Alternativas descartadas

| Opcao | Por que descartada |
|-------|-------------------|
| Raspberry Pi / GL.iNet | Hardware caro (R$300-450), desnecessario |
| OpenWrt no roteador | Roteador Vivo MitraStar nao suporta |
| Proxy datacenter | Instagram bloqueia instantaneamente |
| Bright Data | Muito caro ($5-17/GB) |
| Scraper API / Scraping Browser | Nao serve pra fazer acoes (comentar, DM), so pra extrair dados |
