const puppeteer = require('puppeteer');
const fs = require('fs');
const moment = require('moment');
const { SeletorDinamicoAdaptativo } = require('./seletor-dinamico-adaptativo');

// Configurar o momento para português do Brasil
moment.locale('pt-br');

/**
 * Sistema de Validação e Recuperação Automática
 * 
 * Este sistema valida continuamente os seletores e implementa
 * estratégias de recuperação automática quando detecta falhas.
 */
class ValidadorRecuperacaoAutomatica {
  constructor(opcoes = {}) {
    this.opcoes = {
      tentativasMaximas: opcoes.tentativasMaximas || 5,
      timeoutValidacao: opcoes.timeoutValidacao || 10000,
      intervaloTentativas: opcoes.intervaloTentativas || 2000,
      salvarLogs: opcoes.salvarLogs !== false,
      estrategiasRecuperacao: opcoes.estrategiasRecuperacao || [
        'recarregarPagina',
        'detectarNovosSeletores',
        'usarSeletoresAlternativos',
        'extrairPorTexto',
        'analisarEstruturaDom'
      ]
    };
    
    this.seletorAdaptativo = new SeletorDinamicoAdaptativo();
    this.historicoValidacoes = [];
    this.estrategiasUsadas = [];
    this.metricas = {
      validacoesRealizadas: 0,
      falhasDetectadas: 0,
      recuperacoesBemsucedidas: 0,
      estrategiasAplicadas: {},
      tempoTotalValidacao: 0
    };
  }
  
  /**
   * Valida se um seletor específico está funcionando
   */
  async validarSeletor(page, categoria, seletor) {
    const inicioValidacao = Date.now();
    
    try {
      const resultado = await page.evaluate((sel) => {
        try {
          const elementos = document.querySelectorAll(sel);
          const amostras = Array.from(elementos).slice(0, 3).map(el => ({
            tag: el.tagName.toLowerCase(),
            classes: Array.from(el.classList),
            texto: el.innerText?.substring(0, 50),
            posicao: {
              x: el.offsetLeft,
              y: el.offsetTop,
              width: el.offsetWidth,
              height: el.offsetHeight
            }
          }));
          
          return {
            sucesso: true,
            quantidade: elementos.length,
            amostras,
            tempoExecucao: Date.now()
          };
        } catch (erro) {
          return {
            sucesso: false,
            erro: erro.message,
            tempoExecucao: Date.now()
          };
        }
      }, seletor);
      
      const tempoValidacao = Date.now() - inicioValidacao;
      this.metricas.tempoTotalValidacao += tempoValidacao;
      
      const validacao = {
        categoria,
        seletor,
        resultado,
        tempoValidacao,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
      
      this.historicoValidacoes.push(validacao);
      this.metricas.validacoesRealizadas++;
      
      if (!resultado.sucesso || resultado.quantidade === 0) {
        this.metricas.falhasDetectadas++;
        console.log(`❌ Validação falhou para ${categoria}: ${seletor}`);
        return false;
      }
      
      console.log(`✅ Validação bem-sucedida para ${categoria}: ${resultado.quantidade} elementos`);
      return true;
      
    } catch (erro) {
      console.error(`💥 Erro durante validação de ${categoria}:`, erro.message);
      this.metricas.falhasDetectadas++;
      return false;
    }
  }
  
  /**
   * Valida todos os seletores atuais
   */
  async validarTodosSeletores(page) {
    console.log('🔍 Validando todos os seletores...');
    
    const resultados = {};
    const seletores = this.seletorAdaptativo.seletoresFuncionais;
    
    for (const [categoria, seletor] of Object.entries(seletores)) {
      if (seletor) {
        resultados[categoria] = await this.validarSeletor(page, categoria, seletor);
      } else {
        resultados[categoria] = false;
        console.log(`⚠️ Nenhum seletor definido para ${categoria}`);
      }
    }
    
    const categoriasFalhando = Object.keys(resultados)
      .filter(cat => !resultados[cat]);
    
    if (categoriasFalhando.length > 0) {
      console.log(`🚨 Categorias com falha: ${categoriasFalhando.join(', ')}`);
      return { sucesso: false, falhas: categoriasFalhando, resultados };
    }
    
    console.log('✅ Todos os seletores validados com sucesso');
    return { sucesso: true, falhas: [], resultados };
  }
  
  /**
   * Estratégia 1: Recarregar a página
   */
  async estrategiaRecarregarPagina(page, url) {
    console.log('🔄 Aplicando estratégia: Recarregar página');
    
    try {
      await page.reload({ waitUntil: 'networkidle2', timeout: this.opcoes.timeoutValidacao });
      await page.waitForTimeout(3000);
      
      console.log('✅ Página recarregada com sucesso');
      return true;
    } catch (erro) {
      console.log('❌ Falha ao recarregar página:', erro.message);
      return false;
    }
  }
  
  /**
   * Estratégia 2: Detectar novos seletores
   */
  async estrategiaDetectarNovosSeletores(page) {
    console.log('🔍 Aplicando estratégia: Detectar novos seletores');
    
    try {
      const seletoresAnteriores = { ...this.seletorAdaptativo.seletoresFuncionais };
      await this.seletorAdaptativo.detectarSeletores(page);
      
      // Verificar se encontrou seletores diferentes
      const mudancas = Object.keys(this.seletorAdaptativo.seletoresFuncionais)
        .filter(cat => 
          this.seletorAdaptativo.seletoresFuncionais[cat] !== seletoresAnteriores[cat]
        );
      
      if (mudancas.length > 0) {
        console.log(`✅ Novos seletores detectados para: ${mudancas.join(', ')}`);
        return true;
      }
      
      console.log('⚠️ Nenhum novo seletor detectado');
      return false;
    } catch (erro) {
      console.log('❌ Falha ao detectar novos seletores:', erro.message);
      return false;
    }
  }
  
  /**
   * Estratégia 3: Usar seletores alternativos
   */
  async estrategiaUsarSeletoresAlternativos(page, categoriasFalhando) {
    console.log('🔀 Aplicando estratégia: Usar seletores alternativos');
    
    let sucessos = 0;
    
    for (const categoria of categoriasFalhando) {
      const padroes = this.seletorAdaptativo.padroes[categoria] || [];
      
      for (const seletorAlternativo of padroes) {
        if (seletorAlternativo !== this.seletorAdaptativo.seletoresFuncionais[categoria]) {
          const funciona = await this.validarSeletor(page, categoria, seletorAlternativo);
          
          if (funciona) {
            this.seletorAdaptativo.seletoresFuncionais[categoria] = seletorAlternativo;
            console.log(`✅ Seletor alternativo funcionando para ${categoria}: ${seletorAlternativo}`);
            sucessos++;
            break;
          }
        }
      }
    }
    
    return sucessos > 0;
  }
  
  /**
   * Estratégia 4: Extrair por texto (fallback)
   */
  async estrategiaExtrairPorTexto(page) {
    console.log('📝 Aplicando estratégia: Extrair por texto');
    
    try {
      const dadosExtraidos = await page.evaluate(() => {
        // Buscar elementos que contenham texto relevante
        const elementos = document.querySelectorAll('*');
        const dados = {
          times: [],
          horarios: [],
          placares: [],
          competicoes: []
        };
        
        Array.from(elementos).forEach(el => {
          const texto = el.innerText?.trim();
          if (!texto || texto.length > 100) return;
          
          // Detectar horários
          if (/^\d{1,2}:\d{2}$/.test(texto)) {
            dados.horarios.push({
              texto,
              elemento: el.tagName.toLowerCase(),
              classes: Array.from(el.classList)
            });
          }
          
          // Detectar placares
          if (/^\d+$/.test(texto) && texto.length <= 2) {
            dados.placares.push({
              texto,
              elemento: el.tagName.toLowerCase(),
              classes: Array.from(el.classList)
            });
          }
          
          // Detectar nomes de times (heurística)
          if (texto.length > 2 && texto.length < 50 && 
              !/\d{1,2}:\d{2}/.test(texto) && 
              !/^\d+$/.test(texto) &&
              !texto.includes('vs') &&
              !texto.includes('x')) {
            dados.times.push({
              texto,
              elemento: el.tagName.toLowerCase(),
              classes: Array.from(el.classList)
            });
          }
          
          // Detectar competições
          if ((el.tagName.toLowerCase().startsWith('h') || 
               Array.from(el.classList).some(cls => cls.includes('title'))) &&
              texto.length > 5 && texto.length < 100) {
            dados.competicoes.push({
              texto,
              elemento: el.tagName.toLowerCase(),
              classes: Array.from(el.classList)
            });
          }
        });
        
        return dados;
      });
      
      // Analisar dados extraídos e tentar gerar novos seletores
      const novosSeletores = this.analisarDadosTexto(dadosExtraidos);
      
      if (Object.keys(novosSeletores).length > 0) {
        console.log('✅ Novos seletores gerados a partir do texto:', novosSeletores);
        Object.assign(this.seletorAdaptativo.seletoresFuncionais, novosSeletores);
        return true;
      }
      
      console.log('⚠️ Não foi possível gerar seletores a partir do texto');
      return false;
    } catch (erro) {
      console.log('❌ Falha na extração por texto:', erro.message);
      return false;
    }
  }
  
  /**
   * Analisa dados extraídos por texto e gera seletores
   */
  analisarDadosTexto(dados) {
    const novosSeletores = {};
    
    // Analisar horários
    if (dados.horarios.length > 0) {
      const classesComuns = this.encontrarClassesComuns(dados.horarios);
      if (classesComuns.length > 0) {
        novosSeletores.horario = `.${classesComuns[0]}`;
      }
    }
    
    // Analisar placares
    if (dados.placares.length > 0) {
      const classesComuns = this.encontrarClassesComuns(dados.placares);
      if (classesComuns.length > 0) {
        novosSeletores.placar = `.${classesComuns[0]}`;
      }
    }
    
    // Analisar times
    if (dados.times.length > 0) {
      const classesComuns = this.encontrarClassesComuns(dados.times);
      if (classesComuns.length > 0) {
        novosSeletores.nomeTime = `.${classesComuns[0]}`;
      }
    }
    
    return novosSeletores;
  }
  
  /**
   * Encontra classes CSS comuns entre elementos
   */
  encontrarClassesComuns(elementos) {
    if (elementos.length === 0) return [];
    
    const contadorClasses = {};
    
    elementos.forEach(el => {
      el.classes.forEach(classe => {
        if (classe && classe.length > 3) { // Ignorar classes muito curtas
          contadorClasses[classe] = (contadorClasses[classe] || 0) + 1;
        }
      });
    });
    
    // Retornar classes que aparecem em pelo menos 50% dos elementos
    const limiteMinimo = Math.ceil(elementos.length * 0.5);
    return Object.keys(contadorClasses)
      .filter(classe => contadorClasses[classe] >= limiteMinimo)
      .sort((a, b) => contadorClasses[b] - contadorClasses[a]);
  }
  
  /**
   * Estratégia 5: Analisar estrutura do DOM
   */
  async estrategiaAnalisarEstruturaDom(page) {
    console.log('🏗️ Aplicando estratégia: Analisar estrutura do DOM');
    
    try {
      const estrutura = await page.evaluate(() => {
        // Analisar a estrutura hierárquica do DOM
        const analisarElemento = (elemento, profundidade = 0) => {
          if (profundidade > 5) return null; // Limitar profundidade
          
          const info = {
            tag: elemento.tagName.toLowerCase(),
            classes: Array.from(elemento.classList),
            id: elemento.id,
            texto: elemento.innerText?.substring(0, 100),
            filhos: []
          };
          
          // Analisar filhos relevantes
          Array.from(elemento.children).forEach(filho => {
            const filhoInfo = analisarElemento(filho, profundidade + 1);
            if (filhoInfo) {
              info.filhos.push(filhoInfo);
            }
          });
          
          return info;
        };
        
        // Buscar containers principais
        const containers = document.querySelectorAll('main, section, div[class*="container"], div[class*="content"]');
        return Array.from(containers).map(container => analisarElemento(container));
      });
      
      // Analisar estrutura e tentar identificar padrões
      const padroes = this.identificarPadroesEstrutura(estrutura);
      
      if (padroes.length > 0) {
        console.log('✅ Padrões estruturais identificados:', padroes);
        return true;
      }
      
      console.log('⚠️ Nenhum padrão estrutural identificado');
      return false;
    } catch (erro) {
      console.log('❌ Falha na análise estrutural:', erro.message);
      return false;
    }
  }
  
  /**
   * Identifica padrões na estrutura do DOM
   */
  identificarPadroesEstrutura(estrutura) {
    const padroes = [];
    
    // Implementação simplificada - pode ser expandida
    estrutura.forEach(container => {
      this.buscarPadroesRecursivo(container, padroes);
    });
    
    return padroes;
  }
  
  /**
   * Busca padrões recursivamente na estrutura
   */
  buscarPadroesRecursivo(elemento, padroes, caminho = []) {
    const novoCaminho = [...caminho, elemento.tag];
    
    // Verificar se o elemento parece ser um card de jogo
    if (this.pareceCardJogo(elemento)) {
      padroes.push({
        tipo: 'card_jogo',
        caminho: novoCaminho,
        classes: elemento.classes,
        seletor: this.gerarSeletorDoCaminho(novoCaminho, elemento.classes)
      });
    }
    
    // Continuar busca nos filhos
    elemento.filhos.forEach(filho => {
      this.buscarPadroesRecursivo(filho, padroes, novoCaminho);
    });
  }
  
  /**
   * Verifica se um elemento parece ser um card de jogo
   */
  pareceCardJogo(elemento) {
    const texto = elemento.texto?.toLowerCase() || '';
    const classes = elemento.classes.join(' ').toLowerCase();
    
    return (classes.includes('match') || classes.includes('card') || classes.includes('game')) &&
           elemento.filhos.length > 2 && // Tem estrutura complexa
           (texto.includes('vs') || texto.includes('x') || /\d{1,2}:\d{2}/.test(texto));
  }
  
  /**
   * Gera seletor CSS a partir do caminho e classes
   */
  gerarSeletorDoCaminho(caminho, classes) {
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
    return caminho.join(' > ');
  }
  
  /**
   * Aplica estratégias de recuperação em sequência
   */
  async aplicarEstrategiasRecuperacao(page, url, categoriasFalhando) {
    console.log('🔧 Iniciando processo de recuperação automática...');
    
    for (const estrategia of this.opcoes.estrategiasRecuperacao) {
      console.log(`🎯 Tentando estratégia: ${estrategia}`);
      
      // Registrar uso da estratégia
      this.metricas.estrategiasAplicadas[estrategia] = 
        (this.metricas.estrategiasAplicadas[estrategia] || 0) + 1;
      
      let sucesso = false;
      
      try {
        switch (estrategia) {
          case 'recarregarPagina':
            sucesso = await this.estrategiaRecarregarPagina(page, url);
            break;
          case 'detectarNovosSeletores':
            sucesso = await this.estrategiaDetectarNovosSeletores(page);
            break;
          case 'usarSeletoresAlternativos':
            sucesso = await this.estrategiaUsarSeletoresAlternativos(page, categoriasFalhando);
            break;
          case 'extrairPorTexto':
            sucesso = await this.estrategiaExtrairPorTexto(page);
            break;
          case 'analisarEstruturaDom':
            sucesso = await this.estrategiaAnalisarEstruturaDom(page);
            break;
          default:
            console.log(`⚠️ Estratégia desconhecida: ${estrategia}`);
        }
        
        if (sucesso) {
          console.log(`✅ Estratégia ${estrategia} aplicada com sucesso`);
          this.estrategiasUsadas.push({
            estrategia,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            sucesso: true
          });
          
          // Validar se a recuperação funcionou
          const validacao = await this.validarTodosSeletores(page);
          if (validacao.sucesso) {
            this.metricas.recuperacoesBemsucedidas++;
            console.log('🎉 Recuperação bem-sucedida!');
            return true;
          }
        }
        
        // Aguardar entre tentativas
        await new Promise(resolve => setTimeout(resolve, this.opcoes.intervaloTentativas));
        
      } catch (erro) {
        console.log(`❌ Erro na estratégia ${estrategia}:`, erro.message);
        this.estrategiasUsadas.push({
          estrategia,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          sucesso: false,
          erro: erro.message
        });
      }
    }
    
    console.log('💥 Todas as estratégias de recuperação falharam');
    return false;
  }
  
  /**
   * Processo principal de validação com recuperação automática
   */
  async validarComRecuperacao(page, url) {
    console.log('🔍 Iniciando validação com recuperação automática...');
    
    for (let tentativa = 1; tentativa <= this.opcoes.tentativasMaximas; tentativa++) {
      console.log(`\n🔄 Tentativa ${tentativa}/${this.opcoes.tentativasMaximas}`);
      
      // Validar seletores atuais
      const validacao = await this.validarTodosSeletores(page);
      
      if (validacao.sucesso) {
        console.log('✅ Validação bem-sucedida!');
        return {
          sucesso: true,
          tentativas: tentativa,
          estrategiasUsadas: this.estrategiasUsadas,
          metricas: this.metricas
        };
      }
      
      // Se falhou e não é a última tentativa, tentar recuperação
      if (tentativa < this.opcoes.tentativasMaximas) {
        console.log(`⚠️ Validação falhou, tentando recuperação...`);
        
        const recuperacao = await this.aplicarEstrategiasRecuperacao(
          page, url, validacao.falhas
        );
        
        if (!recuperacao) {
          console.log('❌ Recuperação falhou, tentando novamente...');
        }
      }
    }
    
    console.log('💥 Todas as tentativas de validação e recuperação falharam');
    return {
      sucesso: false,
      tentativas: this.opcoes.tentativasMaximas,
      estrategiasUsadas: this.estrategiasUsadas,
      metricas: this.metricas
    };
  }
  
  /**
   * Salva relatório de validação
   */
  salvarRelatorio() {
    const relatorio = {
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      opcoes: this.opcoes,
      metricas: this.metricas,
      estrategiasUsadas: this.estrategiasUsadas,
      historicoValidacoes: this.historicoValidacoes,
      seletoresFinais: this.seletorAdaptativo.seletoresFuncionais
    };
    
    const nomeArquivo = `validacao-recuperacao_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
    fs.writeFileSync(nomeArquivo, JSON.stringify(relatorio, null, 2));
    
    console.log(`📁 Relatório salvo em: ${nomeArquivo}`);
    return nomeArquivo;
  }
}

/**
 * Função principal para validação com recuperação automática
 */
async function validarComRecuperacaoAutomatica(url = 'https://onefootball.com/pt-br/jogos', opcoes = {}) {
  console.log('🚀 Iniciando validação com recuperação automática...');
  
  const validador = new ValidadorRecuperacaoAutomatica(opcoes);
  
  // Carregar histórico
  validador.seletorAdaptativo.carregarHistorico();
  
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
    
    // Executar validação com recuperação
    const resultado = await validador.validarComRecuperacao(page, url);
    
    // Salvar relatório
    const arquivoRelatorio = validador.salvarRelatorio();
    
    // Exibir resumo
    console.log('\n📊 RESUMO DA VALIDAÇÃO:');
    console.log(`- Sucesso: ${resultado.sucesso ? '✅' : '❌'}`);
    console.log(`- Tentativas realizadas: ${resultado.tentativas}`);
    console.log(`- Estratégias aplicadas: ${resultado.estrategiasUsadas.length}`);
    console.log(`- Validações realizadas: ${resultado.metricas.validacoesRealizadas}`);
    console.log(`- Falhas detectadas: ${resultado.metricas.falhasDetectadas}`);
    console.log(`- Recuperações bem-sucedidas: ${resultado.metricas.recuperacoesBemsucedidas}`);
    
    return {
      ...resultado,
      arquivoRelatorio
    };
    
  } catch (erro) {
    console.error('💥 Erro durante validação:', erro);
    throw erro;
  } finally {
    await browser.close();
  }
}

module.exports = {
  ValidadorRecuperacaoAutomatica,
  validarComRecuperacaoAutomatica
};