import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { googleAuth, type AuthResponse } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';

type GoogleSignInButtonProps = {
  onSuccess: (response: AuthResponse) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Required for first-time Google signup (register page). */
  acceptTerms?: boolean;
  organizationName?: string;
  locale?: 'pt' | 'en';
  disabled?: boolean;
};

export function GoogleSignInButton({
  onSuccess,
  onError,
  acceptTerms,
  organizationName,
  locale,
  disabled,
}: GoogleSignInButtonProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [buttonWidth, setButtonWidth] = useState(320);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      // GIS requires a numeric pixel width — "100%" renders an empty button.
      const next = Math.min(400, Math.max(240, Math.floor(el.getBoundingClientRect().width)));
      setButtonWidth(next);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!clientId) {
    return null;
  }

  const handleCredential = async (credentialResponse: CredentialResponse) => {
    if (disabled || loading) return;
    const idToken = credentialResponse.credential;
    if (!idToken) {
      onError?.(t('auth.googleError'));
      return;
    }

    setLoading(true);
    try {
      const response = await googleAuth({
        idToken,
        ...(acceptTerms ? { acceptTerms: true as const } : {}),
        ...(organizationName?.trim() ? { organizationName: organizationName.trim() } : {}),
        ...(locale ? { locale } : {}),
      });
      await onSuccess(response);
    } catch (error) {
      onError?.(getApiErrorMessage(error) || t('auth.googleError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex w-full flex-col items-stretch gap-3 ${disabled || loading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {t('auth.orContinueWith')}
        </span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
      <div ref={containerRef} className="flex min-h-11 w-full justify-center overflow-hidden">
        <GoogleLogin
          key={buttonWidth}
          onSuccess={(cred) => void handleCredential(cred)}
          onError={() => onError?.(t('auth.googleError'))}
          useOneTap={false}
          theme="outline"
          size="large"
          shape="rectangular"
          text="continue_with"
          locale={i18n.language?.startsWith('en') ? 'en' : 'pt-BR'}
          width={String(buttonWidth)}
        />
      </div>
    </div>
  );
}
