import { LandingNotFoundScreen } from '@/components/landing-route-status';
import { LANDING_ROUTE_STATUS } from '@/lib/landing-route-status';

export const metadata = {
  title: LANDING_ROUTE_STATUS.pt.notFound.title,
  robots: { index: false, follow: false },
};

export default function PtNotFound() {
  return <LandingNotFoundScreen locale="pt" chrome="v2" />;
}
