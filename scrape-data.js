const puppeteer = require('puppeteer');
const moment = require('moment');
const fs = require('fs');

// Configurar o momento para português do Brasil
moment.locale('pt-br');

/**
 * Função para fazer scraping dos jogos de futebol para uma data específica no OneFootball
 * @param {string} data - Data no formato YYYY-MM-DD (opcional, usa a data atual se não for fornecida)
 */
async function scrapingJogosPorData(data) {
  // Se não for fornecida uma data, usar a data atual
  const dataAlvo = data ? moment(data) : moment();
  const dataFormatada = dataAlvo.format('YYYY-MM-DD');
  
  console.log(`Iniciando scraping de jogos do OneFootball para a data: ${dataFormatada}...`);
  
  // Iniciar o navegador
  const browser = await puppeteer.launch({
    headless: 'new', // Usar o novo modo headless
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Abrir uma nova página
    const page = await browser.newPage();
    
    // Configurar o viewport para simular um dispositivo desktop
    await page.setViewport({ width: 1366, height: 768 });
    
    // Navegar para a página de jogos do OneFootball
    // Nota: O OneFootball pode ter uma URL específica para datas passadas
    // Se for o caso, ajustar a URL conforme necessário
    await page.goto('https://onefootball.com/pt-br/jogos', {
      waitUntil: 'networkidle2', // Esperar até que a rede esteja praticamente inativa
      timeout: 60000 // Timeout de 60 segundos
    });
    
    console.log('Página carregada, extraindo jogos...');
    
    // Esperar um pouco para garantir que todos os elementos estejam carregados
    await page.waitForTimeout(5000);
    
    // Extrair os jogos usando os seletores atualizados
    const jogos = await page.evaluate(() => {
      // Função para limpar texto
      const limparTexto = (texto) => texto ? texto.trim().replace(/\s+/g, ' ') : '';
      
      // Lista para armazenar os jogos extraídos
      const listaJogos = [];
      
      // Selecionar todos os cards de jogos usando o seletor correto
      const cards = document.querySelectorAll('ul.grid.MatchCardsList_matches__8_UwB > li');
      
      // Processar cada card
      cards.forEach(card => {
        try {
          // Extrair todos os textos do card para análise
          const todosTextos = card.innerText;
          
          // Time da casa
          let timeCasa = 'Time não identificado';
          const timeCasaElement = card.querySelectorAll('.SimpleMatchCardTeam_simpleMatchCardTeam__name__7Ud8D')[0];
          if (timeCasaElement) {
            timeCasa = limparTexto(timeCasaElement.innerText);
          }
          
          // Time visitante
          let timeVisitante = 'Time não identificado';
          const timeVisitanteElement = card.querySelectorAll('.SimpleMatchCardTeam_simpleMatchCardTeam__name__7Ud8D')[1];
          if (timeVisitanteElement) {
            timeVisitante = limparTexto(timeVisitanteElement.innerText);
          }
          
          // Horário do jogo
          let horario = '';
          const horarioElement = card.querySelector('.SimpleMatchCard_simpleMatchCard__infoMessage___NJqW.title-8-bold') || 
                                card.querySelector('time');
          if (horarioElement) {
            horario = limparTexto(horarioElement.innerText);
          } else {
            // Tentar extrair do texto completo
            const horarioRegex = /\d{1,2}:\d{2}/;
            const horarioMatch = todosTextos.match(horarioRegex);
            
            if (horarioMatch) {
              horario = horarioMatch[0];
            } else {
              // Tentar encontrar linhas que parecem horários
              const linhas = todosTextos.split('\n').filter(linha => linha.trim() !== '');
              const horarioPossiveis = linhas.filter(linha => /^\d{1,2}:\d{2}$/.test(linha.trim()));
              
              if (horarioPossiveis.length > 0) {
                horario = horarioPossiveis[0];
              }
            }
          }
          
          // Status - procurar por elementos que indicam o status do jogo
          let status = '';
          const statusElement = card.querySelector('.ot-label-status');
          if (statusElement) {
            status = limparTexto(statusElement.innerText);
          } else {
            // Tentar extrair do texto completo
            const statusPossiveis = ['Ao vivo', 'Fim de jogo', 'Intervalo', 'Adiado', 'Cancelado'];
            const linhas = todosTextos.split('\n').filter(linha => linha.trim() !== '');
            
            for (const linha of linhas) {
              if (statusPossiveis.some(termo => linha.includes(termo))) {
                status = linha;
                break;
              }
            }
          }
          
          // Placar
          let placarCasa = '';
          let placarVisitante = '';
          
          const placarElements = card.querySelectorAll('.SimpleMatchCardTeam_simpleMatchCardTeam__score__UYMc_');
          if (placarElements.length >= 2) {
            placarCasa = limparTexto(placarElements[0].innerText);
            placarVisitante = limparTexto(placarElements[1].innerText);
          } else {
            // Tentar extrair do texto completo usando regex
            const placarRegex = /(\d+)\s*[-x]\s*(\d+)/;
            const placarMatch = todosTextos.match(placarRegex);
            
            if (placarMatch) {
              placarCasa = placarMatch[1];
              placarVisitante = placarMatch[2];
            } else {
              // Tentar encontrar números isolados nas linhas após os nomes dos times
              const linhas = todosTextos.split('\n').filter(linha => linha.trim() !== '');
              const numeros = linhas.filter(linha => /^\d+$/.test(linha.trim()));
              
              if (numeros.length >= 2) {
                placarCasa = numeros[0];
                placarVisitante = numeros[1];
              }
            }
          }
          
          // Competição/Liga
          let competicao = 'Competição não identificada';
          let nivelCampeonato = '';
          
          // Encontrar a seção que contém este card
          const secaoAtual = card.closest('section');
          
          if (secaoAtual) {
            // Buscar o nome da competição na seção atual
            const competicaoElement = secaoAtual.querySelector('[class*="title-6-bold"][class*="leftAlign"]');
            if (competicaoElement && !competicaoElement.innerText.includes('Os jogos de hoje')) {
              competicao = limparTexto(competicaoElement.innerText);
            }
            
            // Buscar o nível do campeonato (fase, etapa, etc.) na seção atual
            const nivelElement = secaoAtual.querySelector('[class*="title-7-medium"][class*="subtitle"]');
            if (nivelElement && !nivelElement.innerText.includes('feira')) {
              // Verificar se não é uma data (geralmente contém 'feira' como em 'quarta-feira')
              nivelCampeonato = limparTexto(nivelElement.innerText);
            }
          }
          
          // Tentar outros seletores se não encontrar a competição
          if (competicao === 'Competição não identificada') {
            // Tentar encontrar a competição no documento inteiro
            const outrosCompeticaoElements = [
              document.querySelector('[class*="SectionHeader_container"] [class*="Title_leftAlign"]'),
              document.querySelector('h2[class*="title-6-bold"]')
            ];
            
            for (const element of outrosCompeticaoElements) {
              if (element && element.innerText.trim() && !element.innerText.includes('Os jogos de hoje')) {
                competicao = limparTexto(element.innerText);
                break;
              }
            }
          }
          
          // Adicionar jogo à lista apenas se tiver informações mínimas
          if (timeCasa !== 'Time não identificado' || timeVisitante !== 'Time não identificado') {
            listaJogos.push({
              timeCasa,
              timeVisitante,
              horario,
              status,
              placarCasa,
              placarVisitante,
              competicao,
              nivelCampeonato
            });
          }
        } catch (erro) {
          // Ignorar erros individuais de processamento de jogos
          console.error('Erro ao processar jogo:', erro);
        }
      });
      
      return listaJogos;
    });
    
    console.log(`Foram encontrados ${jogos.length} jogos para a data ${dataFormatada}.`);
    
    // Criar objeto com data e jogos
    const resultado = {
      data: dataAlvo.format('DD/MM/YYYY'),
      totalJogos: jogos.length,
      jogos: jogos
    };
    
    // Salvar os resultados em um arquivo JSON
    const nomeArquivo = `jogos_${dataFormatada}.json`;
    fs.writeFileSync(nomeArquivo, JSON.stringify(resultado, null, 2));
    
    console.log(`Resultados salvos no arquivo ${nomeArquivo}`);
    
    return resultado;
  } catch (erro) {
    console.error('Erro durante o scraping:', erro);
    throw erro;
  } finally {
    // Fechar o navegador
    await browser.close();
    console.log('Navegador fechado.');
  }
}

// Verificar se foi passada uma data como argumento
const dataArgumento = process.argv[2]; // Formato esperado: YYYY-MM-DD

// Executar a função principal
scrapingJogosPorData(dataArgumento)
  .then(resultado => {
    console.log('Scraping concluído com sucesso!');
    console.log(`Total de jogos encontrados: ${resultado.totalJogos}`);
  })
  .catch(erro => {
    console.error('Falha no scraping:', erro);
    process.exit(1);
  });