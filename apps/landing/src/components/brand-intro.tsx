'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';

const INTRO_SESSION_KEY = 'prospectly-brand-intro-seen';
const LOGO_SRC = '/brand/prospectly-mark-v2.svg';

function markLandingIntroComplete() {
  document.querySelector('.landing-v2')?.setAttribute('data-brand-intro-state', 'complete');
}

export function BrandIntro() {
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();
  const completedRef = useRef(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    const finish = () => {
      if (cancelled || completedRef.current) return;
      completedRef.current = true;
      sessionStorage.setItem(INTRO_SESSION_KEY, 'true');
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      setVisible(false);
      markLandingIntroComplete();
    };

    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isPageReload = navigationEntry?.type === 'reload';
    const alreadySeen = sessionStorage.getItem(INTRO_SESSION_KEY) === 'true' && !isPageReload;
    if (alreadySeen) {
      finish();
      return () => { cancelled = true; };
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const run = async () => {
      const logo = new window.Image();
      logo.src = LOGO_SRC;
      try {
        if (logo.decode) await logo.decode();
      } catch {
        // A decoded SVG is preferred, but the visible img remains the fallback.
      }
      if (cancelled) return;

      if (reducedMotion) {
        await controls.start({ opacity: 0, transition: { duration: 0.18, ease: 'easeOut' } });
        finish();
        return;
      }

      // Mantém o frame final com uma mudança mínima para que o Promise do Motion
      // represente o hold completo da timeline, sem depender de timer artificial.
      await controls.start({ opacity: 0.99, transition: { duration: 3.75, ease: 'linear' } });
      if (cancelled) return;
      await controls.start({ opacity: 0, transition: { duration: 0.45, ease: 'easeIn' } });
      finish();
    };

    void run();
    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [controls, reducedMotion]);

  if (!visible) return null;

  return (
    <motion.div
      data-brand-intro
      className="brand-intro"
      initial={{ opacity: 1 }}
      animate={controls}
      aria-hidden="true"
    >
      <div className="brand-intro-aura" />
      <div className="brand-intro-sweep" />
      <div className="brand-intro-lockup">
        <motion.div
          className="brand-intro-mark-wrap"
          initial={{ opacity: 0, scale: 0.92, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.72, delay: 0.22, ease: [0.2, 0.75, 0.3, 1] }}
        >
          <span className="brand-intro-depth" />
          <Image className="brand-intro-mark" src={LOGO_SRC} alt="" width={128} height={128} priority />
        </motion.div>
        <motion.span
          className="brand-intro-wordmark"
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.78, delay: 0.78, ease: [0.2, 0.75, 0.3, 1] }}
        >
          rospectly
        </motion.span>
      </div>
    </motion.div>
  );
}
