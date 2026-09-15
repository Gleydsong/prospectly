# Professional persona + Website do Lead

O contexto guarda a **persona profissional** da organização e do membro, e o **Website do Lead** (inventário de URLs). Não cria Client. Não altera o Website de análise 1:1.

## Language

**Persona profissional**:
Papel de mercado do membro na organização: molda defaults de UI, não permissões.
_Avoid_: Role, plano, job title livre, ICP

**Persona default da organização**:
Valor no tenant, escolhido no signup.
_Avoid_: Persona global da conta Google

**Override de persona**:
Valor no **membro** (não no User global): esta org, este user. `null` = segue o default da org.
_Avoid_: Override no User (parte orgs)

**Persona efetiva**:
`override ?? default da org`. Calculada no servidor.
_Avoid_: “tipo de conta”

**Lead**:
Empresa prospectada ou cliente ganho. Unidade comercial.
_Avoid_: Client, Customer, Account (CRM)

**Website do Lead**:
Ativo URL ligado a um Lead (`LeadWebsite`). 0..N por Lead.
_Avoid_: Site da Organization tenant, custom object, Campo personalizado, model Prisma `Website` (análise 1:1)

**Ganhos**:
Estágio / status won já existentes. Destaca a ficha; não destrava o módulo.
_Avoid_: Conversão para outra entidade

**Módulo**:
Capacidade opcional sobre o Lead (v1: Website).
_Avoid_: Produto vertical separado, Organization flag de capability

## Invariants

- Sem tabela Client / Customer / Account.
- Override vive em OrganizationMember, nunca em User.
- Persona não é Role e não esconde Busca, Pipeline, WhatsApp, OSM ou Places.
- VIEWER lê; não muta default, override nem LeadWebsite.
- URL duplicada no mesmo Lead (`leadId` + `urlNormalized`) → 409.
- API de Website disponível em qualquer estágio; UI enfatiza depois de Ganhos.
- Análise `Website` (1:1) permanece intocada.
