import { LandingNotFoundScreen } from '@/components/landing-route-status';
import { LANDING_ROUTE_STATUS } from '@/lib/landing-route-status';

export const metadata = {
  title: LANDING_ROUTE_STATUS.en.notFound.title,
  robots: { index: false, follow: false },
};

export default function EnNotFound() {
  return <LandingNotFoundScreen locale="en" chrome="panel" />;
}
