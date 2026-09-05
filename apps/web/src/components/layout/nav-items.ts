import {
  Bot,
  CheckSquare,
  FileUp,
  Headphones,
  Home,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  Search,
  Settings,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

/** Nav horizontal estilo Facilitey (Principal / Clientes / Conversas / Ferramentas / Suporte). */
export const TOP_NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.principal', icon: Home },
  { to: '/leads', labelKey: 'nav.clientes', icon: Users },
  { to: '/agents', labelKey: 'nav.conversas', icon: Bot },
  { to: '/tools', labelKey: 'nav.ferramentas', icon: Wrench },
  { to: '/support', labelKey: 'nav.suporte', icon: Headphones },
];

/**
 * Itens secundários (menu mobile / ferramentas) — fluxo completo do produto.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.groupOverview',
    items: [{ to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard }],
  },
  {
    labelKey: 'nav.groupDiscover',
    items: [
      { to: '/search', labelKey: 'nav.search', icon: Search },
      { to: '/imports', labelKey: 'nav.imports', icon: FileUp },
    ],
  },
  {
    labelKey: 'nav.groupQualify',
    items: [
      { to: '/leads', labelKey: 'nav.leads', icon: Users },
      { to: '/pipeline', labelKey: 'nav.pipeline', icon: KanbanSquare },
    ],
  },
  {
    labelKey: 'nav.groupConvert',
    items: [
      { to: '/agents', labelKey: 'nav.agents', icon: Bot },
      { to: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone },
      { to: '/workflows', labelKey: 'nav.workflows', icon: Workflow },
      { to: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
    ],
  },
  {
    labelKey: 'nav.groupAccount',
    items: [{ to: '/settings', labelKey: 'nav.settings', icon: Settings }],
  },
];

export const ROUTE_TITLES: Array<{ pattern: RegExp; labelKey: string }> = [
  { pattern: /^\/$/, labelKey: 'nav.principal' },
  { pattern: /^\/search/, labelKey: 'nav.search' },
  { pattern: /^\/imports/, labelKey: 'nav.imports' },
  { pattern: /^\/leads/, labelKey: 'nav.clientes' },
  { pattern: /^\/pipeline/, labelKey: 'nav.pipeline' },
  { pattern: /^\/tools/, labelKey: 'nav.ferramentas' },
  { pattern: /^\/support/, labelKey: 'nav.suporte' },
  { pattern: /^\/agents\/crm/, labelKey: 'agents.crm.title' },
  { pattern: /^\/agents\/whatsapp/, labelKey: 'agents.whatsapp.title' },
  { pattern: /^\/agents/, labelKey: 'nav.conversas' },
  { pattern: /^\/campaigns/, labelKey: 'nav.campaigns' },
  { pattern: /^\/workflows/, labelKey: 'nav.workflows' },
  { pattern: /^\/tasks/, labelKey: 'nav.tasks' },
  { pattern: /^\/settings/, labelKey: 'nav.settings' },
];

export function routeTitleKey(pathname: string): string | undefined {
  return ROUTE_TITLES.find((entry) => entry.pattern.test(pathname))?.labelKey;
}

export function isTopNavActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}
