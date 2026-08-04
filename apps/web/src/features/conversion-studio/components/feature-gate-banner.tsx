import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { useEntitlements } from '../hooks';

export function FeatureGateBanner({
  feature,
}: {
  feature: 'published_pages' | 'page_drafts' | 'custom_domain' | 'remove_prospectly_brand';
}) {
  const entitlements = useEntitlements();
  if (!entitlements.data) return null;

  const { usage, limits, plan } = entitlements.data;
  const blocked =
    (feature === 'published_pages' && usage.publishedPages >= limits.publishedPages) ||
    (feature === 'page_drafts' && usage.pageDrafts >= limits.pageDrafts) ||
    (feature === 'custom_domain' && !entitlements.data.features.custom_domain) ||
    (feature === 'remove_prospectly_brand' && !entitlements.data.features.remove_prospectly_brand);

  if (!blocked) return null;

  return (
    <Card>
      <CardContent className="space-y-2 p-4 text-sm text-zinc-300">
        <p className="font-medium text-zinc-50">Recurso limitado no plano {plan}</p>
        <p>
          Faça upgrade para continuar publicando páginas, remover a marca Prospectly ou usar domínio
          próprio. A navegação geral permanece disponível.
        </p>
        <Link to="/settings" className="inline-flex min-h-11 items-center text-brand-300 underline">
          Ver planos e uso
        </Link>
      </CardContent>
    </Card>
  );
}
