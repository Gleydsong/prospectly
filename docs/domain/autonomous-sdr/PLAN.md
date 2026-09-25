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

## PR decisões Jev

O parser aceita só os formatos instalados em `memory_shared.jev.models`: `noul`, `choice` e `score`. Não chama o gateway.

- `opportunity-score-v1` combina os sinais em código. A nota do exemplo qualificado é 56.
- `QUALIFIED` exige nota >= 55, ICP >= 50 e contactability >= 50.
- Provider indisponível, tipo desconhecido ou strategy fora da allowlist devolve `REJECTED` e nota nula.
- O texto do prospect fica no log como dado. Não altera a nota.
- O log de outra organização não devolve a decisão.

## PR research

Só um prospect `QUALIFIED` com evidência viva entra. Cada observação cita o id da evidência. O texto externo não escolhe o ângulo nem entra no gancho.

A rota autenticada `/sdr/research` mostra o bloqueio enquanto não há brief qualificado. O menu lateral ganha o item SDR. A tela pronta recebe o brief já decidido pelo domínio.

## PR mensagens

`composeSdrMessage` valida strategy, CTA, tom e claims. Claim sem evidência do brief devolve `BLOCK` e `unsupported_claim`. Falha do gerador devolve `BLOCK` e `generator_unavailable`, sem texto substituto. O texto externo não entra no corpo nem é enviado ao gerador.

## PR policy

`authorizeSdrSend` revalida na hora do efeito. Suppression devolve `BLOCK` antes de qualquer outra regra. Campanha pausada, limite diário e duplicata também bloqueiam. Fora do horário comercial, um envio que seria `ALLOW` vira `REQUIRE_APPROVAL`. A flag `autonomousSending` continua obrigatória.

## PR outreach

`OutreachGateway` só chama `FakeOutreachProvider` depois de `ALLOW`. Cem execuções da mesma mensagem produzem uma entrega e um evento `prospect.contacted`. Campanha pausada não chama o provider. O outbox é memória de processo.

## PR conversa

`ConversationInbox` exige o segredo do webhook antes de gravar. O mesmo `eventId` cem vezes produz uma mensagem. `stop` vira `OPT_OUT` e `NOT_INTERESTED`, mesmo se o Choice do modelo disser `INTERESTED`. Essa supressão bloqueia o envio na policy. O corpo fica armazenado como texto.

## PR follow-up

`FollowUpScheduler` cancela se já existe resposta ou supressão. Sem a flag `autonomousFollowup`, antes do intervalo, ou com provider doente, não chama o provider. A mesma mensagem, repetida, gera uma entrega falsa.

## PR memória

`SdrMemoryProjection` reconstrói organização, campanha, prospect e conversa a partir dos registros recebidos. `rebuild` apaga a projeção anterior. Outra organização não lê a campanha nem a conversa. O texto da resposta entra em `untrustedReply`. A projeção não é a fonte da verdade.

## PR observabilidade

`SdrAuditLog` exige `traceId` e soma métricas por organização. Outra organização não lê o registro. Texto com `Bearer` ou `secret` é recusado e não entra no log.

## Fora deste PR

Schema, campanha SDR, evidência, discovery, enrichment, Jev, research, mensagens, policy de envio, outreach, conversa persistida, follow-up worker, memória, observabilidade, UI, E2E.

## Branches

`main` → `feat/autonomous-sdr` (integração) → `feat/sdr-foundation` (este PR). PRs filhos apontam para `feat/autonomous-sdr`. Sem merge para `main`.

## Riscos

A máquina de estados ainda não cobre todo fechamento (`→ CLOSED`) fora de `MEETING_BOOKED`. Flags ainda não estão em `OrganizationFlag`. O model `Campaign` atual não deve ser reutilizado como control plane sem um agregado separado.
