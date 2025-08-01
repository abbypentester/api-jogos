# Instruções para Deploy no Render.com

## 🚨 Problema Resolvido: Deploy Eterno

O problema de deploy eterno no Render era causado pelo **Puppeteer** tentando baixar o Chromium durante a instalação. Esta versão foi otimizada para resolver esse problema.

## ✅ Soluções Implementadas

### 1. Configuração Otimizada do Puppeteer
- `"skipDownload": true` no package.json
- Uso do Chromium já instalado no sistema do Render
- Configurações de timeout otimizadas

### 2. Variáveis de Ambiente Necessárias

No painel do Render, adicione estas variáveis de ambiente:

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
NODE_ENV=production
```

### 3. Configurações de Build

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
node index.js
```

## 🔧 Funcionalidades Disponíveis

### Endpoints da API
- `GET /` - Documentação da API
- `GET /api/status` - Status do servidor
- `GET /api/jogos` - Jogos da data atual
- `GET /api/jogos/data/:data` - Jogos de data específica
- `POST /api/atualizar` - **NOVO!** Executar scraping sob demanda

### Sistema de Scraping
- ✅ Seletores dinâmicos adaptativos
- ✅ Sistema de recuperação automática
- ✅ Validação contínua de seletores
- ✅ Fallback para dados de exemplo

## 🚀 Como Fazer o Deploy

### Passo 1: Preparar o Repositório
1. Faça commit de todos os arquivos da pasta `deploy-render`
2. Envie para o GitHub

### Passo 2: Configurar no Render
1. Acesse [render.com](https://render.com)
2. Conecte seu repositório GitHub
3. Selecione "Web Service"
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Environment:** Node

### Passo 3: Adicionar Variáveis de Ambiente
```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
NODE_ENV=production
```

### Passo 4: Deploy
1. Clique em "Create Web Service"
2. Aguarde o deploy (deve ser rápido agora!)
3. Teste os endpoints

## 🧪 Testando o Deploy

### 1. Verificar Status
```bash
curl https://seu-app.onrender.com/api/status
```

### 2. Testar Scraping
```bash
curl -X POST https://seu-app.onrender.com/api/atualizar
```

### 3. Obter Jogos
```bash
curl https://seu-app.onrender.com/api/jogos
```

## 🔍 Monitoramento

### Logs do Render
- Acesse o painel do Render
- Vá em "Logs" para monitorar o funcionamento
- Procure por mensagens de sucesso do scraping

### Health Check
- O endpoint `/health` fornece informações de saúde
- Monitore uptime e uso de memória

## 🛠️ Troubleshooting

### Deploy Ainda Travando?
1. Verifique se as variáveis de ambiente estão corretas
2. Confirme que o `package.json` tem `"skipDownload": true`
3. Tente fazer redeploy manual

### Scraping Não Funciona?
1. Verifique os logs do Render
2. Teste o endpoint `/api/atualizar`
3. O sistema tem fallback para dados de exemplo

### Timeout Errors?
1. O sistema tem timeouts otimizados
2. Seletores adaptativos se ajustam automaticamente
3. Sistema de recuperação automática ativo

## 📊 Performance

### Otimizações Implementadas
- ✅ Puppeteer sem download do Chromium
- ✅ Timeouts configurados para ambiente de produção
- ✅ Sistema de cache inteligente
- ✅ Seletores adaptativos para mudanças no site
- ✅ Graceful shutdown para deploys

### Recursos do Render Utilizados
- ✅ CORS habilitado para acesso externo
- ✅ Trust proxy para IPs corretos
- ✅ Health checks automáticos
- ✅ Logs detalhados para debug

## 🎯 Próximos Passos

1. **Deploy Inicial:** Teste com dados de exemplo
2. **Primeiro Scraping:** Use `POST /api/atualizar`
3. **Monitoramento:** Configure alertas no Render
4. **Automação:** Configure webhooks ou cron jobs

---

**✅ Esta versão resolve o problema de deploy eterno no Render!**

O sistema agora está otimizado para funcionar perfeitamente no Render.com com scraping em tempo real.