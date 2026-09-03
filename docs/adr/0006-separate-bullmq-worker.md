---
status: accepted
---

# API HTTP e worker BullMQ são processos distintos

O processo HTTP (`prospectly-api`) produz jobs e reconcilia dispatch. O consumo BullMQ vive no Background Worker `prospectly-worker`. PostgreSQL continua fonte da verdade; Redis só transporta jobs recuperáveis. O Blueprint `render.yaml` não é a fonte operacional: produção tem Redis free, landing free e API Node, enquanto o YAML declara planos starter/docker. Provisionar o worker é operação dirigida, não sync do Blueprint.

## Opções consideradas

- Manter processors inline na API foi rejeitado: escala HTTP e filas juntas, e o spin da API mata o consumo.
- Sync do Blueprint inteiro foi rejeitado: converteria Redis/landing/DB além do único worker Starter autorizado (US$7/mês).
- Runtime Docker no worker foi rejeitado neste corte: a API live é Node (`node apps/api/dist/main.js`). O worker replica esse runtime (`node apps/api/dist/worker.js`).
