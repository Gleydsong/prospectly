# Custom fields

O contexto de Custom Fields guarda as definições da organização de dados tipados no cliente potencial, e os valores desses dados no Lead.

## Language

**Campo personalizado**:
Definição da organização de um dado tipado no cliente potencial.
_Avoid_: Atributo, Property, Custom object, Extra, Metadata

**Definição**:
O schema do campo (nome, tipo, posição, opções, arquivo).
_Avoid_: Coluna Prisma, EAV row, Property type

**Valor**:
O dado no Lead para uma definição, ausente quando a chave não existe.
_Avoid_: Default, placeholder, notes
