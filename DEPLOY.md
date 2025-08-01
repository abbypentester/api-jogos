# 🚀 Guia Rápido de Deploy

## Render.com (Recomendado)

### Passo a Passo:

1. **Preparar Repositório GitHub**
   ```bash
   # Fazer upload desta pasta para um repositório GitHub
   git init
   git add .
   git commit -m "Initial commit - API de Jogos"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/api-jogos.git
   git push -u origin main
   ```

2. **Deploy no Render**
   - Acesse: https://render.com
   - Clique em "New" → "Web Service"
   - Conecte seu repositório GitHub
   - Configure:
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Environment:** Node
   - Clique em "Create Web Service"

3. **Configurações Automáticas**
   - ✅ Porta detectada automaticamente
   - ✅ Puppeteer configurado para Render
   - ✅ Atualização diária ativa
   - ✅ Fallback para dados de exemplo

### URLs de Teste:
```
https://SEU-APP.onrender.com/api/status
https://SEU-APP.onrender.com/api/jogos
```

## Railway (Alternativa)

1. **Deploy Direto**
   - Acesse: https://railway.app
   - Clique em "Deploy from GitHub repo"
   - Selecione seu repositório
   - Deploy automático!

## Heroku (Opção Paga)

```bash
# Instalar Heroku CLI
npm install -g heroku

# Login e criar app
heroku login
heroku create seu-app-name

# Configurar buildpack
heroku buildpacks:set heroku/nodejs

# Deploy
git push heroku main
```

## ✅ Checklist Pré-Deploy

- [ ] Repositório GitHub criado
- [ ] Arquivos commitados
- [ ] package.json com scripts corretos
- [ ] .env.example documentado
- [ ] .gitignore configurado
- [ ] README.md atualizado

## 🔧 Troubleshooting

### Erro de Build:
- Verificar se `package.json` está correto
- Confirmar Node.js version >= 14

### Erro de Puppeteer:
- Variáveis de ambiente já configuradas
- Render instala Chrome automaticamente

### API não responde:
- Verificar logs no dashboard
- Testar endpoint `/api/status`

## 📞 Suporte

Se encontrar problemas:
1. Verificar logs no dashboard da plataforma
2. Testar localmente com `npm start`
3. Consultar documentação da plataforma

---

**Deploy realizado com sucesso! 🎉**