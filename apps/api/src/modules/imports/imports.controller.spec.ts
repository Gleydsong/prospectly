import { ImportsController } from './imports.controller';

describe('ImportsController', () => {
  const file = {
    originalname: 'leads.csv',
    buffer: Buffer.from('Empresa\nAcme Ltda'),
    size: 21,
    mimetype: 'text/csv',
  };

  it('delegates a preview without creating an import', () => {
    const imports = { preview: jest.fn().mockReturnValue({ headers: ['Empresa'] }) };
    const controller = new ImportsController(imports as never);

    expect(controller.preview(file)).toEqual({ headers: ['Empresa'] });
    expect(imports.preview).toHaveBeenCalledWith('leads.csv', file.buffer);
  });

  it('creates a queued import from the authenticated organization and user', () => {
    const imports = { createFromFile: jest.fn().mockResolvedValue({ id: 'import-1' }) };
    const controller = new ImportsController(imports as never);

    void expect(
      controller.create('org-1', { id: 'user-1' } as never, file, { mapping: { companyName: 'Empresa' } }),
    ).resolves.toEqual({ id: 'import-1' });
    expect(imports.createFromFile).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'leads.csv',
      file.buffer,
      { companyName: 'Empresa' },
      undefined,
    );
  });
});
