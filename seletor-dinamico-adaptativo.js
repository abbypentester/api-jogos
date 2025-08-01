const puppeteer = require('puppeteer');
const fs = require('fs');
const moment = require('moment');

// Configurar o momento para português do Brasil
moment.locale('pt-br');

/**
 * Sistema Adaptativo de Seletores Dinâmicos
 * 
 * Este sistema detecta automaticamente mudanças nos seletores CSS do site
 * e se adapta a elas, garantindo que o scraping continue funcionando
 * mesmo quando o site atualiza suas classes CSS.
 */
class SeletorDinamicoAdaptativo {
  constructor() {
    // Padrões conhecidos para diferentes elementos (mais abrangentes)
    this.padroes = {
      cards: [
        'ul.grid.MatchCardsList_matches__8_UwB > li',
        'ul[class*="MatchCardsList"] > li',
        'li[class*="MatchCard"]',
        'div[class*="MatchCard"]',
        'article[class*="SimpleMatchCard"]',
        '[data-testid="match-card"]',
        'li[class*="match"]',
        'div[class*="match"]',
        'article[class*="match"]',
        '.match-card',
        '.game-card',
        '[class*="card"][class*="match"]',
        'li:has([class*="team"])',
        'div:has([class*="team"])',
        'article:has([class*="team"])'
      ],
      nomeTime: [
        '.SimpleMatchCardTeam_simpleMatchCardTeam__name__7Ud8D',
        '[class*="simpleMatchCardTeam__name"]',
        '[class*="TeamName"]',
        '[class*="team__name"]',
        '[class*="matchCardTeam__name"]',
        '[class*="team-name"]',
        '[class*="teamName"]',
        '[class*="club-name"]',
        '[class*="clubName"]',
        '.team-name',
        '.club-name',
        '[data-testid*="team"]',
        '[data-testid*="club"]',
        'span[class*="name"]',
        'div[class*="name"]',
        'p[class*="name"]'
      ],
      horario: [
        '.SimpleMatchCard_simpleMatchCard__infoMessage___NJqW.title-8-bold',
        'time',
        '[class*="infoMessage"]',
        '[class*="matchTime"]',
        '[class*="gameTime"]',
        '[class*="match-time"]',
        '[class*="game-time"]',
        '[datetime]',
        '[class*="time"]',
        '[class*="hour"]',
        '[class*="schedule"]',
        '.time',
        '.hour',
        '.schedule'
      ],
      placar: [
        '.SimpleMatchCardTeam_simpleMatchCardTeam__score__UYMc_',
        '[class*="score"]',
        '[class*="placar"]',
        '[class*="result"]',
        '[class*="goals"]',
        '[class*="points"]',
        '.score',
        '.placar',
        '.result',
        '.goals',
        '[data-testid*="score"]'
      ],
      status: [
        '.ot-label-status',
        '[class*="status"]',
        '[class*="state"]',
        '[class*="live"]',
        '[class*="finished"]',
        '[class*="upcoming"]',
        '.status',
        '.state',
        '.live',
        '[data-testid*="status"]'
      ],
      competicao: [
        '[class*="title-6-bold"][class*="leftAlign"]',
        '[class*="SectionHeader"]',
        '[class*="competition"]',
        '[class*="league"]',
        '[class*="tournament"]',
        'h2[class*="title"]',
        'h3[class*="title"]',
        'h4[class*="title"]',
        '.competition',
        '.league',
        '.tournament',
        '[data-testid*="competition"]',
        '[data-testid*="league"]'
      ]
    };
    
    // Cache de seletores funcionais
    this.seletoresFuncionais = {};
    
    // Histórico de seletores para análise de padrões
    this.historicoSeletores = [];
  }

  /**
   * Detecta automaticamente os seletores funcionais na página
   */
  async detectarSeletores(page) {
    console.log('🔍 Detectando seletores funcionais...');
    
    const seletoresDetectados = await page.evaluate((padroes) => {
      const resultados = {};
      
      // Função para testar um seletor
      const testarSeletor = (seletor) => {
        try {
          const elementos = document.querySelectorAll(seletor);
          return {
            funciona: elementos.length > 0,
            quantidade: elementos.length,
            amostraTexto: elementos.length > 0 ? elementos[0].innerText?.substring(0, 50) : ''
          };
        } catch (erro) {
          return { funciona: false, quantidade: 0, amostraTexto: '' };
        }
      };
      
      // Função para calcular prioridade (movida para dentro do evaluate)
      const calcularPrioridade = (seletor, quantidade) => {
        let prioridade = quantidade;
        
        // Bonus para seletores mais específicos
        if (seletor.includes('__')) prioridade += 10; // CSS Modules
        if (seletor.includes('[class*=')) prioridade += 5; // Seletores de atributo
        if (seletor.includes('>')) prioridade += 3; // Seletores filhos diretos
        
        return prioridade;
      };
      
      // Testar cada categoria de seletores
      Object.keys(padroes).forEach(categoria => {
        resultados[categoria] = [];
        
        padroes[categoria].forEach(seletor => {
          const teste = testarSeletor(seletor);
          if (teste.funciona) {
            resultados[categoria].push({
              seletor,
              quantidade: teste.quantidade,
              amostraTexto: teste.amostraTexto,
              prioridade: calcularPrioridade(seletor, teste.quantidade)
            });
          }
        });
        
        // Ordenar por prioridade (maior primeiro)
        resultados[categoria].sort((a, b) => b.prioridade - a.prioridade);
      });
      
      return resultados;
    }, this.padroes);
    
    // Atualizar cache de seletores funcionais
    Object.keys(seletoresDetectados).forEach(categoria => {
      if (seletoresDetectados[categoria].length > 0) {
        this.seletoresFuncionais[categoria] = seletoresDetectados[categoria][0].seletor;
      }
    });
    
    // Salvar histórico
    this.historicoSeletores.push({
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      seletores: { ...this.seletoresFuncionais }
    });
    
    console.log('✅ Seletores detectados:', this.seletoresFuncionais);
    return this.seletoresFuncionais;
  }
  
  /**
   * Calcula a prioridade de um seletor baseado em sua especificidade e quantidade de elementos
   */
  calcularPrioridade(seletor, quantidade) {
    let prioridade = quantidade;
    
    // Bonus para seletores mais específicos
    if (seletor.includes('__')) prioridade += 10; // CSS Modules
    if (seletor.includes('[class*=')) prioridade += 5; // Seletores de atributo
    if (seletor.includes('>')) prioridade += 3; // Seletores filhos diretos
    
    return prioridade;
  }
  
  /**
   * Busca automaticamente por novos seletores quando os atuais falham
   */
  async buscarNovosSeletores(page, categoria) {
    console.log(`🔄 Buscando novos seletores para categoria: ${categoria}`);
    
    const novosSeletores = await page.evaluate((cat) => {
      const elementos = document.querySelectorAll('*');
      const candidatos = [];
      
      // Estratégias de busca baseadas na categoria
      const estrategias = {
        cards: (el) => {
          const classes = el.className.toLowerCase();
          const tag = el.tagName.toLowerCase();
          return (classes.includes('match') || classes.includes('card') || classes.includes('game')) &&
                 (tag === 'li' || tag === 'div' || tag === 'article') &&
                 el.offsetWidth > 200 && el.offsetHeight > 50;
        },
        nomeTime: (el) => {
          const classes = el.className.toLowerCase();
          const texto = el.innerText?.trim();
          return (classes.includes('team') || classes.includes('name')) &&
                 texto && texto.length > 2 && texto.length < 50 &&
                 !/\d{1,2}:\d{2}/.test(texto); // Não é horário
        },
        horario: (el) => {
          const texto = el.innerText?.trim();
          return /^\d{1,2}:\d{2}$/.test(texto) || el.tagName.toLowerCase() === 'time';
        },
        placar: (el) => {
          const classes = el.className.toLowerCase();
          const texto = el.innerText?.trim();
          return (classes.includes('score') || classes.includes('placar')) ||
                 /^\d+$/.test(texto);
        },
        status: (el) => {
          const classes = el.className.toLowerCase();
          const texto = el.innerText?.toLowerCase();
          return classes.includes('status') || classes.includes('live') ||
                 ['ao vivo', 'fim de jogo', 'intervalo'].some(status => texto.includes(status));
        },
        competicao: (el) => {
          const classes = el.className.toLowerCase();
          const tag = el.tagName.toLowerCase();
          const texto = el.innerText?.trim();
          return (classes.includes('title') || classes.includes('header') || 
                  classes.includes('competition') || classes.includes('league')) &&
                 (tag.startsWith('h') || classes.includes('title')) &&
                 texto && texto.length > 5;
        }
      };
      
      // Função para gerar seletor (movida para dentro do evaluate)
      const gerarSeletor = (elemento) => {
        // Implementação simplificada - pode ser expandida
        if (elemento.id) {
          return `#${elemento.id}`;
        }
        
        if (elemento.className) {
          const classes = Array.from(elemento.classList)
            .filter(cls => cls.length > 0)
            .slice(0, 2); // Usar no máximo 2 classes
          
          if (classes.length > 0) {
            return `.${classes.join('.')}`;
          }
        }
        
        return elemento.tagName.toLowerCase();
      };
      
      // Aplicar estratégia específica da categoria
      if (estrategias[cat]) {
        Array.from(elementos).forEach(el => {
          if (estrategias[cat](el)) {
            const seletor = gerarSeletor(el);
            if (seletor) {
              candidatos.push({
                seletor,
                elemento: {
                  tag: el.tagName.toLowerCase(),
                  classes: Array.from(el.classList),
                  texto: el.innerText?.substring(0, 50),
                  quantidade: document.querySelectorAll(seletor).length
                }
              });
            }
          }
        });
      }
      
      return candidatos;
    }, categoria);
    
    if (novosSeletores.length > 0) {
      console.log(`✅ Encontrados ${novosSeletores.length} novos candidatos para ${categoria}`);
      // Atualizar padrões com os novos seletores encontrados
      this.padroes[categoria] = [...new Set([
        ...novosSeletores.map(c => c.seletor),
        ...this.padroes[categoria]
      ])];
      
      return novosSeletores[0].seletor;
    }
    
    console.log(`❌ Nenhum novo seletor encontrado para ${categoria}`);
    return null;
  }
  
  /**
   * Gera um seletor CSS único para um elemento
   */
  gerarSeletor(elemento) {
    // Implementação simplificada - pode ser expandida
    if (elemento.id) {
      return `#${elemento.id}`;
    }
    
    if (elemento.className) {
      const classes = Array.from(elemento.classList)
        .filter(cls => cls.length > 0)
        .slice(0, 2); // Usar no máximo 2 classes
      
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }
    
    return elemento.tagName.toLowerCase();
  }
  
  /**
   * Extrai dados usando os seletores adaptativos
   */
  async extrairDados(page) {
    console.log('📊 Extraindo dados com seletores adaptativos...');
    
    // Primeiro, detectar seletores funcionais
    await this.detectarSeletores(page);
    
    const dados = await page.evaluate((seletores) => {
      const limparTexto = (texto) => texto ? texto.trim().replace(/\s+/g, ' ') : '';
      const listaJogos = [];
      
      // Buscar cards de jogos
      let cards = [];
      if (seletores.cards) {
        cards = document.querySelectorAll(seletores.cards);
      }
      
      // Se não encontrar cards, tentar buscar automaticamente
      if (cards.length === 0) {
        console.log('⚠️ Nenhum card encontrado com seletor atual, buscando automaticamente...');
        // Buscar elementos que parecem ser cards de jogos
        const possiveisCards = document.querySelectorAll('li, div, article');
        cards = Array.from(possiveisCards).filter(el => {
          const classes = el.className.toLowerCase();
          const texto = el.innerText;
          return (classes.includes('match') || classes.includes('card') || classes.includes('game')) &&
                 el.offsetWidth > 200 && el.offsetHeight > 50 &&
                 texto && texto.length > 10;
        });
      }
      
      console.log(`Processando ${cards.length} cards encontrados...`);
      
      // Processar cada card
      Array.from(cards).forEach((card, index) => {
        try {
          const todosTextos = card.innerText;
          
          // Extrair nomes dos times
          let timeCasa = 'Time não identificado';
          let timeVisitante = 'Time não identificado';
          
          if (seletores.nomeTime) {
            const elementosTime = card.querySelectorAll(seletores.nomeTime);
            if (elementosTime.length >= 2) {
              timeCasa = limparTexto(elementosTime[0].innerText);
              timeVisitante = limparTexto(elementosTime[1].innerText);
            }
          }
          
          // Se não conseguir extrair times com seletor, tentar por texto
          if (timeCasa === 'Time não identificado') {
            const linhas = todosTextos.split('\n').filter(linha => linha.trim() !== '');
            const possiveisNomes = linhas.filter(linha => {
              const texto = linha.trim();
              return texto.length > 2 && texto.length < 50 && 
                     !/\d{1,2}:\d{2}/.test(texto) && // Não é horário
                     !/^\d+$/.test(texto); // Não é número
            });
            
            if (possiveisNomes.length >= 2) {
              timeCasa = possiveisNomes[0];
              timeVisitante = possiveisNomes[1];
            }
          }
          
          // Extrair horário
          let horario = '';
          if (seletores.horario) {
            const horarioElement = card.querySelector(seletores.horario);
            if (horarioElement) {
              horario = limparTexto(horarioElement.innerText);
            }
          }
          
          // Se não conseguir extrair horário com seletor, tentar por regex
          if (!horario) {
            const horarioMatch = todosTextos.match(/\d{1,2}:\d{2}/);
            if (horarioMatch) {
              horario = horarioMatch[0];
            }
          }
          
          // Extrair placar
          let placarCasa = '';
          let placarVisitante = '';
          
          if (seletores.placar) {
            const placarElements = card.querySelectorAll(seletores.placar);
            if (placarElements.length >= 2) {
              placarCasa = limparTexto(placarElements[0].innerText);
              placarVisitante = limparTexto(placarElements[1].innerText);
            }
          }
          
          // Se não conseguir extrair placar com seletor, tentar por regex
          if (!placarCasa && !placarVisitante) {
            const placarMatch = todosTextos.match(/(\d+)\s*[-x]\s*(\d+)/);
            if (placarMatch) {
              placarCasa = placarMatch[1];
              placarVisitante = placarMatch[2];
            }
          }
          
          // Extrair status
          let status = '';
          if (seletores.status) {
            const statusElement = card.querySelector(seletores.status);
            if (statusElement) {
              status = limparTexto(statusElement.innerText);
            }
          }
          
          // Se não conseguir extrair status com seletor, tentar por texto
          if (!status) {
            const statusPossiveis = ['Ao vivo', 'Fim de jogo', 'Intervalo', 'Adiado', 'Cancelado'];
            const linhas = todosTextos.split('\n');
            for (const linha of linhas) {
              if (statusPossiveis.some(termo => linha.includes(termo))) {
                status = linha.trim();
                break;
              }
            }
          }
          
          // Extrair competição
          let competicao = 'Competição não identificada';
          const secaoAtual = card.closest('section');
          
          if (secaoAtual && seletores.competicao) {
            const competicaoElement = secaoAtual.querySelector(seletores.competicao);
            if (competicaoElement && !competicaoElement.innerText.includes('Os jogos de hoje')) {
              competicao = limparTexto(competicaoElement.innerText);
            }
          }
          
          // Adicionar jogo à lista se tiver informações mínimas
          if (timeCasa !== 'Time não identificado' || timeVisitante !== 'Time não identificado') {
            listaJogos.push({
              timeCasa,
              timeVisitante,
              horario,
              status,
              placarCasa,
              placarVisitante,
              competicao,
              nivelCampeonato: '',
              metadados: {
                cardIndex: index,
                seletoresUsados: seletores,
                textoCompleto: todosTextos.substring(0, 200)
              }
            });
          }
        } catch (erro) {
          console.error('Erro ao processar card:', erro);
        }
      });
      
      return listaJogos;
    }, this.seletoresFuncionais);
    
    console.log(`✅ Extraídos ${dados.length} jogos com sucesso`);
    return dados;
  }
  
  /**
   * Salva o histórico de seletores para análise futura
   */
  salvarHistorico() {
    const nomeArquivo = `historico-seletores_${moment().format('YYYY-MM-DD')}.json`;
    const dados = {
      ultimaAtualizacao: moment().format('YYYY-MM-DD HH:mm:ss'),
      seletoresFuncionais: this.seletoresFuncionais,
      padroes: this.padroes,
      historico: this.historicoSeletores
    };
    
    fs.writeFileSync(nomeArquivo, JSON.stringify(dados, null, 2));
    console.log(`📁 Histórico de seletores salvo em: ${nomeArquivo}`);
  }
  
  /**
   * Carrega histórico de seletores de execuções anteriores
   */
  carregarHistorico() {
    const arquivos = fs.readdirSync('./')
      .filter(arquivo => arquivo.startsWith('historico-seletores_') && arquivo.endsWith('.json'))
      .sort()
      .reverse(); // Mais recente primeiro
    
    if (arquivos.length > 0) {
      try {
        const dados = JSON.parse(fs.readFileSync(arquivos[0], 'utf8'));
        this.seletoresFuncionais = dados.seletoresFuncionais || {};
        this.padroes = { ...this.padroes, ...dados.padroes };
        this.historicoSeletores = dados.historico || [];
        console.log(`📂 Histórico carregado de: ${arquivos[0]}`);
      } catch (erro) {
        console.log('⚠️ Erro ao carregar histórico, usando configuração padrão');
      }
    }
  }
}

/**
 * Função principal para scraping com seletores adaptativos
 */
async function scrapingAdaptativo(url = 'https://onefootball.com/pt-br/jogos') {
  console.log('🚀 Iniciando scraping adaptativo...');
  
  const seletorAdaptativo = new SeletorDinamicoAdaptativo();
  
  // Carregar histórico de execuções anteriores
  seletorAdaptativo.carregarHistorico();
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    
    console.log(`🌐 Navegando para: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Aguardar carregamento
    await page.waitForTimeout(5000);
    
    // Extrair dados
    const jogos = await seletorAdaptativo.extrairDados(page);
    
    // Salvar resultados
    const resultado = {
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      url,
      totalJogos: jogos.length,
      seletoresUsados: seletorAdaptativo.seletoresFuncionais,
      jogos
    };
    
    // Salvar histórico
    seletorAdaptativo.salvarHistorico();
    
    return resultado;
    
  } catch (erro) {
    console.error('❌ Erro durante o scraping:', erro);
    throw erro;
  } finally {
    await browser.close();
  }
}

module.exports = {
  SeletorDinamicoAdaptativo,
  scrapingAdaptativo
};