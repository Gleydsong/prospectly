import { PtSiteChrome } from '@/components/pt-site-chrome';

export default function PtLayout({ children }: { children: React.ReactNode }) {
  return <PtSiteChrome locale="pt">{children}</PtSiteChrome>;
}
