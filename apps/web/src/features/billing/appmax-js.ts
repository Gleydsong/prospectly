type AppmaxToken = { ip?: string; token?: string };

declare global {
  interface Window {
    AppmaxScripts?: {
      init(
        onSuccess: (result: AppmaxToken) => void,
        onError: (error: unknown) => void,
        externalId: string,
      ): void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadAppmaxJs(scriptUrl: string): Promise<void> {
  if (window.AppmaxScripts) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    const script = existing ?? document.createElement('script');
    const done = () =>
      window.AppmaxScripts ? resolve() : reject(new Error('Appmax JS unavailable'));
    script.addEventListener('load', done, { once: true });
    script.addEventListener(
      'error',
      () => {
        scriptPromise = null;
        reject(new Error('Failed to load Appmax JS'));
      },
      { once: true },
    );
    if (!existing) {
      script.src = scriptUrl;
      script.async = true;
      script.dataset.paymentProvider = 'appmax';
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export async function tokenizeWithAppmax(
  externalId: string,
  scriptUrl: string,
): Promise<{ ip: string; token: string }> {
  await loadAppmaxJs(scriptUrl);
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('Appmax tokenization timed out')),
      20_000,
    );
    window.AppmaxScripts!.init(
      (result) => {
        window.clearTimeout(timeout);
        if (!result.ip || !result.token) {
          reject(new Error('Appmax did not return token and IP'));
          return;
        }
        resolve({ ip: result.ip, token: result.token });
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error('Card tokenization failed'));
      },
      externalId,
    );
  });
}
