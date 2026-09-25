# Autonomous SDR — plano de implementação

Plano vivo. Este documento descreve o alvo e o que o PR de fundação realmente entrega.

## Arquitetura atual

Monólito modular NestJS (`apps/api`), SPA React/Vite (`apps/web`), landing Next.js. PostgreSQL via Prisma é a fonte de verdade. Redis + BullMQ executam jobs. Tenant é `organizationId` da sessão JWT, com RLS. Campanha existente é CRM assistido (`Campaign`, `CampaignLead`). Agents proíbe disparo automático de WhatsApp e trata DNC como absoluto. Não há cliente Jev no repositório.

## Arquitetura alvo

O SDR entra como módulo de domínio no mesmo monólito, com workers e outbox já existentes. Jev julga. LLM redige. Código decide transições e score. Policy autoriza. PostgreSQL guarda o que aconteceu. Envio real não existe neste ciclo: provider falso, flags de autonomia desligadas.

## Este PR (foundation)

Seam público, sem migration e sem I/O:

- `defaultAutonomyFlags` / `isAutonomyActionEnabled` — seis flags, default `false`, chave ausente ou desconhecida falha fechado.
- `assertProspectTransition` — arestas explícitas; estado desconhecido ou salto ilegal lança `InvalidProspectTransitionError`.

## PR campanha

Agregado separado do `Campaign` do CRM, ainda sem migration:

- `createSdrCampaign` exige ICP estruturado, organização e oferta. Texto livre é rejeitado.
- WhatsApp com autonomia `AUTONOMOUS` é rejeitado.
- `assertSdrCampaignTransition` só permite DRAFT → ACTIVE → PAUSED/COMPLETED.
- `sdrCampaignOutreach` devolve ALLOW só com campanha ACTIVE, canal sem WhatsApp, autonomia AUTONOMOUS e flag `autonomousSending` ligada. Caso contrário BLOCK ou REQUIRE_APPROVAL.

## PR evidência

Ledger em memória, ainda sem tabela Prisma:

- `record` exige organização, prospect, campo, valor textual e `https`.
- `observe` só existe se citar evidência da mesma organização e do mesmo prospect.
- `assess` devolve `SUPPORTED` só com evidência viva. Sem id, expirada, de outra organização ou de outro prospect devolve `BLOCK`.
- Texto externo, inclusive instrução de prompt, fica armazenado como valor. Não cria um id nem autoriza envio.

## PR discovery

Contrato e provider falso, sem OSM, Google Places ou fila BullMQ:

- `discoverProspects` devolve fatos. Não calcula score nem qualifica.
- Resultado de outra organização é descartado.
- Duplicata pelo host do site colapsa num prospect.
- `discoveryJobId` é estável para a mesma organização e os mesmos filtros.
- Critério com chave desconhecida, como `qualify`, é rejeitado.

## PR enrichment

Sinais fictícios de site viram evidência. Não há fetch HTTP.

- `FakeWebsiteEnrichmentProvider` só conhece `https://oficina-alfa.example`.
- `enrichDiscoveredProspect` grava categoria pública e sinais `ssl`, `mobile` e `pageText` no ledger.
- A segunda execução reutiliza os mesmos ids.
- Prospect sem `https` não chama o provider.
- O texto da página fica em `value`. Não há campo de qualificação.

## Fora deste PR

Schema, campanha SDR, evidência, discovery, enrichment, Jev, research, mensagens, policy de envio, outreach, conversa persistida, follow-up worker, memória, observabilidade, UI, E2E.

## Branches

`main` → `feat/autonomous-sdr` (integração) → `feat/sdr-foundation` (este PR). PRs filhos apontam para `feat/autonomous-sdr`. Sem merge para `main`.

## Riscos

A máquina de estados ainda não cobre todo fechamento (`→ CLOSED`) fora de `MEETING_BOOKED`. Flags ainda não estão em `OrganizationFlag`. O model `Campaign` atual não deve ser reutilizado como control plane sem um agregado separado.
