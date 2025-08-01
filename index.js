const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const cron = require('node-cron');
const { scrapingAdaptativo } = require('./seletor-dinamico-adaptativo');

// Inicializar o app Express
const app = express();
const PORT = process.env.PORT || 3000;

// Variáveis para controle de atualização automática
let intervalAtualizacao = null;
let cronJobDiario = null;
let ultimaAtualizacao = null;
let statusAtualizacao = 'idle'; // idle, running, error

// Configuração de atualização automática (em minutos)
const INTERVALO_ATUALIZACAO = process.env.INTERVALO_ATUALIZACAO || 30; // 30 minutos por padrão

// Configuração de atualização diária (horário da meia-noite)
const HORARIO_ATUALIZACAO_DIARIA = process.env.HORARIO_ATUALIZACAO_DIARIA || '0 0 * * *'; // Meia-noite por padrão

// Middleware para CORS - ESSENCIAL para acesso externo
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, User-Agent');
  
  // Log todas as requisições para debug
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip || req.connection.remoteAddress}`);
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware para parsing de JSON
app.use(express.json());

// Middleware para trust proxy (importante para serviços de hospedagem)
app.set('trust proxy', true);

// Função para verificar se um arquivo existe
function arquivoExiste(caminho) {
  try {
    return fs.existsSync(caminho);
  } catch (err) {
    console.error(`Erro ao verificar arquivo ${caminho}:`, err);
    return false;
  }
}

// Função para obter o caminho do arquivo de jogos
function obterCaminhoArquivoJogos(data) {
  const dataFormatada = moment(data).format('YYYY-MM-DD');
  return path.join(__dirname, `jogos_${dataFormatada}.json`);
}

// Função para obter dados de jogos (com fallback para dados de exemplo)
function obterDadosJogos(data = null) {
  const dataAtual = data ? moment(data).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
  const caminhoArquivo = obterCaminhoArquivoJogos(dataAtual);
  
  if (arquivoExiste(caminhoArquivo)) {
    try {
      const dados = JSON.parse(fs.readFileSync(caminhoArquivo, 'utf8'));
      console.log(`Retornando dados reais para ${dataAtual} - ${dados.jogos ? dados.jogos.length : 0} jogos`);
      return dados;
    } catch (err) {
      console.error('Erro ao ler arquivo:', err);
    }
  }
  
  // Dados de exemplo mais realistas
  console.log(`Retornando dados de exemplo para ${dataAtual}`);
  return {
    data: dataAtual,
    totalJogos: 5,
    jogos: [
      {
        timeCasa: 'Flamengo',
        timeVisitante: 'Palmeiras',
        horario: '16:00',
        competicao: 'Campeonato Brasileiro',
        nivelCampeonato: 'Série A',
        status: 'Agendado',
        placarCasa: '',
        placarVisitante: ''
      },
      {
        timeCasa: 'Real Madrid',
        timeVisitante: 'Barcelona',
        horario: '18:30',
        competicao: 'La Liga',
        nivelCampeonato: 'Primera División',
        status: 'Agendado',
        placarCasa: '',
        placarVisitante: ''
      },
      {
        timeCasa: 'Manchester United',
        timeVisitante: 'Liverpool',
        horario: '21:00',
        competicao: 'Premier League',
        nivelCampeonato: 'First Division',
        status: 'Agendado',
        placarCasa: '',
        placarVisitante: ''
      },
      {
        timeCasa: 'Bayern Munich',
        timeVisitante: 'Borussia Dortmund',
        horario: '15:30',
        competicao: 'Bundesliga',
        nivelCampeonato: 'First Division',
        status: 'Agendado',
        placarCasa: '',
        placarVisitante: ''
      },
      {
        timeCasa: 'PSG',
        timeVisitante: 'Olympique Marseille',
        horario: '20:45',
        competicao: 'Ligue 1',
        nivelCampeonato: 'First Division',
        status: 'Agendado',
        placarCasa: '',
        placarVisitante: ''
      }
    ],
    observacao: 'Dados de exemplo - Execute o scraping para dados reais',
    servidor: 'API Deploy v1.0',
    timestamp: new Date().toISOString()
  };
}

// Função para filtrar jogos
function filtrarJogos(jogos, filtros) {
  return jogos.filter(jogo => {
    // Filtro por competição
    if (filtros.competicao && !jogo.competicao.toLowerCase().includes(filtros.competicao.toLowerCase())) {
      return false;
    }
    
    // Filtro por nível
    if (filtros.nivel && jogo.nivelCampeonato && !jogo.nivelCampeonato.toLowerCase().includes(filtros.nivel.toLowerCase())) {
      return false;
    }
    
    // Filtro por time (casa ou visitante)
    if (filtros.time) {
      const timeFilter = filtros.time.toLowerCase();
      if (!jogo.timeCasa.toLowerCase().includes(timeFilter) && 
          !jogo.timeVisitante.toLowerCase().includes(timeFilter)) {
        return false;
      }
    }
    
    // Filtro por status
    if (filtros.status && jogo.status && !jogo.status.toLowerCase().includes(filtros.status.toLowerCase())) {
      return false;
    }
    
    return true;
  });
}

// Função para obter competições únicas
function obterCompeticoes(jogos) {
  const competicoes = [...new Set(jogos.map(jogo => jogo.competicao).filter(Boolean))];
  return competicoes.sort();
}

// Função para obter níveis únicos
function obterNiveis(jogos) {
  const niveis = [...new Set(jogos.map(jogo => jogo.nivelCampeonato).filter(Boolean))];
  return niveis.sort();
}

// Função para obter times únicos
function obterTimes(jogos) {
  const times = new Set();
  jogos.forEach(jogo => {
    if (jogo.timeCasa) times.add(jogo.timeCasa);
    if (jogo.timeVisitante) times.add(jogo.timeVisitante);
  });
  return [...times].sort();
}

// Função para executar atualização automática
async function executarAtualizacaoAutomatica() {
  if (statusAtualizacao === 'running') {
    console.log('⏳ Atualização já em andamento, pulando...');
    return;
  }

  try {
    statusAtualizacao = 'running';
    console.log('🔄 Iniciando atualização automática dos dados...');
    
    // Executar o scraping adaptativo
    await scrapingAdaptativo();
    
    ultimaAtualizacao = new Date();
    statusAtualizacao = 'idle';
    
    console.log(`✅ Atualização automática concluída às ${ultimaAtualizacao.toLocaleString('pt-BR')}`);
    
  } catch (erro) {
    statusAtualizacao = 'error';
    console.error('❌ Erro na atualização automática:', erro.message);
    
    // Tentar novamente em 5 minutos em caso de erro
    setTimeout(() => {
      if (statusAtualizacao === 'error') {
        statusAtualizacao = 'idle';
      }
    }, 5 * 60 * 1000);
  }
}

// Função para iniciar atualização diária à meia-noite
function iniciarAtualizacaoDiaria() {
  if (cronJobDiario) {
    cronJobDiario.stop();
    cronJobDiario = null;
  }
  
  console.log(`🌙 Configurando atualização automática diária à meia-noite (${HORARIO_ATUALIZACAO_DIARIA})`);
  
  // Configurar cron job para executar à meia-noite
  cronJobDiario = cron.schedule(HORARIO_ATUALIZACAO_DIARIA, async () => {
    console.log('🌙 Executando atualização automática diária à meia-noite...');
    await executarAtualizacaoAutomatica();
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo'
  });
  
  console.log('✅ Atualização diária configurada com sucesso!');
}

// Função para iniciar atualização automática (mantida para compatibilidade)
function iniciarAtualizacaoAutomatica() {
  if (intervalAtualizacao) {
    clearInterval(intervalAtualizacao);
  }
  
  console.log(`🕐 Configurando atualização automática a cada ${INTERVALO_ATUALIZACAO} minutos`);
  
  // Executar primeira atualização após 2 minutos do início
  setTimeout(() => {
    executarAtualizacaoAutomatica();
  }, 2 * 60 * 1000);
  
  // Configurar intervalo de atualização
  intervalAtualizacao = setInterval(() => {
    executarAtualizacaoAutomatica();
  }, INTERVALO_ATUALIZACAO * 60 * 1000);
}

// Função para parar atualização diária
function pararAtualizacaoDiaria() {
  if (cronJobDiario) {
    cronJobDiario.stop();
    cronJobDiario = null;
    console.log('🛑 Atualização diária parada');
  }
}

// Função para parar atualização automática (mantida para compatibilidade)
function pararAtualizacaoAutomatica() {
  if (intervalAtualizacao) {
    clearInterval(intervalAtualizacao);
    intervalAtualizacao = null;
    console.log('🛑 Atualização automática parada');
  }
}

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: 'API de Jogos - Deploy Version Aprimorada com Atualização Automática',
    version: '2.1.0',
    status: 'online',
    atualizacaoAutomatica: {
      ativo: intervalAtualizacao !== null,
      intervalo: `${INTERVALO_ATUALIZACAO} minutos`,
      status: statusAtualizacao,
      ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null
    },
    atualizacaoDiaria: {
      ativo: cronJobDiario !== null,
      horario: 'Meia-noite (00:00)',
      cronExpression: HORARIO_ATUALIZACAO_DIARIA,
      timezone: 'America/Sao_Paulo',
      status: statusAtualizacao,
      ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null
    },
    endpoints: [
      'GET / - Esta página',
      'GET /api/status - Status da API',
      'GET /api/jogos - Jogos da data atual',
      'GET /api/jogos/data/:data - Jogos de uma data específica (YYYY-MM-DD)',
      'GET /api/jogos/competicao/:nome - Jogos de uma competição',
      'GET /api/jogos/nivel/:nome - Jogos de um nível de campeonato',
      'GET /api/jogos/time/:nome - Jogos de um time específico',
      'GET /api/competicoes - Lista todas as competições',
      'GET /api/niveis - Lista todos os níveis de campeonato',
      'GET /api/times - Lista todos os times',
      'POST /api/atualizar - Executar scraping manual',
      'POST /api/atualizar/iniciar - Iniciar atualização automática',
      'POST /api/atualizar/parar - Parar atualização automática',
      'POST /api/atualizar/diaria/iniciar - Iniciar atualização diária à meia-noite',
      'POST /api/atualizar/diaria/parar - Parar atualização diária',
      'GET /health - Health check'
    ],
    filtros: {
      'Query Parameters': {
        'competicao': 'Filtrar por competição',
        'nivel': 'Filtrar por nível do campeonato',
        'time': 'Filtrar por time (casa ou visitante)',
        'status': 'Filtrar por status do jogo'
      },
      'Exemplos': [
        '/api/jogos?competicao=Copa',
        '/api/jogos?time=Flamengo',
        '/api/jogos/data/2025-07-30?competicao=Copa&time=Corinthians'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Rota de health check (importante para serviços de hospedagem)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Rota de status/health check
app.get('/api/status', (req, res) => {
  console.log('Health check solicitado');
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    servidor: 'API de Jogos - Deploy Version Aprimorada',
    versao: '2.1.0',
    uptime: process.uptime(),
    atualizacaoAutomatica: {
      ativo: intervalAtualizacao !== null,
      intervalo: `${INTERVALO_ATUALIZACAO} minutos`,
      status: statusAtualizacao,
      ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null,
      proximaAtualizacao: intervalAtualizacao && ultimaAtualizacao ? 
        new Date(ultimaAtualizacao.getTime() + (INTERVALO_ATUALIZACAO * 60 * 1000)).toISOString() : null
    },
    atualizacaoDiaria: {
      ativo: cronJobDiario !== null,
      horario: 'Meia-noite (00:00)',
      cronExpression: HORARIO_ATUALIZACAO_DIARIA,
      timezone: 'America/Sao_Paulo',
      status: statusAtualizacao,
      ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null,
      proximaAtualizacao: cronJobDiario ? 'Próxima meia-noite (00:00)' : null
    },
    endpoints: [
      'GET /api/status',
      'GET /api/jogos',
      'GET /api/jogos/data/:data',
      'GET /api/jogos/competicao/:nome',
      'GET /api/jogos/nivel/:nome',
      'GET /api/jogos/time/:nome',
      'GET /api/competicoes',
      'GET /api/niveis',
      'GET /api/times',
      'POST /api/atualizar',
      'POST /api/atualizar/iniciar',
      'POST /api/atualizar/parar',
      'POST /api/atualizar/diaria/iniciar',
      'POST /api/atualizar/diaria/parar'
    ],
    recursos: {
      'Filtros disponíveis': ['competicao', 'nivel', 'time', 'status'],
      'Formatos de data': 'YYYY-MM-DD',
      'Query parameters': 'Suportados em todos os endpoints de jogos',
      'Atualização automática': 'Configurável via variável de ambiente INTERVALO_ATUALIZACAO',
      'Atualização diária': 'Executa automaticamente à meia-noite (timezone: America/Sao_Paulo)'
    }
  });
});

// Rota para obter jogos da data atual (com filtros opcionais)
app.get('/api/jogos', (req, res) => {
  try {
    console.log('Solicitação de jogos da data atual');
    const dados = obterDadosJogos();
    
    // Aplicar filtros se fornecidos
    const filtros = {
      competicao: req.query.competicao,
      nivel: req.query.nivel,
      time: req.query.time,
      status: req.query.status
    };
    
    if (Object.values(filtros).some(filtro => filtro)) {
      const jogosFiltrados = filtrarJogos(dados.jogos, filtros);
      return res.json({
        ...dados,
        totalJogos: jogosFiltrados.length,
        jogos: jogosFiltrados,
        filtrosAplicados: Object.fromEntries(Object.entries(filtros).filter(([k, v]) => v))
      });
    }
    
    return res.json(dados);
  } catch (erro) {
    console.error('Erro ao obter jogos:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para obter jogos de uma data específica
app.get('/api/jogos/data/:data', (req, res) => {
  try {
    const { data } = req.params;
    
    // Validar formato da data
    if (!moment(data, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        erro: 'Formato de data inválido',
        formato_esperado: 'YYYY-MM-DD',
        exemplo: '2025-07-30',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Solicitação de jogos para data: ${data}`);
    const dados = obterDadosJogos(data);
    
    // Aplicar filtros se fornecidos
    const filtros = {
      competicao: req.query.competicao,
      nivel: req.query.nivel,
      time: req.query.time,
      status: req.query.status
    };
    
    if (Object.values(filtros).some(filtro => filtro)) {
      const jogosFiltrados = filtrarJogos(dados.jogos, filtros);
      return res.json({
        ...dados,
        totalJogos: jogosFiltrados.length,
        jogos: jogosFiltrados,
        filtrosAplicados: Object.fromEntries(Object.entries(filtros).filter(([k, v]) => v))
      });
    }
    
    return res.json(dados);
  } catch (erro) {
    console.error('Erro ao obter jogos por data:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para obter jogos por competição
app.get('/api/jogos/competicao/:nome', (req, res) => {
  try {
    const { nome } = req.params;
    const data = req.query.data;
    
    console.log(`Solicitação de jogos da competição: ${nome}`);
    const dados = obterDadosJogos(data);
    
    const jogosFiltrados = filtrarJogos(dados.jogos, { competicao: nome });
    
    return res.json({
      ...dados,
      totalJogos: jogosFiltrados.length,
      jogos: jogosFiltrados,
      filtro: { competicao: nome }
    });
  } catch (erro) {
    console.error('Erro ao obter jogos por competição:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para obter jogos por nível
app.get('/api/jogos/nivel/:nome', (req, res) => {
  try {
    const { nome } = req.params;
    const data = req.query.data;
    
    console.log(`Solicitação de jogos do nível: ${nome}`);
    const dados = obterDadosJogos(data);
    
    const jogosFiltrados = filtrarJogos(dados.jogos, { nivel: nome });
    
    return res.json({
      ...dados,
      totalJogos: jogosFiltrados.length,
      jogos: jogosFiltrados,
      filtro: { nivel: nome }
    });
  } catch (erro) {
    console.error('Erro ao obter jogos por nível:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para obter jogos por time
app.get('/api/jogos/time/:nome', (req, res) => {
  try {
    const { nome } = req.params;
    const data = req.query.data;
    
    console.log(`Solicitação de jogos do time: ${nome}`);
    const dados = obterDadosJogos(data);
    
    const jogosFiltrados = filtrarJogos(dados.jogos, { time: nome });
    
    return res.json({
      ...dados,
      totalJogos: jogosFiltrados.length,
      jogos: jogosFiltrados,
      filtro: { time: nome }
    });
  } catch (erro) {
    console.error('Erro ao obter jogos por time:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para listar todas as competições
app.get('/api/competicoes', (req, res) => {
  try {
    const data = req.query.data;
    console.log('Solicitação de lista de competições');
    const dados = obterDadosJogos(data);
    
    const competicoes = obterCompeticoes(dados.jogos);
    
    return res.json({
      total: competicoes.length,
      competicoes: competicoes,
      data: dados.data,
      timestamp: new Date().toISOString()
    });
  } catch (erro) {
    console.error('Erro ao obter competições:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para listar todos os níveis
app.get('/api/niveis', (req, res) => {
  try {
    const data = req.query.data;
    console.log('Solicitação de lista de níveis');
    const dados = obterDadosJogos(data);
    
    const niveis = obterNiveis(dados.jogos);
    
    return res.json({
      total: niveis.length,
      niveis: niveis,
      data: dados.data,
      timestamp: new Date().toISOString()
    });
  } catch (erro) {
    console.error('Erro ao obter níveis:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para listar todos os times
app.get('/api/times', (req, res) => {
  try {
    const data = req.query.data;
    console.log('Solicitação de lista de times');
    const dados = obterDadosJogos(data);
    
    const times = obterTimes(dados.jogos);
    
    return res.json({
      total: times.length,
      times: times,
      data: dados.data,
      timestamp: new Date().toISOString()
    });
  } catch (erro) {
    console.error('Erro ao obter times:', erro);
    return res.status(500).json({ 
      erro: 'Erro interno do servidor', 
      detalhes: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para atualizar dados (executar scraping sob demanda)
app.post('/api/atualizar', async (req, res) => {
  try {
    console.log('🔄 Iniciando scraping sob demanda...');
    
    // Executar o scraping adaptativo
    await scrapingAdaptativo();
    
    // Aguardar um pouco para garantir que o arquivo foi salvo
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Tentar obter os dados atualizados
    const dados = obterDadosJogos();
    
    if (dados.observacao && dados.observacao.includes('exemplo')) {
      return res.status(202).json({
        status: 'parcial',
        mensagem: 'O scraping foi executado, mas ainda não há dados atualizados disponíveis',
        dados: dados,
        timestamp: new Date().toISOString()
      });
    }
    
    return res.json({
      status: 'sucesso',
      mensagem: 'Dados atualizados com sucesso via scraping',
      totalJogos: dados.totalJogos,
      dados: dados,
      timestamp: new Date().toISOString()
    });
    
  } catch (erro) {
    console.error('❌ Erro ao executar scraping:', erro);
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro ao executar o scraping',
      erro: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para iniciar atualização automática
app.post('/api/atualizar/iniciar', (req, res) => {
  try {
    if (intervalAtualizacao) {
      return res.json({
        status: 'info',
        mensagem: 'Atualização automática já está ativa',
        intervalo: `${INTERVALO_ATUALIZACAO} minutos`,
        ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null,
        timestamp: new Date().toISOString()
      });
    }
    
    iniciarAtualizacaoAutomatica();
    
    return res.json({
      status: 'sucesso',
      mensagem: 'Atualização automática iniciada com sucesso',
      intervalo: `${INTERVALO_ATUALIZACAO} minutos`,
      timestamp: new Date().toISOString()
    });
    
  } catch (erro) {
    console.error('❌ Erro ao iniciar atualização automática:', erro);
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro ao iniciar atualização automática',
      erro: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para parar atualização automática
app.post('/api/atualizar/parar', (req, res) => {
  try {
    if (!intervalAtualizacao) {
      return res.json({
        status: 'info',
        mensagem: 'Atualização automática já está inativa',
        timestamp: new Date().toISOString()
      });
    }
    
    pararAtualizacaoAutomatica();
    
    return res.json({
      status: 'sucesso',
      mensagem: 'Atualização automática parada com sucesso',
      timestamp: new Date().toISOString()
    });
    
  } catch (erro) {
    console.error('❌ Erro ao parar atualização automática:', erro);
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro ao parar atualização automática',
      erro: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para iniciar atualização diária
app.post('/api/atualizar/diaria/iniciar', (req, res) => {
  try {
    if (cronJobDiario) {
      return res.json({
        status: 'info',
        mensagem: 'Atualização diária já está ativa',
        horario: 'Meia-noite (00:00)',
        cronExpression: HORARIO_ATUALIZACAO_DIARIA,
        timezone: 'America/Sao_Paulo',
        ultimaAtualizacao: ultimaAtualizacao ? ultimaAtualizacao.toISOString() : null,
        timestamp: new Date().toISOString()
      });
    }
    
    iniciarAtualizacaoDiaria();
    
    return res.json({
      status: 'sucesso',
      mensagem: 'Atualização diária iniciada com sucesso',
      horario: 'Meia-noite (00:00)',
      cronExpression: HORARIO_ATUALIZACAO_DIARIA,
      timezone: 'America/Sao_Paulo',
      timestamp: new Date().toISOString()
    });
    
  } catch (erro) {
    console.error('❌ Erro ao iniciar atualização diária:', erro);
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro ao iniciar atualização diária',
      erro: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para parar atualização diária
app.post('/api/atualizar/diaria/parar', (req, res) => {
  try {
    if (!cronJobDiario) {
      return res.json({
        status: 'info',
        mensagem: 'Atualização diária já está inativa',
        timestamp: new Date().toISOString()
      });
    }
    
    pararAtualizacaoDiaria();
    
    return res.json({
      status: 'sucesso',
      mensagem: 'Atualização diária parada com sucesso',
      timestamp: new Date().toISOString()
    });
    
  } catch (erro) {
    console.error('❌ Erro ao parar atualização diária:', erro);
    return res.status(500).json({
      status: 'erro',
      mensagem: 'Erro ao parar atualização diária',
      erro: erro.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Tratamento de erros globais
process.on('uncaughtException', (err) => {
  console.error('Erro não capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejeitada não tratada:', reason);
});

// Iniciar o servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 API DE JOGOS - VERSÃO DEPLOY APRIMORADA v2.1!');
  console.log('='.repeat(80));
  console.log(`📡 Porta: ${PORT}`);
  console.log(`🌐 URL Local: http://localhost:${PORT}`);
  console.log(`🌍 URL Externa: Será fornecida pelo serviço de hospedagem`);
  console.log(`\n📋 Endpoints principais:`);
  console.log(`   ✅ GET  / - Página inicial com documentação`);
  console.log(`   ✅ GET  /health - Health check`);
  console.log(`   ✅ GET  /api/status - Status da API`);
  console.log(`   ✅ GET  /api/jogos - Jogos da data atual`);
  console.log(`\n🎯 Endpoints de filtros:`);
  console.log(`   🆕 GET  /api/jogos/data/:data - Jogos por data (YYYY-MM-DD)`);
  console.log(`   🆕 GET  /api/jogos/competicao/:nome - Jogos por competição`);
  console.log(`   🆕 GET  /api/jogos/nivel/:nome - Jogos por nível`);
  console.log(`   🆕 GET  /api/jogos/time/:nome - Jogos por time`);
  console.log(`\n📊 Endpoints de listagem:`);
  console.log(`   📋 GET  /api/competicoes - Lista todas as competições`);
  console.log(`   📋 GET  /api/niveis - Lista todos os níveis`);
  console.log(`   📋 GET  /api/times - Lista todos os times`);
  console.log(`\n🔄 Endpoints de atualização:`);
  console.log(`   🆕 POST /api/atualizar - Executar scraping manual`);
  console.log(`   🆕 POST /api/atualizar/iniciar - Iniciar atualização automática`);
  console.log(`   🆕 POST /api/atualizar/parar - Parar atualização automática`);
  console.log(`   🌙 POST /api/atualizar/diaria/iniciar - Iniciar atualização diária`);
  console.log(`   🌙 POST /api/atualizar/diaria/parar - Parar atualização diária`);
  console.log(`\n🔍 Query Parameters disponíveis:`);
  console.log(`   • ?competicao=nome - Filtrar por competição`);
  console.log(`   • ?nivel=nome - Filtrar por nível`);
  console.log(`   • ?time=nome - Filtrar por time`);
  console.log(`   • ?status=status - Filtrar por status`);
  console.log(`   • ?data=YYYY-MM-DD - Para endpoints de listagem`);
  console.log(`\n💡 Exemplos de uso:`);
  console.log(`   🔗 /api/jogos?competicao=Copa`);
  console.log(`   🔗 /api/jogos?time=Flamengo`);
  console.log(`   🔗 /api/jogos/data/2025-07-30?competicao=Copa&time=Corinthians`);
  console.log(`\n🔧 Configurações ativas:`);
  console.log(`   • CORS habilitado para TODAS as origens`);
  console.log(`   • Logs detalhados de requisições`);
  console.log(`   • Trust proxy habilitado`);
  console.log(`   • Health check para monitoramento`);
  console.log(`   • Sistema de filtros avançado`);
  console.log(`   • Validação de parâmetros`);
  console.log(`   • Dados de exemplo quando arquivo não existe`);
  console.log(`   • Atualização automática a cada ${INTERVALO_ATUALIZACAO} minutos`);
  console.log(`   • Atualização diária à meia-noite (timezone: America/Sao_Paulo)`);
  console.log(`\n💡 Pronto para deploy em:`);
  console.log(`   • Render.com`);
  console.log(`   • Railway.app`);
  console.log(`   • Vercel.com`);
  console.log(`   • Heroku`);
  console.log(`\n🌙 Iniciando sistema de atualização diária...`);
  
  // Iniciar atualização diária (principal)
  iniciarAtualizacaoDiaria();
  
  console.log(`\n🕐 Sistema de atualização por intervalo disponível via API...`);
  console.log(`   Use POST /api/atualizar/iniciar para ativar atualização por intervalo`);
  
  console.log(`\n⏳ Aguardando requisições...`);
  console.log('='.repeat(80));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT (Ctrl+C), encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso.');
    process.exit(0);
  });
});

// Export para compatibilidade com alguns serviços
module.exports = app;