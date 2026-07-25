import { useGoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
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

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-.9 2.4-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2.1H12z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.3l-.7.5-2.3 1.8C4 19.4 7.7 21.5 12 21.5c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3z"
      />
      <path
        fill="#4A90E2"
        d="M3 7.5C2.4 8.7 2 10 2 11.5s.4 2.8 1 4l3.3-2.6c-.2-.6-.3-1.2-.3-1.4 0-.5.1-1 .3-1.5L3 7.5z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.5c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 2.5 14.7 1.5 12 1.5 7.7 1.5 4 3.6 2.3 7.1L5.6 9.7C6.4 7.2 9 5.5 12 5.5z"
      />
    </svg>
  );
}

function GoogleSignInButtonInner({
  onSuccess,
  onError,
  acceptTerms,
  organizationName,
  locale,
  disabled,
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    scope: 'openid email profile',
    onSuccess: async (tokenResponse) => {
      if (!tokenResponse.access_token) {
        onError?.(t('auth.googleError'));
        return;
      }

      setLoading(true);
      try {
        const response = await googleAuth({
          accessToken: tokenResponse.access_token,
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
    },
    onError: () => onError?.(t('auth.googleError')),
  });

  return (
    <div className="flex w-full flex-col items-stretch gap-3">
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {t('auth.orContinueWith')}
        </span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        loading={loading}
        disabled={disabled || loading}
        onClick={() => login()}
      >
        <GoogleMark className="h-5 w-5" />
        {t('auth.continueWithGoogle')}
      </Button>
    </div>
  );
}

export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    return null;
  }
  return <GoogleSignInButtonInner {...props} />;
}
