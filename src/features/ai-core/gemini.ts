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
  capacidades: string[];
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
        capacidades: [input.capacidadesTecnicas[0] || 'Determinar ferramental, máquinas e equipamentos'],
      },
      {
        estrategia: 'Prática Orientada em Laboratório',
        conteudo: input.conhecimentos.slice(Math.ceil(input.conhecimentos.length / 3)).join(', '),
        recursos: 'Roteiro de atividades práticas, equipamentos do laboratório, ferramentas e materiais técnicos',
        cargaHoraria: Math.round(input.chFormativa * 0.5),
        intervencao: 'Docente circula pelo laboratório oferecendo suporte individual, corrigindo desvios e incentivando a autonomia dos alunos',
        capacidades: input.capacidadesTecnicas.slice(1, 3).length > 0 ? input.capacidadesTecnicas.slice(1, 3) : ['Realizar set up de máquinas em função do processo'],
      },
      {
        estrategia: 'Resolução de Situação-Problema em Grupo',
        conteudo: 'Integração de todos os conhecimentos e capacidades desenvolvidas no módulo',
        recursos: 'Enunciado do problema contextualizado, recursos digitais, espaço colaborativo',
        cargaHoraria: Math.round(input.chFormativa * 0.2),
        intervencao: 'Docente atua como mediador e facilitador, orientando sem dar a solução, estimulando o raciocínio crítico e criativo',
        capacidades: input.capacidadesTecnicas,
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

Retorne SOMENTE um JSON válido com esta estrutura (sem markdown, sem texto extra). No array "planejamentoDidatico", certifique-se de associar cada estratégia às respectivas capacidades técnicas trabalhadas no array "capacidades":
{
  "identificacao": { "docente": "...", "curso": "...", "unidadeCurricular": "...", "modulo": "...", "semestre": "...", "chTotal": 0, "chFormativa": 0, "chSomativa": 0 },
  "competencias": { "capacidadesTecnicas": [], "conhecimentos": [], "capacidadesSociais": [] },
  "situacaoAprendizagem": { "contexto": "...", "desafio": "...", "atividades": [], "recursos": [], "resultadosEsperados": [] },
  "planejamentoDidatico": [{ "estrategia": "...", "conteudo": "...", "recursos": "...", "cargaHoraria": 0, "intervencao": "...", "capacidades": ["Capacidade Técnica Trabalhada"] }],
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
    return capabilities.map(cap => {
      const cleanCap = cap.trim();
      const lower = cleanCap.toLowerCase();
      if (lower.startsWith('executar')) return `Executa ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('garantir')) return `Garante ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('desenvolver')) return `Desenvolve ${cleanCap.slice(11).trim()}`;
      if (lower.startsWith('utilizar')) return `Utiliza ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('analisar')) return `Analisa ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('criar')) return `Cria ${cleanCap.slice(5).trim()}`;
      if (lower.startsWith('identificar')) return `Identifica ${cleanCap.slice(11).trim()}`;
      if (lower.startsWith('aplicar')) return `Aplica ${cleanCap.slice(7).trim()}`;
      return `Demonstra domínio técnico em ${cleanCap.charAt(0).toLowerCase() + cleanCap.slice(1)}`;
    });
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

Escreva os critérios de forma direta, iniciando com verbos de ação na terceira pessoa (ex: 'Executa', 'Analisa', 'Desenvolve', 'Identifica'), descrevendo de forma concreta a proficiência técnica e operacional esperada. Não inclua os termos "Critério de avaliação de", "Capacidade de", ou prefixos redundantes.

Devolve ESTRITAMENTE um array JSON de strings contendo exatamente a mesma quantidade de critérios correspondentes, na mesma ordem das capacidades enviadas (exemplo: ["Demonstra precisão no manuseio de...", "Analisa criticamente os resultados de..."]). Sem formatação markdown, sem tags \`\`\`json ou explicações extras.`;

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
    return capabilities.map(cap => {
      const cleanCap = cap.trim();
      const lower = cleanCap.toLowerCase();
      if (lower.startsWith('executar')) return `Executa ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('garantir')) return `Garante ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('desenvolver')) return `Desenvolve ${cleanCap.slice(11).trim()}`;
      if (lower.startsWith('utilizar')) return `Utiliza ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('analisar')) return `Analisa ${cleanCap.slice(8).trim()}`;
      if (lower.startsWith('criar')) return `Cria ${cleanCap.slice(5).trim()}`;
      if (lower.startsWith('identificar')) return `Identifica ${cleanCap.slice(11).trim()}`;
      if (lower.startsWith('aplicar')) return `Aplica ${cleanCap.slice(7).trim()}`;
      return `Demonstra proficiência em ${cleanCap.charAt(0).toLowerCase() + cleanCap.slice(1)}`;
    });
  }
}

/**
 * Gera uma sugestão automática de Situação de Aprendizagem (Contexto/Desafio) alinhada com as capacidades e conhecimentos
 */
export async function generateLearningSituationsAI(
  moduleName: string,
  capabilities: string[],
  knowledge: string[]
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  const mockFallback = `SITUAÇÃO DE APRENDIZAGEM PRÁTICA:
Contexto: Uma empresa local do setor industrial precisa de uma solução robusta envolvendo os conceitos de ${moduleName}. Os alunos atuarão como consultores técnicos seniores para diagnosticar e implementar as melhorias necessárias.

Desafio: Desenvolver e documentar um projeto integrador completo focado em ${knowledge.slice(0, 3).join(', ')}, aplicando de forma prática as capacidades essenciais de ${capabilities.slice(0, 2).join(' e ')}.`;

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    console.warn('Sentry AI: Chave API ausente. Usando situação de aprendizagem simulada.');
    await new Promise(resolve => setTimeout(resolve, 1200));
    return mockFallback;
  }

  const prompt = `Você é um coordenador pedagógico especialista na metodologia por competências (MSEP).
Estamos elaborando o plano de ensino para a Unidade Curricular "${moduleName}".
Temos as seguintes capacidades definidas:
${capabilities.map(c => `- ${c}`).join('\n')}

E os seguintes conhecimentos a serem abordados:
${knowledge.map(k => `- ${k}`).join('\n')}

Escreva uma Situação de Aprendizagem altamente contextualizada, realista e profissional para essa unidade. O texto deve incluir de forma clara e fluida:
1. Um Contexto realista que apresente um problema no mercado de trabalho ou indústria.
2. Um Desafio prático e acionável para o aluno resolver.
3. Resultados esperados alinhados às capacidades listadas.

Seja direto, focado na metodologia por competências. Retorne somente o texto estruturado em português, sem formatação markdown ou JSON.`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return result.text || mockFallback;
  } catch (error: unknown) {
    console.error('Sentry AI Learning Situation Error:', error);
    return mockFallback;
  }
}

export interface ExtractedActivity {
  title: string;
  description: string;
  resources: string;
  expectedResult: string;
}

export async function generateActivitiesAI(
  moduleName: string,
  criteria: string[],
  intention?: 'SA' | 'ESTUDO_CASO' | 'TEORICA'
): Promise<ExtractedActivity[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  
  const mockActivities: ExtractedActivity[] = [
    {
      title: intention === 'ESTUDO_CASO' 
        ? "Estudo de Caso: Falha de Sobreaquecimento na Linha de Embalagem"
        : intention === 'TEORICA'
        ? "Questão Formativa: Modulação e Chaveamento de Carga"
        : "Desafio Prático: Calibração de Sensor de Pressão Diferencial",
      description: intention === 'ESTUDO_CASO'
        ? "Análise de parada técnica na planta de envase sob temperaturas acima do limite nominal, considerando desgaste de componentes."
        : intention === 'TEORICA'
        ? "Questão conceitual analisando as perdas de potência e eficiência de circuitos integrados sob diferentes ciclos de chaveamento."
        : "Montagem física de circuito sensorizado em bancada, ajustando a tolerância e ganho dos amplificadores operacionais.",
      resources: intention === 'TEORICA'
        ? "Folha de questões e gabarito referenciado."
        : "Instrumentos de medição industrial de alta resolução, kits de componentes práticos e guia operacional.",
      expectedResult: intention === 'ESTUDO_CASO'
        ? "Parecer com a causa raiz identificada e 3 soluções preventivas de engenharia."
        : intention === 'TEORICA'
        ? "Gabarito fundamentado justificando as alternativas incorretas e a correta."
        : "Protótipo operando nos limites regulamentados com laudo de calibração assinado."
    }
  ];

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return mockActivities;
  }

  let intentionPromptPart = "";
  if (intention === 'SA') {
    intentionPromptPart = `Intenção: "Desafio Prático/Situação Aprendizagem (Oficina/Laboratório)".
Estrutura Obrigatória dentro da descrição e resultados esperados: Contextualização Real de Mercado (Cenário de Indústria), Capacidades Técnicas Avaliadas, Recursos Físicos Necessários, Passo a Passo da Execução, e Critérios de Entrega (Evidências de bancada).`;
  } else if (intention === 'ESTUDO_CASO') {
    intentionPromptPart = `Intenção: "Estudo de Caso/Problema Técnico".
Estrutura Obrigatória dentro da descrição e resultados esperados: Descrição do Problema de Fábrica/Empresa, Dados Técnicos/Variáveis de análise, Perguntas Norteadoras de Análise Crítica e Solução Técnica Esperada.`;
  } else if (intention === 'TEORICA') {
    intentionPromptPart = `Intenção: "Avaliação Teórica/Formativa".
Estrutura Obrigatória dentro da descrição e resultados esperados: Questões contextualizadas (nunca decoreba teórica simples) com alternativas de A a E claras, e a Justificativa Pedagógica do Gabarito para orientação do professor.`;
  }

  const prompt = `Você é um especialista em educação técnica por competências na metodologia MSEP.
Temos a Unidade Curricular "${moduleName}".
Para avaliar se o aluno atingiu os seguintes critérios de avaliação de desempenho:
${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${intentionPromptPart}

Elabore 2 atividades/desafios detalhados e adequados à intenção especificada.
Retorne SOMENTE um JSON válido com esta estrutura (sem markdown, sem tags \`\`\`json, sem texto extra):
[
  {
    "title": "Título da Atividade",
    "description": "Descrição detalhada do desafio de acordo com a intenção e regras de estrutura profunda",
    "resources": "Recursos e ferramentas necessários",
    "expectedResult": "Resultado esperado e evidência de entrega detalhada"
  }
]`;

  try {
    const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const responseText = result.text || '';
    let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    return JSON.parse(cleanJson) as ExtractedActivity[];
  } catch (error: unknown) {
    console.error('Sentry AI Activities Error:', error);
    return mockActivities;
  }
}

/**
 * Corrije um cartão-resposta (imagem) usando IA e compara com o gabarito oficial.
 */
export async function correctExamWithAI(
  file: File,
  answerKey: Record<string, string>
): Promise<{ studentAnswers: Record<string, string>; score: number; feedback: string }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  const mockAnswers: Record<string, string> = {};
  Object.keys(answerKey).forEach((key) => {
    const options = ['A', 'B', 'C', 'D', 'E'];
    if (Math.random() < 0.8) {
      mockAnswers[key] = answerKey[key];
    } else {
      mockAnswers[key] = options.filter(o => o !== answerKey[key])[Math.floor(Math.random() * 4)];
    }
  });
  
  const correctCount = Object.keys(answerKey).reduce((sum, key) => sum + (mockAnswers[key] === answerKey[key] ? 1 : 0), 0);
  const totalQuestions = Object.keys(answerKey).length;
  const mockScore = Math.round((correctCount / totalQuestions) * 100);

  const mockFallback = {
    studentAnswers: mockAnswers,
    score: mockScore,
    feedback: `Correção simulada: O aluno acertou ${correctCount} de ${totalQuestions} questões (${mockScore}/100).`
  };

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    console.warn('Sentry AI: Chave API ausente. Usando correção de prova simulada.');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return mockFallback;
  }

  const prompt = `Você é um leitor óptico e corretor de provas inteligente.
Analise a imagem em anexo, que é a folha de respostas/cartão-resposta preenchido por um aluno.
Identifique quais alternativas (A, B, C, D, E) foram marcadas/preenchidas para cada uma das questões.

Compare as respostas identificadas com o seguinte gabarito oficial (Chave de Respostas):
${JSON.stringify(answerKey, null, 2)}

Retorne ESTRITAMENTE um JSON no seguinte formato (sem qualquer formatação markdown, sem tags \`\`\`json):
{
  "studentAnswers": {
    "1": "A",
    "2": "C"
  },
  "score": 85,
  "feedback": "Texto de feedback detalhando acertos e erros do aluno"
}

Observação: No campo "studentAnswers", mapeie todas as questões identificadas. Se não for possível ler alguma questão por rasura ou falta de preenchimento, defina o valor como null. No campo "score", calcule a porcentagem de acerto de 0 a 100 baseando-se no gabarito oficial.`;

  try {
    const filePart = await fileToGenerativePart(file);
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        filePart
      ]
    });
    
    const responseText = result.text || '';
    let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    
    return JSON.parse(cleanJson) as { studentAnswers: Record<string, string>; score: number; feedback: string };
  } catch (error) {
    console.error('Sentry AI Exam Correction Error:', error);
    return mockFallback;
  }
}

export interface VoiceReportResult {
  student: string;
  competency: string;
  performance: string;
  actions: string;
}

/**
 * Transforma uma transcrição livre de ditado pedagógico por voz em um relatório MSEP estruturado.
 */
export async function formatVoiceReport(transcription: string): Promise<VoiceReportResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  const mockFallback: VoiceReportResult = {
    student: 'Não identificado',
    competency: 'Competência Geral do Componente',
    performance: transcription || 'Desempenho satisfatório nas atividades práticas propostas em aula.',
    actions: 'Revisar conceitos operacionais na próxima prática.'
  };

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    console.warn('Sentry AI: Chave API ausente. Usando formatação de voz simulada.');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockFallback;
  }

  const prompt = `Você é um consultor pedagógico especialista na metodologia de ensino por competências do SENAI.
Recebemos a seguinte transcrição livre de áudio ditada pelo professor sobre a prática ou estágio de um aluno:
"${transcription}"

Sua tarefa é analisar o ditado e estruturar as observações pedagógicas de forma formal, técnica e clara nos seguintes campos:
1. Aluno: Nome do aluno citado (se não citado, indique "Não identificado").
2. Competência: Habilidade técnica ou socioemocional sendo avaliada (ex: ajuste de torno, segurança, metrologia).
3. Desempenho: Descrição técnica do desempenho do aluno observado pelo professor.
4. Ações: Sugestão de ação pedagógica, recuperação ou orientação recomendada para o aluno.

Retorne ESTRITAMENTE um JSON no seguinte formato (sem qualquer formatação markdown, sem tags \`\`\`json):
{
  "student": "Nome do Aluno",
  "competency": "Competência",
  "performance": "Descrição técnica e formal do desempenho",
  "actions": "Ações e recomendações futuras"
}`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    const responseText = result.text || '';
    let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    
    return JSON.parse(cleanJson) as VoiceReportResult;
  } catch (error) {
    console.error('Sentry AI Voice Report Error:', error);
    return mockFallback;
  }
}

export interface AIReportInput {
  className: string;
  unitName: string;
  professorName: string;
  activities: { title: string; weight: number }[];
  students: { name: string; ra: string; grades: Record<string, number>; average: number }[];
}

/**
 * Gera um relatório pedagógico profundo da IA para impressão limpa (A4)
 */
export async function generateAIReport(input: AIReportInput): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  const mockFallback = `# RELATÓRIO INDIVIDUAL DE DESEMPENHO E INTERVENÇÃO
**Instituição:** PE Generator - Educação Profissionalizante
**Data de Emissão:** ${new Date().toLocaleDateString()} | **Unidade Curricular:** ${input.unitName}
**Responsável:** Prof. ${input.professorName}

---

## 1. DADOS E DIAGNÓSTICO
A turma ${input.className} apresenta uma média geral de aproveitamento estimada em 75 pontos de 100 possíveis. A taxa de cumprimento de prazos e entrega de evidências práticas está em 85%.

Tabela de Rendimento Consolidado dos Estudantes:
| Aluno | RA | Média | Status de Risco |
${input.students.map(s => `| ${s.name} | ${s.ra} | ${s.average} pts | ${s.average < 50 ? 'Crítico (Recuperação)' : 'Estável'} |`).join('\n')}

## 2. CORPO DO DESENVOLVIMENTO
As atividades avaliativas práticas desenvolvidas neste módulo indicam que a maior parte da turma assimilou as capacidades técnicas operacionais de montagem e segurança. No entanto, o cruzamento de dados de absenteísmo aponta que as terças-feiras acumulam o maior número de faltas, influenciando diretamente a nota dos alunos que perderam as aulas de laboratório.

## 3. PLANO DE AÇÃO / CRITÉRIOS DE AVALIAÇÃO (MSEP)
- **Recuperação Imediata**: Agendar reforço de bancada para os alunos listados com status de Risco Crítico nas próximas duas semanas.
- **Ajuste de Calendário**: Deslocar os desafios práticos mais complexos para as quintas-feiras a fim de mitigar o absenteísmo observado.
- **Prazo**: Concluir as avaliações substitutivas até o encerramento da 18ª semana letiva.

---
Assinatura do Docente Responsável: Prof. ${input.professorName}
`;

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    console.warn('Sentry AI: Chave API ausente. Usando relatório simulado.');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return mockFallback;
  }

  const prompt = `Você é o motor de IA principal (Sentry AI) integrado ao aplicativo PE Generator.
Sua tarefa é formatar um Relatório Administrativo/Pedagógico de Rendimento pronto para impressão em folha A4.

Aqui estão os dados estruturados da turma para análise:
- Turma: ${input.className}
- Unidade Curricular: ${input.unitName}
- Professor: ${input.professorName}
- Atividades Avaliadas: ${JSON.stringify(input.activities, null, 2)}
- Desempenho dos Alunos (Notas e Médias): ${JSON.stringify(input.students, null, 2)}

Siga RIGOROSAMENTE as regras abaixo:
1. Único e puramente em Markdown estruturado sem emojis, sem barras de progresso visuais com caracteres, sem blocos de código (code blocks) ou elementos de UI na resposta. O texto deve ser plano, focado em tipografia preta no fundo branco para que o estilo CSS @media print o formate perfeitamente em folha A4.
2. Evite textos genéricos. Gere análises reais, diagnósticos precisos baseados nos dados enviados e aponte os alunos de risco crítico e as respectivas competências em atraso.
3. Desenvolva um plano de ação pragmático no final (Ação de intervenção pedagógica, alunos afetados e prazos).

FORMATO DE SAÍDA OBRIGATÓRIO:

# [TÍTULO DO DOCUMENTO EX: RELATÓRIO INDIVIDUAL DE DESEMPENHO E INTERVENÇÃO]
**Instituição:** PE Generator - Educação Profissionalizante
**Data de Emissão:** [Data de Hoje] | **Unidade Curricular:** ${input.unitName}
**Responsável:** ${input.professorName}

---

## 1. DADOS E DIAGNÓSTICO
[Insira tabelas markdown limpas com dados de rendimento consolidado dos estudantes e médias de notas].

## 2. CORPO DO DESENVOLVIMENTO
[Texto analítico/pedagógico profundo detalhando as capacidades operacionais assimiladas e as dificuldades observadas].

## 3. PLANO DE AÇÃO / CRITÉRIOS DE AVALIAÇÃO (MSEP)
[Plano de intervenção pedagógica claro com ações para os alunos com média abaixo de 50 pontos, indicando prazos e formas de recuperação].

---
Assinatura do Docente Responsável: Prof. ${input.professorName}`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    return result.text || mockFallback;
  } catch (error) {
    console.error('Sentry AI Report Generation Error:', error);
    return mockFallback;
  }
}

// ─── SENTRY AI COPILOT CONVERSATIONAL ENGINE ────────────────────────────────

export interface CopilotMessage {
  role: 'user' | 'model';
  text: string;
}

const COPILOT_SYSTEM_PROMPTS = {
  PLAN: `Você é o Sentry AI Copilot, coordenador pedagógico especialista em cursos técnicos SENAI por competências (MSEP).
Sua missão é ajudar o professor a elaborar e refinar de forma colaborativa a Situação de Aprendizagem (Contexto e Desafio Prático) e os Critérios de Avaliação de Desempenho para uma Unidade Curricular.

INSTRUÇÕES DE DIÁLOGO:
1. Seja consultivo, direto, acolhedor e focado no mercado industrial. Escreva respostas curtas (máximo de 3 parágrafos) e faça no máximo UMA pergunta direta e reflexiva por vez ao professor para guiar o refinamento.
2. Evite formalidades excessivas. Converse como um parceiro de trabalho experiente.
3. Se o professor disser o que quer mudar ou focar, valide a ideia dele pedagogicamente e mostre como integrar isso aos critérios ou ao contexto.
4. NUNCA envie blocos JSON cruos no diálogo regular. Apenas converse em texto livre e formatado.`,

  ACTIVITIES: `Você é o Sentry AI Copilot, especialista em elaboração de avaliações técnicas e desafios pedagógicos práticos e teóricos.
Sua missão é conversar com o professor para modelar e refinar qualquer tipo de Atividade Pedagógica de Avaliação de forma totalmente flexível.

REGRAS DE OURO DA LIBERDADE DOCENTE:
1. LIBERDADE ABSOLUTA: O professor tem autonomia total e absoluta para escolher o assunto, o escopo, o formato (questionário de múltipla escolha, dissertativa, desafio prático, estudo de caso, pesquisa, etc.), a quantidade de atividades, e os conhecimentos que quer aplicar.
2. ATENDIMENTO PRIORITÁRIO: Se o professor pedir para criar uma atividade sobre um assunto específico (por exemplo: "um questionário sobre metais ferrosos" ou "uma prática de soldagem TIG"), atenda imediatamente ao desejo dele. Os critérios e dados originais da Unidade Curricular pré-existentes na tela servem apenas como contexto auxiliar de fundo e sugestão opcional, mas NUNCA devem limitar ou restringir a liberdade de criação do docente.
3. ADAPTABILIDADE PEDAGÓGICA: Se o professor pedir uma atividade sobre um assunto que não esteja nos conhecimentos formais listados da UC atual, crie com entusiasmo, garantindo que ele consiga explorar quaisquer tópicos necessários com seus alunos.

INSTRUÇÕES DE DIÁLOGO:
1. Converse de forma direta, pragmática e amigável.
2. Se o professor solicitar um questionário, testes ou quantidade específica de questões, elabore essas questões em detalhe com ele diretamente na conversa.
3. Responda de forma sucinta e finalize sempre com uma pergunta direcionada para refinar o que foi proposto.
4. NUNCA envie blocos JSON cruos no chat regular. Converse sempre em texto plano.`,

  REPORT: `Você é o Sentry AI Copilot, motor analítico administrativo integrado ao PE Generator.
Sua missão é discutir com o professor o rendimento da turma (médias, riscos críticos, absenteísmo) e ajudá-lo a formular um parecer pedagógico analítico profundo e um plano de ação de intervenção.

INSTRUÇÕES DE DIÁLOGO:
1. Analise os dados nominais de rendimento da turma e discuta os fatores observados pelo professor (ex: motivos de faltas, lacunas práticas).
2. Proponha ações pragmáticas de recuperação e prazos de forma amigável, refinando o plano com base na rotina real do docente.
3. Mantenha as respostas concisas e curtas, finalizando com uma pergunta reflexiva sobre o andamento pedagógico.
4. NUNCA gere o markdown completo de impressão durante o diálogo regular. Apenas discuta e construa os pontos do parecer.`
};

/**
 * Envia o histórico do chat de conversação e a nova resposta do usuário para o Gemini
 */
export async function sendMessageToCopilot(
  mode: 'PLAN' | 'ACTIVITIES' | 'REPORT',
  history: CopilotMessage[],
  userInput: string,
  contextData: any
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  const mockReplies: Record<'PLAN' | 'ACTIVITIES' | 'REPORT', string[]> = {
    PLAN: [
      `Entendi a sua preferência. É uma excelente decisão integrar esse foco prático na Unidade Curricular de ${contextData?.unitName || 'Curso'}. Como você prefere que os alunos realizem a verificação física no laboratório: utilizando kits didáticos prontos ou montando o circuito do zero em matriz de contatos?`,
      `Perfeito! Isso trará muito realismo ao desafio. Vou estruturar a Situação de Aprendizagem de modo que os critérios de avaliação cobrem o manuseio adequado das ferramentas e a postura de segurança em bancada. Deseja que eu consolide essa versão ou quer ajustar os conhecimentos que serão avaliados?`,
      `Entendido. Todas as capacidades foram vinculadas de forma ideal. Se estiver pronto, clique em "Consolidar e Aplicar" para que eu monte o Plano de Ensino estruturado final e as rubricas MSEP na sua tela!`
    ],
    ACTIVITIES: [
      `Excelente escolha de intenção. Para a atividade proposta na UC de ${contextData?.unitName || 'Módulo'}, você prefere que o desafio simule um cenário de automação de planta industrial ou um diagnóstico residencial prático?`,
      `Ótimo! O uso desses kits em laboratório garantirá que o aluno desenvolva a capacidade de parametrização real. Vou detalhar o passo a passo da execução e os critérios de evidência de bancada. Gostaria de estipular um limite de tempo ou tolerância de falhas para a entrega?`,
      `Perfeito. As diretrizes estão muito sólidas. Clique em "Consolidar e Aplicar" para eu injetar as atividades formativas com seus respectivos pesos diretamente na sua grade de notas!`
    ],
    REPORT: [
      `Analisando o rendimento da turma ${contextData?.className || 'Geral'}, vejo que alguns estudantes encontram-se com média abaixo de 50 pontos e com pendências de entrega. Quais foram as maiores dificuldades técnicas ou de absenteísmo que você observou neles durante as aulas práticas?`,
      `Entendo, o absenteísmo nas aulas de laboratório realmente afeta muito a absorção das competências. Para mitigar isso no plano de ação pedagógico, concorda em agendarmos uma atividade de recuperação substitutiva em bancada nas próximas duas semanas, ou prefere estender o prazo final de entrega?`,
      `Com certeza, essa data dá margem para que todos façam o reforço. Já tracei os diagnósticos dos alunos críticos e a intervenção. Clique em "Consolidar e Aplicar" para eu formular o parecer estruturado pronto para impressão A4 Limpa!`
    ]
  };

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (mode === 'ACTIVITIES') {
      const lowerInput = userInput.toLowerCase();
      const hasMetalKeywords = lowerInput.includes('metal') || lowerInput.includes('ferro') || lowerInput.includes('materia');
      const hasQuestionnaire = lowerInput.includes('quest') || lowerInput.includes('multipla') || lowerInput.includes('alternativa') || lowerInput.includes('questionario');
      
      if (hasMetalKeywords && hasQuestionnaire) {
        return `Com certeza! Elaborar um questionário com 10 questões sobre **Metais Ferrosos** na disciplina de **Tecnologia dos Materiais** é uma excelente forma de avaliar a compreensão dos alunos sobre as ligas de ferro-carbono, tratamentos térmicos e classificação de aços.
        
Acabei de estruturar um questionário de 10 questões de múltipla escolha, contendo 5 alternativas (A a E) e o respectivo gabarito. Clique em **"Aplicar"** na barra superior do copiloto para carregar esse questionário completo diretamente na sua grade de atividades e notas!`;
      }
    }

    const userMsgCount = history.filter(h => h.role === 'user').length;
    const index = Math.min(userMsgCount, mockReplies[mode].length - 1);
    return mockReplies[mode][index];
  }

  const systemInstruction = COPILOT_SYSTEM_PROMPTS[mode];
  const contextIntro = `DADOS DE CONTEXTO ATIVO DA APLICAÇÃO:
${JSON.stringify(contextData, null, 2)}
---------------------------------------------
Use essas informações de contexto pedagógico para guiar sua conversa com o professor.`;

  // Formatar histórico para o Gemini SDK
  const geminiContents = [
    { role: 'user', parts: [{ text: contextIntro }] },
    ...history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })),
    { role: 'user', parts: [{ text: userInput }] }
  ];

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: geminiContents,
      config: { systemInstruction }
    });
    return result.text || "Desculpe, não consegui processar a resposta.";
  } catch (error) {
    console.error('Sentry AI Copilot Message Error:', error);
    throw error;
  }
}

/**
 * Conclui a conversa com o Copiloto e gera o artefato final estruturado
 */
export async function finalizeCopilotGeneration(
  mode: 'PLAN' | 'ACTIVITIES' | 'REPORT',
  history: CopilotMessage[],
  contextData: any
): Promise<any> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (!apiKey || apiKey === 'SuaApiKeyDoGoogleGeminiAqui') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Retornar fallback simulado coerente baseado no modo
    if (mode === 'PLAN') {
      const caps = contextData?.capabilities || ["Executar montagem industrial", "Garantir conformidade técnica"];
      return {
        learningContext: `SITUAÇÃO DE APRENDIZAGEM PRÁTICA (CONSOLIDADA POR CONVERSA):
Contexto: Uma indústria parceira precisa de suporte para ${contextData?.unitName || 'o setor mecânico'}. Os alunos atuarão em duplas em um projeto integrador com os materiais discutidos na conversa com o docente.

Desafio: Elaborar laudo operacional de calibração técnica e aplicar testes funcionais conforme as diretrizes levantadas no chat.`,
        criteria: caps.map((c: string) => `Demonstra proficiência operacional na capacidade de: ${c} de forma autônoma.`)
      };
    } else if (mode === 'ACTIVITIES') {
      // Verificar se o histórico cita termos relacionados a metal/ferroso/questionário
      const hasMetalKeywords = history.some(h => 
        h.text.toLowerCase().includes('metal') || 
        h.text.toLowerCase().includes('ferro') || 
        h.text.toLowerCase().includes('material')
      );
      const hasQuestionnaire = history.some(h => 
        h.text.toLowerCase().includes('quest') || 
        h.text.toLowerCase().includes('multipla') || 
        h.text.toLowerCase().includes('alternativa') || 
        h.text.toLowerCase().includes('questionario')
      );

      if (hasMetalKeywords && hasQuestionnaire) {
        return [
          {
            title: "Questionário Formativo: Ligas Ferrosas & Classificação",
            description: `Questionário de Múltipla Escolha - 10 Questões sobre Metais Ferrosos (Tecnologia dos Materiais):

Questão 1: Qual dos seguintes elementos é o principal constituinte de liga na fabricação do aço?
A) Cobre
B) Carbono (Correta)
C) Alumínio
D) Zinco
E) Chumbo

Questão 2: O ferro fundido cinzento caracteriza-se pela presença de carbono livre sob a forma de:
A) Carbonetos de silício
B) Lamelas de grafita (Correta)
C) Nódulos esferoidais
D) Cementita pura
E) Martensita temperada

Questão 3: Qual é o teor aproximado de carbono que divide os aços dos ferros fundidos?
A) 0,5%
B) 2,11% (Correta)
C) 4,3%
D) 6,67%
E) 0,008%

Questão 4: O processo de têmpera em aços carbono visa principalmente obter a fase microestrutural chamada:
A) Perlita
B) Ferrita
C) Martensita (Correta)
D) Austenita
E) Ledeburita

Questão 5: Dentre as ligas ferrosas abaixo, qual possui a maior ductilidade?
A) Ferro fundido branco
B) Aço de baixo carbono (Correta)
C) Aço ferramenta rápido
D) Ferro fundido cinzento
E) Aço martensítico

Questão 6: A adição de Cromo (Cr) em teores superiores a 12% em aços visa principalmente conferir:
A) Alta condutibilidade elétrica
B) Resistência à corrosão - Aço Inoxidável (Correta)
C) Baixo ponto de fusão
D) Alta maleabilidade em baixas temperaturas
E) Coloração avermelhada

Questão 7: Qual é o principal mineral fonte para a extração do ferro no alto-forno?
A) Bauxita
B) Hematita (Correta)
C) Calcita
D) Galena
E) Calcopirita

Questão 8: O que diferencia o ferro fundido nodular do cinzento?
A) O teor de silício é zero
B) O grafite está em forma de esferas/nódulos devido à adição de magnésio (Correta)
C) É um metal não-ferroso
D) Não possui carbono
E) Tem alta fragilidade em relação ao cinzento

Questão 9: O tratamento térmico de recozimento em ligas ferrosas tem como objetivo:
A) Aumentar a dureza ao máximo
B) Aliviar tensões internas e aumentar a ductilidade/usinabilidade (Correta)
C) Criar uma camada superficial cementada
D) Eliminar totalmente o cromo da liga
E) Transformar o aço em cobre

Questão 10: O constituinte 'Cementita' nas ligas Fe-C é quimicamente definido como:
A) Silicato de ferro
B) Carboneto de ferro - Fe3C (Correta)
C) Óxido ferroso
D) Sulfeto de ferro
E) Ferro puro alfa`,
            resources: "Folha de questões impressa e gabarito.",
            expectedResult: "Gabarito preenchido pelos alunos, demonstrando proficiência teórica nos constituintes metalúrgicos das ligas Fe-C."
          }
        ];
      }

      return [
        {
          title: "Desafio Conversacional 1: Implementação e Parametrização",
          description: "Montagem física do circuito discutido no chat e elaboração do fluxograma de processo com base nos insumos informados pelo professor.",
          resources: "Instrumentos de medição, osciloscópio, kit de prototipagem.",
          expectedResult: "Protótipo operando nos limites nominais sem sobreaquecimento."
        },
        {
          title: "Desafio Conversacional 2: Diagnóstico de Falha",
          description: "Inserção de anomalias no sistema e análise diagnóstica individual documentando a identificação da causa raiz em folha de laudo.",
          resources: "Painel de testes com chaves de falhas simuladas.",
          expectedResult: "Causa identificada em tempo hábil com parecer assinado."
        }
      ];
    } else {
      return `# RELATÓRIO INDIVIDUAL DE DESEMPENHO E INTERVENÇÃO
**Instituição:** PE Generator - Educação Profissionalizante
**Data de Emissão:** ${new Date().toLocaleDateString()} | **Unidade Curricular:** ${contextData?.unitName}
**Responsável:** Prof. Wellington

---

## 1. DADOS E DIAGNÓSTICO
A turma ${contextData?.className} foi analisada em conjunto com o docente via Sentry AI Copilot. O rendimento geral consolidou-se em 74/100, mas o absenteísmo nos encontros práticos foi apontado como fator limitante principal para os estudantes com média insatisfatória.

Tabela de Rendimento Consolidado dos Estudantes:
| Aluno | RA | Média | Status de Risco |
${contextData?.students?.map((s: any) => `| ${s.name} | ${s.ra} | ${s.average} pts | ${s.average < 50 ? 'Crítico (Recuperação)' : 'Estável'} |`).join('\n')}

## 2. CORPO DO DESENVOLVIMENTO
As discussões bilaterais entre o docente e a IA Sentry determinaram que o foco das ações deve recair sobre a reposição das atividades de laboratório. O professor apontou facilidade da turma em relação aos conceitos introdutórios, mas deficiências operacionais significativas sob estresse de montagem.

## 3. PLANO DE AÇÃO / CRITÉRIOS DE AVALIAÇÃO (MSEP)
- **Ação**: Implementar reposição de laboratório em duplas com foco nos alunos listados com status de Risco Crítico.
- **Prazo**: Concluir as avaliações substitutivas até o encerramento da 15ª semana letiva.
- **Recuperação**: Exercícios práticos focados nas capacidades técnicas de segurança e ajuste fino.

---
Assinatura do Docente Responsável: Prof. Wellington`;
    }
  }

  let prompt = "";
  if (mode === 'PLAN') {
    prompt = `Você é o consolidador oficial do Sentry AI Copilot.
Estamos finalizando a conversa de elaboração de plano com o professor. Com base no seguinte histórico de diálogo entre o professor e você:
${history.map(h => `${h.role === 'user' ? 'Docente' : 'Sentry AI'}: ${h.text}`).join('\n')}

E no contexto pedagógico original:
UC: ${contextData?.unitName}
Capacidades a serem avaliadas: ${JSON.stringify(contextData?.capabilities || [])}
Conhecimentos: ${JSON.stringify(contextData?.knowledgeList || [])}

Consolide as decisões tomadas e gere a Situação de Aprendizagem (Contexto e Desafio) e o Critério correspondente a cada capacidade.
Retorne ESTRITAMENTE um JSON no seguinte formato (sem markdown, sem tags \`\`\`json):
{
  "learningContext": "Texto contextualizado completo da situação de aprendizagem (unindo o contexto de mercado e o desafio prático combinados)",
  "criteria": ["Critério de avaliação correspondente à Capacidade 1", "Critério correspondente à Capacidade 2"]
}`;
  } else if (mode === 'ACTIVITIES') {
    prompt = `Você é o consolidador oficial do Sentry AI Copilot.
Com base no histórico da conversa com o professor:
${history.map(h => `${h.role === 'user' ? 'Docente' : 'Sentry AI'}: ${h.text}`).join('\n')}

E no contexto pedagógico da UC:
UC: ${contextData?.unitName}
Critérios de Avaliação: ${JSON.stringify(contextData?.criteria || [])}
Intenção selecionada: ${contextData?.intention || 'SA'}

Gere as atividades/desafios de avaliação perfeitamente consolidados que reflitam as decisões, assuntos e escolhas feitas pelo professor no diálogo (respeitando o assunto e quantidade de atividades solicitada por ele, geralmente de 1 a 3 atividades).
IMPORTANTE: As escolhas, assuntos e preferências do professor na conversa possuem precedência absoluta sobre qualquer outro dado da Unidade Curricular. Se ele pedir uma atividade sobre um assunto livre, gere com foco total nesse assunto.
Se a conversa envolver questionários, testes ou questões de múltipla escolha/dissertativas, você DEVE escrever todas as questões por extenso (com todas as alternativas e gabarito) de forma legível e completa dentro do campo "description". Não abrevie nem oculte as questões.
Retorne SOMENTE um JSON válido com esta estrutura (sem markdown, sem tags \`\`\`json):
[
  {
    "title": "Título da Atividade",
    "description": "Descrição detalhada (ou lista de questões por extenso, se questionário)",
    "resources": "Recursos e ferramentas necessários",
    "expectedResult": "Resultado esperado e evidência de entrega detalhada"
  }
]`;
  } else if (mode === 'REPORT') {
    prompt = `Você é o consolidador oficial do Sentry AI Copilot.
Com base no histórico da conversa sobre o rendimento da turma:
${history.map(h => `${h.role === 'user' ? 'Docente' : 'Sentry AI'}: ${h.text}`).join('\n')}

E nos dados analíticos da turma:
Turma: ${contextData?.className}
UC: ${contextData?.unitName}
Atividades e Pesos: ${JSON.stringify(contextData?.activities || [])}
Alunos (Notas e Médias): ${JSON.stringify(contextData?.students || [])}

Gere o Relatório Pedagógico / Parecer de Rendimento final consolidado em formato Markdown pronto para impressão A4 Limpo.
Siga RIGOROSAMENTE as regras:
1. Markdown estruturado sem emojis, sem barras de progresso visuais com caracteres, sem blocos de código (code blocks) ou elementos de UI. O texto deve ser plano, focado em tipografia preta no fundo branco.
2. Seja profundo, integre as justificativas de absenteísmo e dificuldades informadas pelo professor no chat.
3. Termine com o Plano de Ação de Intervenção Pedagógica contendo as ações combinadas de recuperação e os prazos definidos.

FORMATO DE SAÍDA OBRIGATÓRIO:

# [TÍTULO DO DOCUMENTO EX: RELATÓRIO INDIVIDUAL DE DESEMPENHO E INTERVENÇÃO]
**Instituição:** PE Generator - Educação Profissionalizante
**Data de Emissão:** [Data de Hoje] | **Unidade Curricular:** ${contextData?.unitName}
**Responsável:** Prof. Wellington

---

## 1. DADOS E DIAGNÓSTICO
[Insira tabelas markdown limpas com dados de rendimento consolidado dos estudantes e médias de notas].

## 2. CORPO DO DESENVOLVIMENTO
[Texto analítico/pedagógico profundo detalhando as capacidades operacionais assimiladas, as dificuldades informadas pelo professor e as justificativas de absenteísmo].

## 3. PLANO DE AÇÃO / CRITÉRIOS DE AVALIAÇÃO (MSEP)
[Plano de intervenção pedagógica claro com ações para os alunos com média abaixo de 50 pontos, indicando prazos e formas de recuperação combinados].

---
Assinatura do Docente Responsável: Prof. Wellington`;
  }

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    
    const responseText = result.text || '';
    if (mode === 'REPORT') {
      return responseText;
    }

    let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanJson.match(mode === 'PLAN' ? /\{[\s\S]*\}/ : /\[[\s\S]*\]/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Sentry AI Copilot Consolidation Error:', error);
    throw error;
  }
}





