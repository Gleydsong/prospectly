# Decisão Técnica: Substituição do Juiz Jev pela Laya no SDR Autônomo

**Data:** 2026-10-21  
**Status:** Aprovada  
**Decisão:** Opção B — Sidecar `laya[serve]` via Docker  
**Contexto:** Issue #398 (`Gleydsong/prospectly`)  

---

## 1. Contexto do Problema

O SDR autônomo do Prospectly utilizava o serviço comercial Jev (TypeSafe, `https://api.typesafe.ai/v1/systemone`) para qualificar clientes antes da redação e contato comercial. Isso incorria em custo por token/chamada e transmissão de metadados de clientes para infraestrutura externa de terceiros.

A decisão aprovada substitui o Jev pelo **Laya** (NandhaKishorM/laya, Apache 2.0), motor de decisão System 1 não-autoregressivo de única passagem direta, auto-hospedado na VPS Hostinger KVM 2 (2 vCPU, 8 GB RAM para toda a stack).

---

## 2. Opções Avaliadas

### Opção A: `laya-ts` / `@receptron/laya` em processo (Node.js via ONNX Runtime)
- Execução direta no processo da API e do Worker NestJS via Node.js.
- Dependência de bindings C++ nativos (`onnxruntime-node`, `@huggingface/tokenizers`).
- Checkpoint ONNX descompactado de ~1,7 GB baixado de repositório não oficial (`receptron/laya-onnx`).

### Opção B: Sidecar `laya[serve]` (HTTP, Docker)
- Serviço dedicado executando o servidor oficial Laya com protocolo wire `/v1/systemone` compatível com Jev.
- Suporte nativo a safetensors PyTorch (checkpoint oficial `convaiinnovations/laya` variante `multilingual`).
- Comunicação interna via rede Docker com healthcheck `/health`.

---

## 3. Medições Comparativas

Os testes e medições foram executados em CPU (2 threads intra-op) com o conjunto completo de 9 perguntas do SDR em português brasileiro (cenário real com cliente `Oficina Mecânica São José`):

| Métrica | Opção A (`laya-ts` / ONNX em processo) | Opção B (`laya[serve]` Sidecar Docker) |
| :--- | :--- | :--- |
| **Tamanho do Checkpoint** | ~1,7 GB (ONNX FP32 descompactado) | **~614 MB** (`model.safetensors` multilingual) |
| **Uso de RAM (In-Memory)** | ~2,0 GB a 2,5 GB **por processo Node** (duplicado entre API e Worker) | **~2,5 GB** (compartilhado em um único container) |
| **Latência p50 em CPU** | ~380 ms | **366,3 ms** |
| **Latência p95 em CPU** | ~410 ms | **377,0 ms** |
| **Latência Mínima** | ~360 ms | **357,0 ms** |
| **Cold Start / Carga** | ~12–15s a cada inicialização da API Node | ~10,6s isolado no container na subida |
| **Maturidade da Lib** | Baixa (`laya-ts` não publicado oficialmente; `@receptron/laya` v0.2.0 recente) | **Alta** (servidor oficial mantido pelo autor da Laya) |
| **Isolamento de Falha** | Baixo: falha nativa ONNX/OOM derruba o processo da API NestJS | **Alto**: processo isolado com healthcheck e reinicialização automática |
| **Compatibilidade Jev** | Requer reimplementação e validação de tokenização | Protocolo nativo `POST /v1/systemone`, sem flag de compatibilidade |

### Evidência de Inferência em Português (Opção B)
```json
{
  "icpFit": { "type": "score", "score": 1.1549, "legend": {"0": "none", "1": "partial", "2": "full"} },
  "websiteNeed": { "type": "noul", "noul": 1.0 },
  "businessActivity": { "type": "noul", "noul": 1.0 },
  "commercialOpportunity": { "type": "score", "score": 1.1182, "legend": {"0": "none", "1": "partial", "2": "full"} },
  "contactability": { "type": "noul", "noul": 1.0 },
  "buyingSignals": { "type": "noul", "noul": 0.9969 },
  "risk": { "type": "score", "score": 1.2135, "legend": {"0": "none", "1": "partial", "2": "full"} },
  "strategy": { "type": "choice", "choice": "website_problem", "confidence": 0.9842 },
  "intent": { "type": "choice", "choice": "OPT_OUT", "confidence": 0.2788 }
}
```

---

## 4. Justificativa da Escolha (Opção B)

1. **Eficiência de Memória na VPS (2 vCPU, 8 GB)**:
   A VPS Hostinger abriga Postgres, Redis, API NestJS, Worker BullMQ e frontends. A Opção A consumiria mais de 4 GB só para carregar o modelo em duplicidade nos processos Node.js da API e do Worker. A Opção B roda em container único com limite de memória (~2,5 GB), atendendo com segurança o orçamento de recursos da VPS.
2. **Sem Dependências Nativas no Node**:
   Manter a API NestJS sem `onnxruntime-node` evita incompatibilidades de build em arquiteturas heterogêneas (desenvolvimento macOS ARM64 vs VPS Linux x86_64).
3. **Resiliência e Fail-Closed**:
   A separação de processos garante que problemas de memória ou timeouts no modelo Laya não interrompam a API web. Falhas de conexão com o sidecar resultam em fail-closed imediato.
4. **Alinhamento com a Issue #383 (Hostinger)**:
   A decisão #383 removeu LLMs generativos pesados (como Ollama 7-8B de 5–6 GB). A Laya se enquadra como um modelo System 1 não-autoregressivo de classificação rápida e leve, perfeito para rodar como sidecar local, enquanto a redação generativa continua delegada à Cloudflare Workers AI / Groq.

---

## 5. Implementação no Prospectly

- **Interface Neutra**: Criação de `SdrDecisionProvider` substituindo a interface legada.
- **Cliente Laya**: `SdrLayaClient` implementando chamadas HTTP para `LAYA_URL` com controle de timeout por `AbortController`.
- **Mapeamento de Scores**: Normalização das notas de pontuação ordinal de `[0, max_level]` para o intervalo unitário `[0, 1]` esperado pelo `opportunityScoreV1`.
- **Terminologia Estrita**: Uso consistente de `cliente` (nunca `lead`) na interface e no contrato do SDR.
- **Fail-Closed e DNC**: Clientes na lista DNC (Do Not Contact) são bloqueados antes de qualquer invocação da Laya. Qualquer erro, resposta malformada ou timeout classifica o cliente como não apto (`REJECTED`), com nota nula.
- **Docker Compose**: Adicionado o serviço `laya` com healthcheck `GET /health` e documentação de integração.
