# Memorial de Desenvolvimento - PE Generator

Este documento consolida o histórico de desenvolvimento do **PE Generator**, registrando a arquitetura pedagógica implementada, as soluções de bugs e as atualizações estruturais realizadas para guiar sessões e agentes de IA futuros.

---

## 1. Visão Geral da Plataforma
O **PE Generator** é uma plataforma educacional web voltada para docentes do SENAI, estruturada sob a **Metodologia de Ensino por Competências (MSEP)**. Ela permite a extração de planos de curso, geração automática de planos de ensino por IA (Gemini), acompanhamento formativo e lançamento de notas e evidências de desafios profissionais.

* **Tecnologias**: React 19, TypeScript, Vite, Tailwind CSS v4, Google GenAI SDK (Gemini), Firebase Firestore & Authentication, Firebase Hosting.
* **Hosting Oficial**: [https://pe-generator-a7f2f.web.app](https://pe-generator-a7f2f.web.app)
* **Repositório Git**: [https://github.com/wellingtonnorberto91-ops/PE-Generator.git](https://github.com/wellingtonnorberto91-ops/PE-Generator.git)

---

## 2. Histórico de Melhorias & Funcionalidades Implementadas

### A. Ajuste e Formatação de Conhecimentos
* **O que foi feito**: Ajustamos a exibição dos tópicos de conhecimentos técnicos e teóricos na listagem de Unidades Curriculares e no modal de criação. Eles passaram a ser renderizados em uma lista vertical estruturada com marcadores de ponto estilizados (`w-1.5 h-1.5 bg-indigo-400`), correspondendo perfeitamente ao formato dos planos de curso oficiais.

### B. Otimização de Tabela MSEP e Gaveta Pedagógica
* **O que foi feito**: Unificamos as antigas seções 5 (Configurações de Metodologia) e 6 (Tabela de Avaliação) do modal do plano de ensino em uma única área despoluída: **"5. Tabela de Avaliação Formativa & Critérios"**.
* O painel de upload de PDF de referência e a seleção de metodologias salvas foram recolhidos dentro de uma gaveta expansível via `<details>`, mantendo a interface limpa e focada no preenchimento de notas dos alunos.

### C. Resolução do Bug da Tela Escura (ClipboardList)
* **Causa Raiz**: O travamento de tela inteira preta/escura ao tentar abrir o modal de criação de planos ocorria devido a um erro de tempo de execução (`ReferenceError: ClipboardList is not defined`) na renderização do ícone do Lucide. O empacotador Vite HMR não recarregava o código devido a falhas estritas de compilação do TypeScript no painel de avaliações.
* **Solução**: Corrigimos todas as tipagens estritas, imports e variáveis ociosas em `EvaluationPanel.tsx`, adicionamos a importação explícita de `ClipboardList` em `TeachingPlanCreator.tsx` e restabelecemos a integridade de compilação geral (`npm run build` passou com sucesso).

### D. Novo Painel de Atividades & Lançamento de Resultados
* **Local**: [EvaluationPanel.tsx](file:///c:/Users/welli/OneDrive/Documentos/Antigravit/PE%20Generator/src/pages/EvaluationPanel.tsx)
* **O que foi feito**:
  * Desenvolvemos do zero uma área completa onde o docente pode criar desafios práticos alinhados com o mercado de trabalho (gerados automaticamente via Gemini ou adicionados manualmente).
  * Criamos uma grade de lançamentos de notas (0 a 100) associada a conceitos formativos (**Satisfatório "S"**, **Não Satisfatório "NS"**, **Destaque "D"**) por aluno e por atividade.
  * Adicionamos a simulação de upload e visualização de evidências operacionais (thumbnails de imagens e ícones de arquivos anexados).
  * Montamos uma aba analítica com indicadores de KPIs da turma (média geral da classe, taxa de aproveitamento, e lista automática de alunos que necessitam de apoio pedagógico).

### E. Integração e Sincronização Inteligente com Tabela de Critérios
* **O que foi feito**:
  * Desenvolvemos a aba **"Plano de Ensino"** dentro do painel, que busca na coleção `assessments_formativa` os dados pedagógicos completos da UC selecionada.
  * Criamos a função `handleSyncActivitiesToCriteria`. Ao ser acionada, ela calcula a média geral das notas obtidas pelos alunos nas atividades práticas do painel e mapeia para conceitos MSEP (Média >= 85 vira *"Destaque"*, de 50 a 84 vira *"Satisfatório"* e menor que 50 vira *"Não Satisfatório"*).
  * Os conceitos são gravados de forma automática na tabela oficial do plano de ensino do aluno correspondente no banco de dados Firestore.

### F. Impressão de Documentações Variadas (CSS @media print A4)
* **O que foi feito**: Substituímos o botão de "imprimir relatório completo" por uma central interativa de documentações pedagógicas individuais e especializadas. O docente pode visualizar e emitir de forma independente:
  1. **Ficha Pedagógica de Rendimento Geral** (resumo analítico de KPIs da classe para a coordenação).
  2. **Boletim Individual de Avaliação Formativa** (relatório detalhado e assinado individualmente por aluno selecionado).
  3. **Dossiê Digital de Evidências** (lista focada nos arquivos e mídias de comprovação das entregas).
  4. **Registro de Critérios MSEP Integrado** (matriz oficial do plano contendo o conceito de todos os alunos).
  5. **Plano de Ensino Completo** (impressão do plano e rubricas no formato oficial MSEP do SENAI).
* Cada template foi configurado com folhas de estilo de impressão estritas para ocultar componentes web e centralizar os dados perfeitamente em páginas A4 prontas para PDF.

### G. Simplificação do Dashboard
* **O que foi feito**: Removido o botão "Nova Importação Inteligente" do cabeçalho do Dashboard Inicial para simplificar o fluxo de navegação do usuário e evitar acessos redundantes à importação por IA. O import de ícone ocioso `UploadCloud` foi removido.

### H. Dashboard Pedagógico Analítico (BI)
* **O que foi feito**: Substituída a página inicial estática por um painel de Business Intelligence dinâmico focado em intervenções pedagógicas preventivas. O painel inclui:
  1. **Seletor de Turmas**: Carregamento assíncrono das turmas da coleção `teaching_plans` do Firestore.
  2. **Alertas de Risco Preventivos**: Identificação imediata e lista ativa de alunos críticos (média < 50 ou faltas > 25%).
  3. **Gráfico Scatter Plot de Risco**: Gráfico interativo bidimensional (Presença vs. Média de Notas) com tooltips detalhados por aluno.
  4. **Mapa de Calor de Absenteísmo**: Grid de assiduidade relacionando dias da semana e horários das aulas.
  5. **Gargalos de Aprendizagem**: Gráfico de barras indicando a proficiência por competência do plano de ensino ativo.
  6. **Acompanhamento de Cronograma**: Comparação física entre aulas executadas e previstas.
* As interfaces usam estilização brutalista pura em Tailwind CSS v4, garantindo compatibilidade estrita e leveza no React 19.

### I. Motor de Cronograma Interativo (Gantt & Overrides) & Analytics
* **O que foi feito**:
  * **Configuração em Aulas:** Trocamos a modelagem de horas de aula brutas por parametrização em **Aulas por Dia** e **Duração da Aula (minutos)** nas configurações de criação do Plano de Ensino. A tabela de Gantt renderiza as aulas previstas por dia dinamicamente.
  * **Gráfico de Gantt Interativo (Overrides):** Habilitamos cliques nos cabeçalhos de dias do cronograma para abrir um popover (modal) de exceções. O docente pode marcar dias como **Feriado**, **Sem Aula** ou **Reposição** com uma nota de texto. Os dados são gravados no Firestore no campo `scheduleOverrides` do plano correspondente. O motor logístico em TypeScript recalcula e desloca dinamicamente a cadeia inteira de aulas na tela ao salvar.
  * **Painel de Analytics de Notas MSEP:** Construímos um painel analítico no rodapé da página de cronogramas que compila as avaliações individuais por capacidade técnica obtidas na coleção `assessments_formativa`. Apresenta uma barra de progresso empilhada (S, NS, D) por capacidade técnica e emite um alerta piscante crítico se a taxa de "Não Satisfatório" (NS) exceder o limite de **30%**.

---

## 3. Estado Atual do Repositório (Commit Mais Recente)
* **Commit**: `2eb0c67` na branch `main`
* **Mensagem**: *"feat: Gantt interativo com exceções de datas, aulas por dia letivo e painel analítico MSEP"*
* **Status**: Estável, hospedado e compilando com sucesso absoluto, sem erros de tipagem TypeScript ou de runtime.
* **Link de Produção**: [https://pe-generator-a7f2f.web.app](https://pe-generator-a7f2f.web.app)
