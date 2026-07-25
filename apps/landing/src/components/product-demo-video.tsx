'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

type ProductDemoVideoProps = {
  locale: 'pt' | 'en';
  className?: string;
};

export function ProductDemoVideo({ locale, className }: ProductDemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reduceMotion) {
      video.pause();
      video.removeAttribute('autoplay');
      return;
    }

    void video.play().catch(() => {
      // Autoplay may be blocked; controls remain available.
    });
  }, [reduceMotion]);

  return (
    <div className={className}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        poster="/images/workflow-desk.jpg"
        playsInline
        muted
        loop
        autoPlay={!reduceMotion}
        preload="metadata"
        controls={Boolean(reduceMotion)}
        aria-label={
          locale === 'pt'
            ? 'Vídeo motion: como o Prospectly funciona'
            : 'Motion video: how Prospectly works'
        }
      >
        <source src="/videos/como-funciona.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
