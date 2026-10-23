import {
  CheckSquare,
  Home,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: string;
  icon?: LucideIcon;
}

/** Itens do Espaço de Trabalho (Workspace) segundo o redesign (02-app-inicio.png). */
export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.principal', icon: Home },
  { to: '/prospectar', labelKey: 'nav.prospectar', icon: Search },
  { to: '/clientes', labelKey: 'nav.clientes', icon: Users },
  { to: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

/** Itens de Ferramentas (Tools) da sidebar (02-app-inicio.png). */
export const TOOLS_NAV_ITEMS: NavItem[] = [
  { to: '/clientes/listas', labelKey: 'nav.campaigns' },
  { to: '/workflows', labelKey: 'nav.workflows' },
  { to: '/?aba=relatorios', labelKey: 'nav.reports' },
  { to: '/agents', labelKey: 'nav.agents' },
  { to: '/sdr', labelKey: 'nav.sdr' },
];

export const ROUTE_TITLES: Array<{ pattern: RegExp; labelKey: string }> = [
  { pattern: /^\/$/, labelKey: 'nav.principal' },
  { pattern: /^\/prospectar/, labelKey: 'nav.prospectar' },
  { pattern: /^\/clientes\/listas/, labelKey: 'nav.campaigns' },
  { pattern: /^\/clientes/, labelKey: 'nav.clientes' },
  { pattern: /^\/search/, labelKey: 'nav.search' },
  { pattern: /^\/imports/, labelKey: 'nav.imports' },
  { pattern: /^\/leads/, labelKey: 'nav.clientes' },
  { pattern: /^\/pipeline/, labelKey: 'nav.pipeline' },
  { pattern: /^\/tools/, labelKey: 'nav.ferramentas' },
  { pattern: /^\/custom-fields/, labelKey: 'customFields.title' },
  { pattern: /^\/support/, labelKey: 'nav.suporte' },
  { pattern: /^\/agents\/crm/, labelKey: 'agents.crm.title' },
  { pattern: /^\/agents\/whatsapp/, labelKey: 'agents.whatsapp.title' },
  { pattern: /^\/agents/, labelKey: 'nav.agents' },
  { pattern: /^\/campaigns/, labelKey: 'nav.campaigns' },
  { pattern: /^\/sdr\/research/, labelKey: 'nav.sdr' },
  { pattern: /^\/sdr$/, labelKey: 'nav.sdr' },
  { pattern: /^\/workflows/, labelKey: 'nav.workflows' },
  { pattern: /^\/reports/, labelKey: 'nav.reports' },
  { pattern: /^\/tasks/, labelKey: 'nav.tasks' },
  { pattern: /^\/settings/, labelKey: 'nav.settings' },
];

export function routeTitleKey(pathname: string, search = ''): string | undefined {
  const searchParams = new URLSearchParams(search);
  if (pathname === '/' && searchParams.get('aba') === 'relatorios') {
    return 'nav.reports';
  }
  return ROUTE_TITLES.find((entry) => entry.pattern.test(pathname))?.labelKey;
}

export function isNavItemActive(to: string, pathname: string, search = ''): boolean {
  const [targetPath, targetQuery] = to.split('?');
  const searchParams = new URLSearchParams(search);

  if (targetQuery) {
    const targetParams = new URLSearchParams(targetQuery);
    if (pathname !== targetPath) return false;
    for (const [key, value] of targetParams.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  if (to === '/') {
    return pathname === '/' && searchParams.get('aba') !== 'relatorios';
  }

  if (to === '/clientes') {
    return (
      (pathname === '/clientes' || pathname.startsWith('/clientes/')) &&
      !pathname.startsWith('/clientes/listas')
    );
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}
