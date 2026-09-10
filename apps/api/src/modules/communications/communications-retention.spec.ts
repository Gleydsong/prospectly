import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

const syncedCommunicationModel = schema.match(/model SyncedCommunication \{[\s\S]*?\n\}/)?.[0] ?? '';

describe('Comunicação sincronizada retention', () => {
  it('hard-deletes Casamentos with the Lead and keeps them when the Conexão Google is removed', () => {
    expect(syncedCommunicationModel).toContain(
      'lead                 Lead              @relation(fields: [leadId], references: [id], onDelete: Cascade)',
    );
    expect(syncedCommunicationModel).toContain(
      'ingestedByConnection GoogleConnection? @relation(fields: [ingestedByConnectionId], references: [id], onDelete: SetNull)',
    );
    expect(syncedCommunicationModel).not.toContain('retainUntil');
  });
});
