# Plano de Integração de Infraestrutura

**Overview:**
Configuração da infraestrutura de um projeto novo em React (Vite) conectado a um repositório existente no GitHub, configurado para deploy contínuo na Vercel e integração com Firebase (Auth + Firestore). 

**Project Type:** WEB

**Success Criteria:**
- App base React (Vite) criado e rodando.
- Git instalado (se necessário) e repositório local conectado com o GitHub remoto.
- SDK do Firebase configurado para Auth e Firestore no frontend.
- Deploy automático configurado via integração GitHub -> Vercel.

**Tech Stack:**
- **Frontend:** React + Vite (Rápido para SPAs).
- **Backend/BaaS:** Firebase Authentication & Firestore.
- **Controle de Versão:** Git & GitHub.
- **Hosting/CI/CD:** Vercel.

---

## Task Breakdown

### Task 1: Instalação de Pré-requisitos
- **Name:** Setup de ambiente (Git)
- **Agent/Skill:** `orchestrator` / `bash-windows`
- **Priority:** P0
- **Dependencies:** Nenhuma
- **Input:** Comando `winget install --id Git.Git -e --source winget` ou similar para garantir a existência do git.
- **Output:** Git disponível no terminal.
- **Verify:** `git --version` retorna a versão instalada.

### Task 2: Criação do Projeto Base
- **Name:** Bootstrap React (Vite)
- **Agent/Skill:** `frontend-specialist` / `react-best-practices`
- **Priority:** P1
- **Dependencies:** Task 1
- **Input:** Comando `npx create-vite@latest . --template react-ts`
- **Output:** Estrutura base de pastas e arquivos React.
- **Verify:** `npm install` roda com sucesso e `npm run dev` abre o app base.

### Task 3: Inicialização e Conexão Git
- **Name:** Setup Repositório
- **Agent/Skill:** `orchestrator`
- **Priority:** P1
- **Dependencies:** Task 1, Task 2
- **Input:** Obter a URL do repositório remoto do usuário, `git init`, `git add .`, `git commit -m "Initial commit"`, `git remote add origin <url>`, `git push -u origin main`.
- **Output:** Código base enviado ao GitHub.
- **Verify:** Repositório remoto atualizado.

### Task 4: Configuração Base do Firebase
- **Name:** Firebase Setup (Frontend)
- **Agent/Skill:** `backend-specialist` / `api-patterns`
- **Priority:** P2
- **Dependencies:** Task 2
- **Input:** `npm install firebase`, criação do arquivo `src/firebase/config.ts`.
- **Output:** App Firebase inicializado no projeto.
- **Verify:** Objeto `auth` e `db` exportados de forma segura utilizando variáveis de ambiente (`import.meta.env`).

### Task 5: Integração Vercel
- **Name:** Deploy Vercel
- **Agent/Skill:** `devops-engineer`
- **Priority:** P3
- **Dependencies:** Task 3, Task 4
- **Input:** Importar projeto do GitHub na Vercel e registrar variáveis de ambiente.
- **Output:** URL pública rodando o código.
- **Verify:** App acessível em URL fornecida pela Vercel.

---

## ✅ PHASE X (Verification)
- [ ] `git --version`
- [ ] Lint: Pass
- [ ] Security: No secrets hardcoded (firebase config via `.env`)
- [ ] Build: `npm run build` succeeds
