# 🌙 Sistema de Atualização Automática Diária

Este documento descreve o sistema de atualização automática diária implementado na API de Jogos.

## 📋 Visão Geral

O sistema foi configurado para atualizar automaticamente os dados dos jogos **todos os dias à meia-noite** (00:00) no fuso horário de São Paulo (America/Sao_Paulo).

## 🚀 Funcionalidades

### ✅ Atualização Diária Automática
- **Horário**: Meia-noite (00:00)
- **Fuso Horário**: America/Sao_Paulo
- **Frequência**: Diária
- **Tecnologia**: node-cron
- **Status**: Ativo por padrão

### 🔄 Atualização por Intervalo (Opcional)
- **Frequência**: A cada 30 minutos (configurável)
- **Status**: Inativo por padrão
- **Ativação**: Via API

## 🛠️ Endpoints da API

### Status do Sistema
```http
GET /api/status
```
Retorna informações sobre ambos os sistemas de atualização.

### Controle da Atualização Diária

#### Iniciar Atualização Diária
```http
POST /api/atualizar/diaria/iniciar
```
**Resposta de Sucesso:**
```json
{
  "status": "sucesso",
  "mensagem": "Atualização diária iniciada com sucesso",
  "horario": "Meia-noite (00:00)",
  "cronExpression": "0 0 * * *",
  "timezone": "America/Sao_Paulo",
  "timestamp": "2025-08-01T11:48:19.791Z"
}
```

#### Parar Atualização Diária
```http
POST /api/atualizar/diaria/parar
```
**Resposta de Sucesso:**
```json
{
  "status": "sucesso",
  "mensagem": "Atualização diária parada com sucesso",
  "timestamp": "2025-08-01T11:48:19.791Z"
}
```

### Controle da Atualização por Intervalo

#### Iniciar Atualização por Intervalo
```http
POST /api/atualizar/iniciar
```

#### Parar Atualização por Intervalo
```http
POST /api/atualizar/parar
```

### Atualização Manual
```http
POST /api/atualizar
```
Executa o scraping imediatamente, independente dos sistemas automáticos.

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Valor Padrão | Exemplo |
|----------|-----------|--------------|----------|
| `HORARIO_ATUALIZACAO_DIARIA` | Expressão cron para atualização diária | `0 0 * * *` | `0 2 * * *` (2h da manhã) |
| `INTERVALO_ATUALIZACAO` | Intervalo em minutos para atualização contínua | `30` | `60` |

### Exemplos de Expressões Cron

| Expressão | Descrição |
|-----------|----------|
| `0 0 * * *` | Meia-noite todos os dias |
| `0 2 * * *` | 2h da manhã todos os dias |
| `0 6 * * *` | 6h da manhã todos os dias |
| `0 0 * * 1` | Meia-noite todas as segundas-feiras |
| `0 0 1 * *` | Meia-noite no primeiro dia de cada mês |

## 🔍 Monitoramento

### Verificar Status
Use o endpoint `/api/status` para verificar:
- Se a atualização diária está ativa
- Última atualização realizada
- Próxima atualização agendada
- Status atual do sistema

### Logs do Sistema
O sistema registra logs detalhados:
- `🌙 Executando atualização automática diária à meia-noite...`
- `✅ Atualização diária configurada com sucesso!`
- `🛑 Atualização diária parada`

## 🚀 Deploy e Produção

### Serviços de Hospedagem Compatíveis
- ✅ Render.com
- ✅ Railway.app
- ✅ Vercel.com
- ✅ Heroku

### Configuração para Produção
1. Configure a variável `HORARIO_ATUALIZACAO_DIARIA` se necessário
2. O sistema inicia automaticamente com o servidor
3. Monitore os logs para verificar execução

## 🔧 Troubleshooting

### Problema: Atualização não está executando
**Solução:**
1. Verifique o status: `GET /api/status`
2. Reinicie a atualização: `POST /api/atualizar/diaria/iniciar`
3. Verifique os logs do servidor

### Problema: Fuso horário incorreto
**Solução:**
1. Configure a variável `TZ=America/Sao_Paulo` no ambiente
2. Reinicie o servidor

### Problema: Expressão cron inválida
**Solução:**
1. Verifique a sintaxe da expressão cron
2. Use ferramentas online para validar: [crontab.guru](https://crontab.guru/)

## 📊 Benefícios

- ✅ **Automação Completa**: Dados sempre atualizados sem intervenção manual
- ✅ **Eficiência**: Execução apenas uma vez por dia, economizando recursos
- ✅ **Confiabilidade**: Sistema robusto com tratamento de erros
- ✅ **Flexibilidade**: Configurável via variáveis de ambiente
- ✅ **Monitoramento**: APIs para verificar status e controlar execução
- ✅ **Compatibilidade**: Funciona em todos os principais serviços de hospedagem

## 🎯 Próximos Passos

O sistema está pronto para uso em produção. A atualização diária garante que os dados estejam sempre atualizados para os usuários da API.