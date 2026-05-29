import { GoogleGenAI } from '@google/genai';
import ExcelJS from 'exceljs';

// Initialize the Gemini API using the new official SDK
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

/**
 * Converts a generic File object into a base64 string
 */
async function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'application/pdf',
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts text from Excel files using exceljs
 */
async function extractExcelToCsv(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  const rows: string[] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as (string | number | null)[];
    // row.values[0] is a placeholder; skip it
    const csvLine = values.slice(1).map(v => (v === null || v === undefined ? '' : v)).join(',');
    rows.push(csvLine);
  });
  return rows.join('\n');
}

/**
 * Reads a plain text file
 */
async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || '');
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

export type ExtractionType = 'CALENDAR' | 'STUDENTS' | 'TEACHING_PLAN';

export interface ExtractedCalendar {
  holidays: { date: string; description: string }[];
}

export interface ExtractedStudents {
  students: { name: string; ra: string }[];
}

export interface ExtractedTeachingPlan {
  totalHours: number;
  modules: { 
    name: string; 
    hours: number;
    objective?: string;
    technicalCapabilities?: string[];
    socioemotionalCapabilities?: string[];
    knowledge?: string[];
    recommendations?: string;
    aiSuggestions?: string;
  }[];
  msep?: {
    objetivoGeral: string;
    capacidadesBasicas: string[];
    capacidadesTecnicas: string[];
    capacidadesSocioemocionais: string[];
    conhecimentos: string[];
    infraestrutura: string;
    situacoesAprendizagem: string;
    criteriosAvaliacao: string;
    estrategiasEnsino: string;
    atividadesPraticas: string[];
    instrumentosAvaliacao: string[];
  };
}

const PROMPTS: Record<ExtractionType, string> = {
  CALENDAR: `Analise o arquivo de calendário escolar em anexo. 
Extraia todos os feriados, recessos, emendas e dias não-letivos mencionados.
Devolva ESTRITAMENTE um JSON no seguinte formato (sem formatação markdown):
{
  "holidays": [
    { "date": "YYYY-MM-DD", "description": "Descrição do feriado ou recesso" }
  ]
}`,
  STUDENTS: `Analise o arquivo em anexo contendo uma lista ou tabela de alunos.
Extraia todos os nomes de alunos e seus respectivos RAs (Registro Acadêmico).
Devolva ESTRITAMENTE um JSON no seguinte formato (sem formatação markdown):
{
  "students": [
    { "name": "Nome Completo", "ra": "Número do RA" }
  ]
}`,
  TEACHING_PLAN: `Analise a grade curricular/matriz em anexo.
Extraia fielmente as seguintes informações baseadas no documento:
- Carga horária total
- Lista de unidades curriculares/módulos
- Objetivo Geral do curso
- Capacidades Básicas, Técnicas e Socioemocionais (habilidades)
- Conhecimentos (grandes temas)
- Infraestrutura Necessária

Para CADA Unidade Curricular (módulo), extraia detalhadamente:
- Nome e Carga Horária
- Objetivo específico da unidade
- Capacidades Técnicas relacionadas àquela unidade
- Capacidades Socioemocionais relacionadas
- Conhecimentos necessários para aquela unidade
- Recomendações pedagógicas presentes no documento para aquela unidade

Aja também como um especialista pedagógico (Metodologia MSEP) e SUGIRA ativamente para CADA Unidade Curricular:
- Sugestões da IA para o desenvolvimento da unidade (estratégias, situações de aprendizagem)

Devolva ESTRITAMENTE um JSON no seguinte formato (sem formatação markdown):
{
  "totalHours": 0,
  "modules": [ 
    { 
      "name": "Nome da Unidade", 
      "hours": 0,
      "objective": "Objetivo específico da unidade",
      "technicalCapabilities": ["Capacidade Técnica 1", "Capacidade Técnica 2"],
      "socioemotionalCapabilities": ["Capacidade Socioemocional 1"],
      "knowledge": ["Conhecimento 1", "Conhecimento 2"],
      "recommendations": "Texto das recomendações do documento",
      "aiSuggestions": "Sugestões detalhadas da IA para o desenvolvimento desta UC"
    } 
  ],
  "msep": {
    "objetivoGeral": "Texto do objetivo (extraído)",
    "capacidadesBasicas": ["Capacidade 1 (extraída)"],
    "capacidadesTecnicas": ["Capacidade 1 (extraída)"],
    "capacidadesSocioemocionais": ["Capacidade 1 (extraída)"],
    "conhecimentos": ["Conhecimento 1 (extraído)"],
    "infraestrutura": "Texto da infraestrutura (extraída)",
    "situacoesAprendizagem": "Texto descrevendo situações sugeridas pela IA",
    "criteriosAvaliacao": "Texto descrevendo os critérios de avaliação sugeridos",
    "estrategiasEnsino": "Texto com as estratégias sugeridas",
    "atividadesPraticas": ["Atividade sugerida 1", "Atividade sugerida 2"],
    "instrumentosAvaliacao": ["Instrumento sugerido 1"]
  }
}`
};

function getMockData(type: ExtractionType): ExtractedCalendar | ExtractedStudents | ExtractedTeachingPlan {
  if (type === 'TEACHING_PLAN') {
    return {
      totalHours: 240,
      modules: [
        { 
          name: "Introdução à Lógica", 
          hours: 40,
          objective: "Compreender os fundamentos da lógica de programação e algoritmos.",
          technicalCapabilities: ["Desenvolver algoritmos estruturados", "Utilizar estruturas de repetição"],
          socioemotionalCapabilities: ["Raciocínio analítico"],
          knowledge: ["Variáveis", "Tipos de dados", "Operadores"],
          recommendations: "Utilizar ferramentas visuais como Portugol antes de passar para linguagem real.",
          aiSuggestions: "Utilizar desafios de gamificação para ensinar estruturas de controle."
        },
        { 
          name: "Programação Web", 
          hours: 100,
          objective: "Desenvolver interfaces web modernas e responsivas.",
          technicalCapabilities: ["Criar layouts com CSS Flexbox/Grid", "Manipular o DOM com JS"],
          socioemotionalCapabilities: ["Criatividade", "Atenção a detalhes"],
          knowledge: ["HTML5 semantic", "CSS3 Advanced", "JavaScript ES6+"],
          recommendations: "Focar em projetos práticos desde a primeira semana.",
          aiSuggestions: "Sugerir a criação de um portfólio pessoal como projeto integrador da unidade."
        }
      ],
      msep: {
        objetivoGeral: "Formar profissionais capazes de desenvolver sistemas web responsivos e modernos.",
        capacidadesBasicas: ["Comunicação Clara", "Raciocínio Lógico"],
        capacidadesTecnicas: ["Criar interfaces em React", "Modelar Bancos de Dados"],
        capacidadesSocioemocionais: ["Trabalho em Equipe", "Resiliência"],
        conhecimentos: ["Lógica de Programação", "HTML/CSS/JS", "SQL"],
        infraestrutura: "Laboratório de Informática com VS Code instalado.",
        situacoesAprendizagem: "Desenvolvimento de um e-commerce simulado em grupos focando em cenários reais.",
        criteriosAvaliacao: "Código limpo, interface responsiva, usabilidade e banco de dados normalizado.",
        estrategiasEnsino: "Aulas expositivas dinâmicas e resolução de problemas em pares (Pair Programming).",
        atividadesPraticas: ["Criar tela de login", "Modelar tabelas de produtos", "Implementar carrinho de compras"],
        instrumentosAvaliacao: ["Prova prática no laboratório", "Apresentação e defesa do projeto final"]
      }
    };
  } else if (type === 'CALENDAR') {
    return { holidays: [{ date: "2026-05-01", description: "Dia do Trabalhador" }] };
  }
  return { students: [{ name: "Aluno Exemplo", ra: "123456" }] };
}

/**
 * Main Sentry AI Function
 * Sends a file to Gemini and asks it to extract structured JSON data
 */
export async function extractDataFromFile(file: File, type: 'CALENDAR'): Promise<ExtractedCalendar>;
export async function extractDataFromFile(file: File, type: 'STUDENTS'): Promise<ExtractedStudents>;
export async function extractDataFromFile(file: File, type: 'TEACHING_PLAN'): Promise<ExtractedTeachingPlan>;
export async function extractDataFromFile(file: File, type: ExtractionType): Promise<ExtractedCalendar | ExtractedStudents | ExtractedTeachingPlan> {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    
    // MOCK MODE: Se o usuário não configurou a chave de API no .env, devolvemos dados falsos
    if (!apiKey || apiKey === "SuaApiKeyDoGoogleGeminiAqui") {
      console.warn("Sentry AI: Chave API ausente. Usando dados MOCK.");
      await new Promise(resolve => setTimeout(resolve, 2000)); // simular delay
      return getMockData(type);
    }

    const prompt = PROMPTS[type];
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('spreadsheetml');
    const isText = file.name.endsWith('.txt') || file.type === 'text/plain';
    const isWord = file.name.endsWith('.docx') || file.type.includes('wordprocessingml');
    
    let result;
    
    if (isExcel) {
      const csvText = await extractExcelToCsv(file);
      const fullPrompt = `${prompt}\n\nAqui está o conteúdo da planilha em formato CSV:\n${csvText}`;
      result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt
      });
    } else if (isText) {
      // Plain text files — send content directly as text
      const textContent = await readTextFile(file);
      const fullPrompt = `${prompt}\n\nAqui está o conteúdo do documento:\n${textContent}`;
      result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt
      });
    } else if (isWord) {
      // .docx — extract raw XML text (zip file). Read as binary and extract text
      const textContent = await readTextFile(file);
      const fullPrompt = `${prompt}\n\nAqui está o conteúdo do documento Word (pode conter ruído de formatação XML — ignore e extraia apenas o conteúdo textual):\n${textContent}`;
      result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt
      });
    } else {
      // For PDFs and other supported formats — send as inline binary
      const filePart = await fileToGenerativePart(file);
      result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { text: prompt },
          filePart
        ]
      });
    }
    
    const responseText = result.text || '';
    
    // Clean up markdown syntax if Gemini hallucinated it despite instructions
    let cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Fallback: extract the JSON object using regex in case the AI added conversational text
    const jsonMatch = cleanJsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJsonString = jsonMatch[0];
    }
    
    return JSON.parse(cleanJsonString) as ExtractedCalendar | ExtractedStudents | ExtractedTeachingPlan;
  } catch (error: unknown) {
    console.error("Sentry AI Extraction Error:", error);
    
    const err = error as { message?: string; status?: number } | null | undefined;
    // Tratamento robusto para chave inválida ou bloqueada
    if (err?.message?.includes('API key not valid') || err?.status === 400 || String(error).includes('400')) {
      console.warn("Sentry AI: Chave de API recusada pelo Google. Ativando Modo Simulação de Emergência.");
      return getMockData(type) as ExtractedCalendar | ExtractedStudents | ExtractedTeachingPlan;
    }
    
    throw new Error("Falha na extração de dados via IA. Verifique se a chave API é válida e se o arquivo está legível.", { cause: error });
  }
}


export interface KnowledgePrecedenceResult {
  allocations: {
    moduleName: string;
    knowledge: string[];
    justification?: string;
  }[];
}

function getMockPrecedence(componentName: string, knowledges: string[], modules: string[]): KnowledgePrecedenceResult {
  const result: KnowledgePrecedenceResult = { allocations: [] };
  const chunkCount = Math.max(1, modules.length);
  const chunkSize = Math.ceil(knowledges.length / chunkCount);
  
  modules.forEach((modName, idx) => {
    const start = idx * chunkSize;
    const end = Math.min(start + chunkSize, knowledges.length);
    result.allocations.push({
      moduleName: modName,
      knowledge: knowledges.slice(start, end),
      justification: `Distribuição sequencial simulada dos tópicos de ${componentName} para o módulo ${modName} por ordem de dependência.`
    });
  });
  return result;
}

export async function organizeKnowledgePrecedence(
  componentName: string,
  knowledges: string[],
  modules: string[]
): Promise<KnowledgePrecedenceResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  
  if (!apiKey || apiKey === "SuaApiKeyDoGoogleGeminiAqui") {
    console.warn("Sentry AI: Chave API ausente para precedência. Usando simulação.");
    await new Promise(resolve => setTimeout(resolve, 1500));
    return getMockPrecedence(componentName, knowledges, modules);
  }

  const prompt = `Você é um coordenador pedagógico especialista em cursos técnicos e profissionais.
Estamos organizando o componente curricular "${componentName}", o qual será ministrado e dividido entre os seguintes ${modules.length} módulos/semestres distintos:
${modules.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Aqui está a lista completa de conhecimentos/tópicos desse componente:
${knowledges.map(k => `- ${k}`).join('\n')}

Distribua esses conhecimentos entre os módulos de forma que respeite a ordem de precedência pedagógica (tópicos elementares e fundamentos devem vir no primeiro módulo, tópicos intermediários no segundo, tópicos avançados/práticos nos seguintes).
Retorne ESTRITAMENTE um JSON no seguinte formato (sem qualquer formatação markdown, sem tags \`\`\`json):
{
  "allocations": [
    {
      "moduleName": "Nome do módulo correspondente da lista acima",
      "knowledge": ["Tópico 1", "Tópico 2"],
      "justification": "Breve justificativa pedagógica sobre a precedência"
    }
  ]
}`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const responseText = result.text || '';
    let cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJsonString = jsonMatch[0];
    }
    return JSON.parse(cleanJsonString) as KnowledgePrecedenceResult;
  } catch (error: unknown) {
    console.error("Sentry AI Precedence Error:", error);
    return getMockPrecedence(componentName, knowledges, modules);
  }
}

// ─── TEACHING PLAN GENERATOR ─────────────────────────────────────────────────

export interface TeachingPlanInput {
  docente: string;
  curso: string;
  unidadeCurricular: string;
  modulo: string;
  semestre: string;
  chTotal: number;
  chFormativa: number;
  chSomativa: number;
  capacidadesTecnicas: string[];
  conhecimentos: string[];
  capacidadesSociais: string[];
}

export interface DidacticStrategy {
  estrategia: string;
  conteudo: string;
  recursos: string;
  cargaHoraria: number;
  intervencao: string;
}

export interface AvaliacaoCriterio {
  criterio: string;
  evidencia: string;
  tipo: 'critico' | 'desejavel';
}

export interface NivelDesempenho {
  nivel: number;
  criteriosAtingidos: string;
  tipo: string;
  notaFinal: number;
}

export interface ModuleTeachingPlan {
  identificacao: {
    docente: string;
    curso: string;
    unidadeCurricular: string;
    modulo: string;
    semestre: string;
    chTotal: number;
    chFormativa: number;
    chSomativa: number;
  };
  competencias: {
    capacidadesTecnicas: string[];
    conhecimentos: string[];
    capacidadesSociais: string[];
  };
  situacaoAprendizagem: {
    contexto: string;
    desafio: string;
    atividades: string[];
    recursos: string[];
    resultadosEsperados: string[];
  };
  planejamentoDidatico: DidacticStrategy[];
  avaliacaoFormativa: {
    criterios: AvaliacaoCriterio[];
    instrumento: string;
    periodicidade: string;
  };
  situacaoProblema: {
    titulo: string;
    descricao: string;
    entregaveis: string[];
  };
  avaliacaoSomativa: {
    criterios: AvaliacaoCriterio[];
    instrumento: string;
  };
  niveisDesempenho: NivelDesempenho[];
}

function getMockTeachingPlan(input: TeachingPlanInput): ModuleTeachingPlan {
  return {
    identificacao: {
      docente: input.docente,
      curso: input.curso,
      unidadeCurricular: input.unidadeCurricular,
      modulo: input.modulo,
      semestre: input.semestre,
      chTotal: input.chTotal,
      chFormativa: input.chFormativa,
      chSomativa: input.chSomativa,
    },
    competencias: {
      capacidadesTecnicas: input.capacidadesTecnicas,
      conhecimentos: input.conhecimentos,
      capacidadesSociais: input.capacidadesSociais,
    },
    situacaoAprendizagem: {
      contexto: `Uma empresa do setor produtivo precisa modernizar seus processos relacionados a ${input.unidadeCurricular}. Os alunos serão inseridos em um ambiente simulado de trabalho para resolver problemas reais do cotidiano profissional.`,
      desafio: `Desenvolver uma solução prática que aplique os conceitos de ${input.conhecimentos.slice(0, 2).join(' e ')} para otimizar um processo existente na empresa-cliente fictícia.`,
      atividades: [
        'Análise do cenário-problema apresentado pelo docente',
        'Pesquisa e estudo dos conceitos técnicos envolvidos',
        'Desenvolvimento colaborativo da solução em grupos de trabalho',
        'Apresentação e defesa técnica da solução para a turma',
      ],
      recursos: [
        'Laboratório equipado com ferramentas da área',
        'Materiais de referência técnica e bibliografia especializada',
        'Ferramentas digitais e softwares aplicados ao curso',
        'Orientação contínua do docente como mediador',
      ],
      resultadosEsperados: [
        'Aplicação prática dos conhecimentos técnicos estudados no módulo',
        'Desenvolvimento de habilidades para resolução de problemas reais',
        'Fortalecimento do trabalho colaborativo e da comunicação técnica',
      ],
    },
    planejamentoDidatico: [
      {
        estrategia: 'Aula Expositiva Dialogada',
        conteudo: input.conhecimentos.slice(0, Math.ceil(input.conhecimentos.length / 3)).join(', '),
        recursos: 'Apresentação de slides, quadro branco, vídeos técnicos e exemplos do cotidiano profissional',
        cargaHoraria: Math.round(input.chFormativa * 0.3),
        intervencao: 'Docente conduz a exposição do conteúdo realizando questionamentos reflexivos e relacionando os conceitos ao mercado de trabalho',
      },
      {
        estrategia: 'Prática Orientada em Laboratório',
        conteudo: input.conhecimentos.slice(Math.ceil(input.conhecimentos.length / 3)).join(', '),
        recursos: 'Roteiro de atividades práticas, equipamentos do laboratório, ferramentas e materiais técnicos',
        cargaHoraria: Math.round(input.chFormativa * 0.5),
        intervencao: 'Docente circula pelo laboratório oferecendo suporte individual, corrigindo desvios e incentivando a autonomia dos alunos',
      },
      {
        estrategia: 'Resolução de Situação-Problema em Grupo',
        conteudo: 'Integração de todos os conhecimentos e capacidades desenvolvidas no módulo',
        recursos: 'Enunciado do problema contextualizado, recursos digitais, espaço colaborativo',
        cargaHoraria: Math.round(input.chFormativa * 0.2),
        intervencao: 'Docente atua como mediador e facilitador, orientando sem dar a solução, estimulando o raciocínio crítico e criativo',
      },
    ],
    avaliacaoFormativa: {
      criterios: [
        {
          criterio: `Identifica e aplica corretamente ${input.capacidadesTecnicas[0] || 'os conceitos técnicos fundamentais do módulo'}`,
          evidencia: 'Observação direta durante atividades práticas e análise dos exercícios realizados',
          tipo: 'critico',
        },
        {
          criterio: 'Demonstra raciocínio lógico e sistemático na resolução dos problemas propostos',
          evidencia: 'Verificação das soluções desenvolvidas e do processo utilizado pelo aluno',
          tipo: 'critico',
        },
        {
          criterio: `Aplica ${input.capacidadesSociais[0] || 'comunicação técnica clara'} na interação com os colegas`,
          evidencia: 'Observação do comportamento e qualidade da participação em atividades colaborativas',
          tipo: 'desejavel',
        },
      ],
      instrumento: 'Lista de verificação de desempenho + observação direta e registro contínuo do docente',
      periodicidade: 'Contínua ao longo de todas as aulas da fase formativa',
    },
    situacaoProblema: {
      titulo: `Projeto Final Individual: Aplicando ${input.unidadeCurricular} em Contexto Profissional`,
      descricao: `O aluno deverá, individualmente, desenvolver e apresentar uma solução completa para um problema técnico real relacionado a ${input.unidadeCurricular}. A solução deve demonstrar domínio dos conhecimentos de ${input.conhecimentos.slice(0, 3).join(', ')} e estar devidamente documentada com justificativas técnicas.`,
      entregaveis: [
        'Relatório técnico documentando o problema, a solução desenvolvida e as justificativas das escolhas',
        'Demonstração prática do produto/solução em funcionamento',
        'Apresentação oral de defesa com respostas a questionamentos técnicos do docente',
      ],
    },
    avaliacaoSomativa: {
      criterios: [
        {
          criterio: 'A solução apresentada atende plenamente ao requisito técnico proposto no enunciado',
          evidencia: 'Verificação funcional e técnica da entrega realizada pelo aluno',
          tipo: 'critico',
        },
        {
          criterio: 'A documentação técnica é clara, organizada, completa e utiliza terminologia adequada',
          evidencia: 'Leitura e análise do relatório técnico entregue',
          tipo: 'critico',
        },
        {
          criterio: 'A apresentação oral demonstra compreensão profunda do conteúdo e das decisões técnicas',
          evidencia: 'Qualidade das respostas durante a defesa oral realizada pelo docente',
          tipo: 'desejavel',
        },
        {
          criterio: 'A solução demonstra criatividade, inovação ou aplicação que vai além do mínimo exigido',
          evidencia: 'Presença de recursos adicionais, otimizações ou abordagens diferenciadas',
          tipo: 'desejavel',
        },
      ],
      instrumento: 'Rubrica de avaliação por critérios de desempenho técnico (críticos e desejáveis)',
    },
    niveisDesempenho: [
      { nivel: 1, criteriosAtingidos: 'Nenhum critério crítico atingido', tipo: 'Insatisfatório', notaFinal: 1.0 },
      { nivel: 2, criteriosAtingidos: '1 critério crítico parcialmente atingido', tipo: 'Insatisfatório', notaFinal: 2.5 },
      { nivel: 3, criteriosAtingidos: '1 critério crítico plenamente atingido', tipo: 'Em Desenvolvimento', notaFinal: 4.0 },
      { nivel: 4, criteriosAtingidos: '2 critérios críticos atingidos', tipo: 'Em Desenvolvimento', notaFinal: 5.0 },
      { nivel: 5, criteriosAtingidos: 'Todos os critérios críticos atingidos', tipo: 'Satisfatório', notaFinal: 6.0 },
      { nivel: 6, criteriosAtingidos: 'Todos os críticos + 1 critério desejável', tipo: 'Satisfatório', notaFinal: 7.5 },
      { nivel: 7, criteriosAtingidos: 'Todos os críticos + 2 critérios desejáveis', tipo: 'Destaque', notaFinal: 9.0 },
      { nivel: 8, criteriosAtingidos: 'Todos os critérios (críticos e desejáveis) plenamente atingidos', tipo: 'Excelência', notaFinal: 10.0 },
    ],
  };
}

export async function generateTeachingPlanAI(input: TeachingPlanInput): Promise<ModuleTeachingPlan> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    console.warn('Sentry AI: Chave API ausente. Usando plano de ensino simulado.');
    await new Promise(resolve => setTimeout(resolve, 2500));
    return getMockTeachingPlan(input);
  }

  const prompt = `Você é um especialista em educação profissional por competências.

Crie um plano de ensino completo com as informações abaixo, seguindo rigorosamente a metodologia de ensino por competências.

## DADOS
Docente: ${input.docente} | Curso: ${input.curso} | UC: ${input.unidadeCurricular}
Módulo: ${input.modulo} | Semestre: ${input.semestre}
CH Total: ${input.chTotal}h | CH Formativa: ${input.chFormativa}h | CH Somativa: ${input.chSomativa}h
Capacidades Técnicas: ${input.capacidadesTecnicas.join('; ')}
Conhecimentos: ${input.conhecimentos.join('; ')}
Capacidades Sociais: ${input.capacidadesSociais.join('; ')}

Retorne SOMENTE um JSON válido com esta estrutura (sem markdown, sem texto extra):
{
  "identificacao": { "docente": "...", "curso": "...", "unidadeCurricular": "...", "modulo": "...", "semestre": "...", "chTotal": 0, "chFormativa": 0, "chSomativa": 0 },
  "competencias": { "capacidadesTecnicas": [], "conhecimentos": [], "capacidadesSociais": [] },
  "situacaoAprendizagem": { "contexto": "...", "desafio": "...", "atividades": [], "recursos": [], "resultadosEsperados": [] },
  "planejamentoDidatico": [{ "estrategia": "...", "conteudo": "...", "recursos": "...", "cargaHoraria": 0, "intervencao": "..." }],
  "avaliacaoFormativa": { "criterios": [{ "criterio": "...", "evidencia": "...", "tipo": "critico" }], "instrumento": "...", "periodicidade": "..." },
  "situacaoProblema": { "titulo": "...", "descricao": "...", "entregaveis": [] },
  "avaliacaoSomativa": { "criterios": [{ "criterio": "...", "evidencia": "...", "tipo": "critico" }], "instrumento": "..." },
  "niveisDesempenho": [
    { "nivel": 1, "criteriosAtingidos": "...", "tipo": "Insatisfatório", "notaFinal": 1.0 },
    { "nivel": 2, "criteriosAtingidos": "...", "tipo": "Insatisfatório", "notaFinal": 2.5 },
    { "nivel": 3, "criteriosAtingidos": "...", "tipo": "Em Desenvolvimento", "notaFinal": 4.0 },
    { "nivel": 4, "criteriosAtingidos": "...", "tipo": "Em Desenvolvimento", "notaFinal": 5.0 },
    { "nivel": 5, "criteriosAtingidos": "...", "tipo": "Satisfatório", "notaFinal": 6.0 },
    { "nivel": 6, "criteriosAtingidos": "...", "tipo": "Satisfatório", "notaFinal": 7.5 },
    { "nivel": 7, "criteriosAtingidos": "...", "tipo": "Destaque", "notaFinal": 9.0 },
    { "nivel": 8, "criteriosAtingidos": "...", "tipo": "Excelência", "notaFinal": 10.0 }
  ]
}`;

  try {
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const responseText = result.text || '';
    let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    return JSON.parse(cleanJson) as ModuleTeachingPlan;
  } catch (error: unknown) {
    console.error('Sentry AI Teaching Plan Error:', error);
    return getMockTeachingPlan(input);
  }
}

/**
 * Gera critérios de avaliação personalizados usando a metodologia do PDF do usuário ou uma metodologia existente como referência
 */
export async function generateCriteriaWithMethodology(
  pdfFile: File | null,
  capabilities: string[],
  existingMethodologyText?: string
): Promise<string[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    console.warn('Sentry AI: Chave API ausente. Usando critérios simulados.');
    await new Promise(resolve => setTimeout(resolve, 1500));
    return capabilities.map(cap => `Critério profissional de avaliação para a capacidade: "${cap}"`);
  }

  let methodologyInstructions = 'Formule critérios de avaliação pedagógica profissional de alta qualidade correspondentes a cada uma das capacidades acima.';
  if (pdfFile) {
    methodologyInstructions = 'Utilize o documento metodológico em anexo para formular exatamente 1 critério de avaliação pedagógica profissional correspondente a cada uma das capacidades acima.';
  } else if (existingMethodologyText) {
    methodologyInstructions = `Utilize a seguinte metodologia de referência que já foi aplicada em outro plano de ensino para formular exatamente 1 critério de avaliação pedagógica profissional correspondente a cada uma das capacidades acima:\n\nMETODOLOGIA DE REFERÊNCIA:\n"${existingMethodologyText}"`;
  }

  const prompt = `Você é um especialista em educação profissional. Baseado nas seguintes capacidades a serem avaliadas:
${capabilities.map((cap, i) => `${i + 1}. ${cap}`).join('\n')}

${methodologyInstructions}

Devolve ESTRITAMENTE um array JSON de strings contendo exatamente a mesma quantidade de critérios correspondentes, na mesma ordem das capacidades enviadas (exemplo: ["Critério 1", "Critério 2"]). Sem formatação markdown, sem tags \`\`\`json ou explicações extras.`;

  try {
    let contents: string | ({ text: string } | { inlineData: { data: string; mimeType: string } })[] = prompt;
    if (pdfFile) {
      const filePart = await fileToGenerativePart(pdfFile);
      contents = [
        { text: prompt },
        filePart
      ];
    }
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });
    const responseText = result.text || '';
    let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    return JSON.parse(cleanJson) as string[];
  } catch (error: unknown) {
    console.error('Sentry AI Criteria Error:', error);
    return capabilities.map(cap => `Critério de avaliação sugerido para: ${cap}`);
  }
}


