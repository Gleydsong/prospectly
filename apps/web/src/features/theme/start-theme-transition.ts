const REVEAL_MS = 720;

type TransitionPoint = { x: number; y: number };

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function supportsViewTransition(): boolean {
  return typeof document.startViewTransition === 'function';
}

function setRevealOrigin(point: TransitionPoint): void {
  const { innerWidth: w, innerHeight: h } = window;
  const maxRadius = Math.hypot(Math.max(point.x, w - point.x), Math.max(point.y, h - point.y));
  const root = document.documentElement;
  root.style.setProperty('--theme-x', `${point.x}px`);
  root.style.setProperty('--theme-y', `${point.y}px`);
  root.style.setProperty('--theme-r', `${Math.ceil(maxRadius)}px`);
  root.style.setProperty('--theme-reveal-ms', `${REVEAL_MS}ms`);
}

/**
 * Aplica troca de tema com reveal líquido (clip-path circular a partir do toggle),
 * igual ao padrão do vídeo de referência (~720ms). Fallback: troca instantânea.
 */
export async function startThemeTransition(
  point: TransitionPoint | null,
  apply: () => void,
): Promise<void> {
  if (!point || prefersReducedMotion() || !supportsViewTransition()) {
    apply();
    return;
  }

  setRevealOrigin(point);
  document.documentElement.classList.add('theme-revealing');

  try {
    const transition = document.startViewTransition!(() => {
      apply();
    });
    await transition.finished;
  } catch {
    apply();
  } finally {
    document.documentElement.classList.remove('theme-revealing');
  }
}

export { REVEAL_MS as THEME_REVEAL_MS };
