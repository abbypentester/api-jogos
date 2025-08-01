# 🏆 API de Jogos de Futebol

> API moderna para obter dados de jogos de futebol em tempo real através de web scraping adaptativo com atualização automática diária.

## 🚀 Deploy Instantâneo

### Render.com (Recomendado - Gratuito)

1. **Fork este repositório no GitHub**
2. **Deploy no Render:**
   - Acesse [render.com](https://render.com) e faça login
   - Clique em "New" → "Web Service"
   - Conecte seu repositório GitHub
   - Configure:
     ```
     Build Command: npm install
     Start Command: npm start
     ```
   - Deploy automático! 🎉

### Railway (Alternativa Gratuita)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

## ✨ Funcionalidades

- 🔄 **Atualização Automática Diária** - Dados atualizados à meia-noite
- 🎯 **Web Scraping Adaptativo** - Seletores dinâmicos que se auto-corrigem
- 📊 **API RESTful Completa** - Endpoints intuitivos e bem documentados
- 🛡️ **Sistema de Fallback** - Dados de exemplo quando necessário
- ⚡ **Deploy Ready** - Configurado para múltiplas plataformas
- 🕒 **Agendamento Inteligente** - Cron jobs para atualizações automáticas

## 📡 Endpoints da API

### 📊 Status e Informações
```http
GET /api/status
```
Retorna status da API, próxima atualização e estatísticas.

### ⚽ Jogos
```http
GET /api/jogos                    # Todos os jogos
GET /api/jogos?time=flamengo      # Filtrar por time
GET /api/jogos?competicao=copa    # Filtrar por competição
GET /api/jogos?status=ao-vivo     # Filtrar por status
```

### 📋 Listas
```http
GET /api/competicoes              # Todas as competições
GET /api/times                    # Todos os times
```

### 🔄 Controle de Atualização
```http
POST /api/atualizar                    # Atualização manual
POST /api/atualizar/diaria/iniciar     # Ativar atualização diária
POST /api/atualizar/diaria/parar       # Desativar atualização diária
```

## 📋 Exemplo de Resposta

```json
{
  "success": true,
  "data": [
    {
      "id": "jogo_1",
      "timeA": "Flamengo",
      "timeB": "Palmeiras",
      "placar": "2 x 1",
      "horario": "16:00",
      "status": "finalizado",
      "competicao": "Brasileirão",
      "nivel": "nacional"
    }
  ],
  "total": 1,
  "timestamp": "2024-01-15T19:30:00.000Z",
  "fonte": "scraping"
}
```

## 🛠️ Desenvolvimento Local

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/api-jogos.git
cd api-jogos

# 2. Instale as dependências
npm install

# 3. Configure as variáveis (opcional)
cp .env.example .env

# 4. Inicie o servidor
npm start

# 5. Teste a API
npm test
```

Servidor rodando em: `http://localhost:3000`

## ⚙️ Configurações

Todas as configurações estão no arquivo `.env.example`. Para deploy em produção, as configurações padrão já funcionam perfeitamente.

### Principais Variáveis:
- `PORT` - Porta do servidor (auto-detectada no Render)
- `PUPPETEER_EXECUTABLE_PATH` - Caminho do Chrome (configurado para Render)
- `DEBUG_MODE` - Modo debug (false em produção)

## 📚 Documentação Adicional

- [`AUTOMACAO_DIARIA.md`](./AUTOMACAO_DIARIA.md) - Sistema de atualização automática
- [`RENDER-DEPLOY-INSTRUCTIONS.md`](./RENDER-DEPLOY-INSTRUCTIONS.md) - Guia detalhado de deploy
- [`.env.example`](./.env.example) - Todas as configurações disponíveis

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir melhorias
- Enviar pull requests

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

---

**Desenvolvido com ❤️ para a comunidade de desenvolvedores**
