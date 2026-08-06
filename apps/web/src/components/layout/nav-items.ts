import {
  Bot,
  CheckSquare,
  FileUp,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  PanelsTopLeft,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Rótulo da etapa do fluxo comercial que agrupa os itens. */
  labelKey: string;
  items: NavItem[];
}

/**
 * Ordem espelha o fluxo do produto: encontrar → qualificar → converter → conta.
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
      { to: '/pages', labelKey: 'nav.pages', icon: PanelsTopLeft },
      { to: '/tasks', labelKey: 'nav.tasks', icon: CheckSquare },
    ],
  },
  {
    labelKey: 'nav.groupAccount',
    items: [{ to: '/settings', labelKey: 'nav.settings', icon: Settings }],
  },
];

/** Título contextual exibido no header, por rota. */
export const ROUTE_TITLES: Array<{ pattern: RegExp; labelKey: string }> = [
  { pattern: /^\/$/, labelKey: 'nav.dashboard' },
  { pattern: /^\/search/, labelKey: 'nav.search' },
  { pattern: /^\/imports/, labelKey: 'nav.imports' },
  { pattern: /^\/leads/, labelKey: 'nav.leads' },
  { pattern: /^\/pipeline/, labelKey: 'nav.pipeline' },
  { pattern: /^\/agents\/crm/, labelKey: 'agents.crm.title' },
  { pattern: /^\/agents\/whatsapp/, labelKey: 'agents.whatsapp.title' },
  { pattern: /^\/agents/, labelKey: 'nav.agents' },
  { pattern: /^\/campaigns/, labelKey: 'nav.campaigns' },
  { pattern: /^\/pages/, labelKey: 'nav.pages' },
  { pattern: /^\/tasks/, labelKey: 'nav.tasks' },
  { pattern: /^\/settings/, labelKey: 'nav.settings' },
];

export function routeTitleKey(pathname: string): string | undefined {
  return ROUTE_TITLES.find((entry) => entry.pattern.test(pathname))?.labelKey;
}
