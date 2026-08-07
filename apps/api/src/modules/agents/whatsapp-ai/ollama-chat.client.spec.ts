import { OllamaChatClient } from './ollama-chat.client';

describe('OllamaChatClient', () => {
  const lead = {
    companyName: 'Acme',
    city: 'Recife',
    segment: 'Food',
    ownerName: 'Ana',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when disabled', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'whatsappAi.enabled') return false;
        return undefined;
      }),
    };
    const client = new OllamaChatClient(config as never);
    await expect(client.generateVariants(lead, 4)).resolves.toBeNull();
  });

  it('parses ollama JSON variants', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'whatsappAi.enabled') return true;
        if (key === 'whatsappAi.baseUrl') return 'http://127.0.0.1:11434';
        if (key === 'whatsappAi.model') return 'llama3.2';
        if (key === 'whatsappAi.timeoutMs') return 5000;
        return undefined;
      }),
    };

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            variants: [
              { angle: 'direto', body: 'Olá Acme direto' },
              { angle: 'curiosidade', body: 'Olá Acme curiosidade' },
              { angle: 'prova_social', body: 'Olá Acme prova' },
              { angle: 'dor_site', body: 'Olá Acme dor' },
            ],
          }),
        },
      }),
    } as Response);

    const client = new OllamaChatClient(config as never);
    const variants = await client.generateVariants(lead, 4);
    expect(variants).toHaveLength(4);
    expect(variants?.[0]?.body).toContain('direto');
  });

  it('returns null on fetch failure', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'whatsappAi.enabled') return true;
        if (key === 'whatsappAi.timeoutMs') return 100;
        return 'http://127.0.0.1:11434';
      }),
    };
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new OllamaChatClient(config as never);
    await expect(client.generateVariants(lead, 3)).resolves.toBeNull();
  });
});
