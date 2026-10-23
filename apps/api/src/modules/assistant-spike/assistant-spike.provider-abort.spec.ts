import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { OpenAiCompatibleClient } from '../ai/llm-provider/openai-compatible.client';
import { AiRequestAbortedException } from '../ai/llm-provider/llm-provider.types';

describe('Real Provider Fetch Abort Test (L6)', () => {
  let server: http.Server;
  let serverUrl: string;
  let serverObservedClose = false;
  let activeServerResponse: http.ServerResponse | null = null;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      activeServerResponse = res;
      serverObservedClose = false;

      // Monitor when the client abruptly closes/aborts the connection
      req.on('close', () => {
        serverObservedClose = true;
      });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Send the first chunk
      res.write(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"delta":{"content":"Olá "}}]}\n\n',
      );
      // Keep connection open without res.end() to simulate continuous streaming
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      serverUrl = `http://127.0.0.1:${addr.port}/v1`;
      done();
    });
  });

  afterAll((done) => {
    if (activeServerResponse && !activeServerResponse.writableEnded) {
      activeServerResponse.end();
    }
    server.close(done);
  });

  it('real OpenAiCompatibleClient fetch propagates AbortSignal to underlying HTTP connection (<500 ms)', async () => {
    const client = new OpenAiCompatibleClient();
    const abortController = new AbortController();

    const stream = client.stream({
      baseUrl: serverUrl,
      apiKey: 'test-fake-key',
      model: 'test-model',
      messages: [{ role: 'user', content: 'Iniciar stream' }],
      signal: abortController.signal,
      timeoutMs: 5000,
    });
    const iterator = stream[Symbol.asyncIterator]();

    // 1. Consume the first delta from the real HTTP stream
    const firstChunk = await iterator.next();
    expect(firstChunk.done).toBe(false);
    expect(firstChunk.value?.contentDelta).toBe('Olá ');

    const abortStart = Date.now();

    // 2. Client triggers abort
    abortController.abort();

    // 3. Generator must terminate with AiRequestAbortedException
    await expect(iterator.next()).rejects.toThrow(AiRequestAbortedException);

    // 4. Poll until the local fake HTTP server observes the TCP connection closure
    const pollIntervalMs = 20;
    const maxWaitMs = 500;
    let elapsed = 0;

    while (!serverObservedClose && elapsed < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      elapsed = Date.now() - abortStart;
    }

    // Must be observed within 500 ms
    expect(serverObservedClose).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });
});
