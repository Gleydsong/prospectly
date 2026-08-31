# Plano de implementação redesign das telas de Auth

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa a tarefa. Passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Objetivo:** Redesenhar login e register como AuthShell split-screen compartilhado alinhado com a marca Prospectly landing/app.

**Arquitetura:** `AuthShell` compartilhado (painel de marca + slot de formulário + faixa de confiança). Páginas mantêm lógica de form/API. Novo copy via i18n.

**Stack:** React, Vite, Tailwind, react-i18next, lucide-react, vitest

## Restrições globais

- Preservar campos de auth e contratos de API existentes
- Visual: zinc + emerald, Outfit, `rounded-control`, superfícies claras
- Sem números falsos de prova social
- `min-h-[100dvh]` (não `h-screen`)
- Zero em-dashes em copy visível
- Chaves PT + EN obrigatórias para todas as strings novas

---

### Task 1: Strings i18n

**Arquivos:**
- Modificar: `apps/web/src/i18n/locales/pt.json`
- Modificar: `apps/web/src/i18n/locales/en.json`

- [x] Adicionar `auth.brandManifesto`, títulos/corpos de benefícios (3), labels de confiança, títulos/subtítulos refinados para coluna do form
- [x] Manter chaves de campo/erro existentes inalteradas

### Task 2: Componente AuthShell

**Arquivos:**
- Criar: `apps/web/src/components/layout/auth-shell.tsx`
- Criar: `apps/web/src/components/layout/auth-shell.spec.tsx`

- [x] Implementar layout split + stack mobile
- [x] Props: `title`, `subtitle`, `children`
- [x] Painel de marca + faixa de confiança do i18n
- [x] Spec: renderiza título e texto de confiança

### Task 3: Conectar login + register

**Arquivos:**
- Modificar: `apps/web/src/pages/auth/login-page.tsx`
- Modificar: `apps/web/src/pages/auth/register-page.tsx`

- [x] Envolver forms em `AuthShell`
- [x] Remover chrome antigo de card centralizado
- [x] Preservar comportamento de submit/checkout

### Task 4: Verificação

- [x] `pnpm --filter @prospectly/web test`
- [x] `pnpm --filter @prospectly/web typecheck`
