import { TopNav } from './top-nav';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return <TopNav onOpenNav={onMenuClick} navOpen={false} />;
}
