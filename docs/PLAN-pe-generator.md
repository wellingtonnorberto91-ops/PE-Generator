# Plano do Projeto: PE Generator

**Overview:**
O PE Generator é uma plataforma de gestão pedagógica desenhada para automatizar a criação de Planos de Ensino (PE) e Dossiês de Alunos. Foca na eliminação de erros logísticos, matrícula rápida de alunos e preenchimento de dados institucionais utilizando Inteligência Artificial para extração de dados de documentos brutos.

**Project Type:** WEB (React / Vite + Firebase)

**Success Criteria:**
- **Extração Universal via IA (Sentry AI + Gemini):** Alimentação do banco de dados (Calendários, Turmas, Alunos, etc.) se dará prioritariamente pelo **upload de documentos (PDF, DOC, Excel)** nas suas respectivas abas. O Google Gemini interpretará os arquivos e extrairá as informações estruturadas.
- **Lógica de Datas:** Motor de cálculo que estipula o fim de turmas com base na carga horária cruzada com os calendários extraídos pela IA.
- **Dossiê Digital:** Acompanhamento contínuo de competências técnicas e socioemocionais.
- **UI/UX:** Interface High-Tech Industrial, alto contraste e responsiva.

**Tech Stack:**
- **Frontend:** React (Vite), TypeScript, Tailwind CSS (High-Tech Industrial).
- **Backend/Data:** Firebase Firestore.
- **IA/Integração:** **Google Gemini API** (Módulo central de extração de dados para todos os formulários baseados em upload).
- **Date Handling:** `date-fns` aliado ao motor logístico.

---

## File Structure (Proposta Inicial)
```
src/
├── assets/          # Ícones e imagens
├── components/      # Componentes UI (Design System High-Tech, Drag&Drop genérico)
├── features/
│   ├── calendar/    # Upload de Calendário Escolar -> Extração IA -> Firestore
│   ├── classes/     # Upload de Grade/Matriz -> Gestão de Turmas e PEs
│   ├── students/    # Upload de Lista de Chamada -> Dossiê de Alunos
│   └── ai-core/     # Motor central do Sentry AI (Upload + Prompting pro Gemini)
├── firebase/        # Configuração Firebase
├── hooks/           # Hooks customizados
├── types/           # Interfaces TypeScript
└── utils/           # Funções utilitárias
```

---

## Task Breakdown

### Task 1: Design System & Setup Base
- **Name:** Setup Frontend
- **Agent/Skill:** `frontend-specialist`
- **Priority:** P0
- **Input:** Configurar Tailwind CSS, Rotas base e Tela de Login via Firebase Auth. Componente Genérico de Upload (Drag & Drop) com estética High-Tech.

### Task 2: Core Sentry AI (Integração Gemini)
- **Name:** Módulo de IA Universal
- **Agent/Skill:** `backend-specialist`
- **Priority:** P1
- **Input:** Função que recebe um arquivo (PDF/Excel), converte o texto e envia ao Google Gemini com um schema JSON esperado (dependendo de qual aba chamou a função).
- **Output:** Payload estruturado pronto para o Firestore.

### Task 3: Aba Calendários Escolares (Alimentação via IA)
- **Name:** Módulo de Calendário
- **Agent/Skill:** `frontend-specialist`
- **Priority:** P2
- **Dependencies:** Task 2
- **Input:** Tela de upload do Calendário da Unidade. A IA extrai dias letivos, feriados e recessos.
- **Output:** Dados salvos no Firestore e Motor Logístico validando o calendário.

### Task 4: Aba Turmas e Planos de Ensino
- **Name:** Módulo PE e Logística
- **Agent/Skill:** `frontend-specialist` + `database-architect`
- **Priority:** P2
- **Dependencies:** Task 3
- **Input:** Criação de turmas cruzando a carga horária com o motor de datas calculado na Task 3. Upload de cronogramas.

### Task 5: Aba Alunos (Matrícula via IA)
- **Name:** Importação de Alunos
- **Agent/Skill:** `backend-specialist`
- **Priority:** P2
- **Dependencies:** Task 2, Task 4
- **Input:** Upload de listas do sistema acadêmico em PDF/Excel, gerando os perfis dos alunos na base.

### Task 6: Dossiê e Competências
- **Name:** Módulo Dossiê Digital
- **Agent/Skill:** `frontend-specialist`
- **Priority:** P3
- **Input:** Grid de avaliação de competências técnicas/socioemocionais atreladas aos alunos importados.

---

## ✅ PHASE X (Verification)
- [ ] Segurança: Chave do Gemini em variáveis de ambiente.
- [ ] Múltiplos formatos: O Sentry AI deve ler PDF, DOC e Excel corretamente.
- [ ] Motor logístico sem falsos positivos.
