import React from 'react';

/**
 * Fallback estático CSS/SVG para quando WebGL estiver indisponível,
 * em prefers-reduced-motion e durante o SSR inicial.
 * Renderiza o anel do sinal e esferas com gradientes radiais idênticos ao 00-fundamentos.png.
 */
export function SignalHeroFallback() {
  return (
    <div
      className="relative flex items-center justify-center w-full h-full min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] select-none pointer-events-none"
      aria-hidden="true"
    >
      <svg
        className="w-full max-w-[480px] h-auto drop-shadow-[0_24px_48px_rgba(37,99,235,0.28)]"
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradiente do Anel Principal */}
          <linearGradient id="ringGrad" x1="80" y1="60" x2="420" y2="440" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4C8DFF" />
            <stop offset="40%" stopColor="#2563EB" />
            <stop offset="85%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#709AC0" />
          </linearGradient>

          {/* Gradiente da Esfera Azul */}
          <radialGradient id="blueSphereGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="25%" stopColor="#4C8DFF" />
            <stop offset="70%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#0B1220" />
          </radialGradient>

          {/* Gradiente da Esfera Lima */}
          <radialGradient id="limeSphereGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#F7FED2" />
            <stop offset="35%" stopColor="#D4F56A" />
            <stop offset="75%" stopColor="#A3E635" />
            <stop offset="100%" stopColor="#4D7C0F" />
          </radialGradient>

          {/* Gradiente da Esfera Sinal Claro */}
          <radialGradient id="paleSphereGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#B9D8EF" />
            <stop offset="80%" stopColor="#709AC0" />
            <stop offset="100%" stopColor="#3B82F6" />
          </radialGradient>

          {/* Brilho interno do anel */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Anel do Sinal de Oportunidade */}
        <circle
          cx="280"
          cy="230"
          r="150"
          stroke="url(#ringGrad)"
          strokeWidth="56"
          strokeLinecap="round"
          className="opacity-95"
        />
        {/* Realce interno do anel */}
        <circle
          cx="280"
          cy="230"
          r="174"
          stroke="#4C8DFF"
          strokeWidth="3"
          className="opacity-40"
        />

        {/* Esfera Lima (topo direito) */}
        <circle cx="430" cy="85" r="42" fill="url(#limeSphereGrad)" className="drop-shadow-lg" />

        {/* Esfera Sinal Claro (meio esquerda) */}
        <circle cx="160" cy="300" r="48" fill="url(#paleSphereGrad)" className="opacity-90 drop-shadow-md" />

        {/* Esfera Azul Grande (frente esquerda) */}
        <circle cx="130" cy="340" r="68" fill="url(#blueSphereGrad)" className="drop-shadow-2xl" />
      </svg>
    </div>
  );
}
