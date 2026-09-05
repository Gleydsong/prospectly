# Views

O contexto de Views guarda listas inteligentes da organização: uma definição nomeada de filtros sobre clientes potenciais, reutilizável pela equipa.

## Language

**Vista salva**:
Uma consulta nomeada e persistida sobre clientes potenciais da organização, com dono e visibilidade.
_Avoid_: Segmento, SmartList, Attio View, Search

**Definição**:
O conjunto allowlisted de filtros, ordenação e apresentação (layout tabela/Kanban e colunas) que a Vista aplica. Pode ser um mapa plano ou um AST allowlisted (`and`/`or` + folhas). Não é SQL nem JSONPath.
_Avoid_: Query string, AST livre, filtro de cliente

**Visibilidade privada**:
A Vista visível só ao dono.
_Avoid_: Hidden, draft

**Visibilidade da equipa**:
A Vista visível a qualquer membro da organização.
_Avoid_: Pública, global, partilhada com outra organização
