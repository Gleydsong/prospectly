import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { resendVerification } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function EmailVerificationBanner() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const verified = Boolean(user?.emailVerifiedAt);

  const resend = useMutation({
    mutationFn: resendVerification,
  });

  if (!user || verified) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Mail className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <p className="min-w-0 flex-1">
          {t('auth.verifyBanner', { email: user.email })}{' '}
          <Link to="/settings#email" className="underline underline-offset-2 hover:text-white">
            {t('auth.verifyBannerLink')}
          </Link>
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {resend.isSuccess ? t('auth.verifyResent') : t('auth.verifyResend')}
        </Button>
        {resend.isError ? (
          <span className="text-xs text-red-300" role="alert">
            {getApiErrorMessage(resend.error)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
