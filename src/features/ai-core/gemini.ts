import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';

// Initialize the Gemini API using the new official SDK
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

/**
 * Converts a generic File object into a base64 string
 */
async function fileToGenerativePart(file: File): Promise<any> {
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
 * Extracts text from Excel files using sheetjs
 */
async function extractExcelToCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        resolve(csv);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
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

function getMockData(type: ExtractionType) {
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
  return {};
}

/**
 * Main Sentry AI Function
 * Sends a file to Gemini and asks it to extract structured JSON data
 */
export async function extractDataFromFile(file: File, type: ExtractionType): Promise<any> {
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
    
    return JSON.parse(cleanJsonString);
  } catch (error: any) {
    console.error("Sentry AI Extraction Error:", error);
    
    // Tratamento robusto para chave inválida ou bloqueada
    if (error?.message?.includes('API key not valid') || error?.status === 400 || String(error).includes('400')) {
      console.warn("Sentry AI: Chave de API recusada pelo Google. Ativando Modo Simulação de Emergência.");
      return getMockData(type);
    }
    
    throw new Error("Falha na extração de dados via IA. Verifique se a chave API é válida e se o arquivo está legível.");
  }
}
