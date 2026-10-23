export const SETTINGS_HUB_TABS = [
  'account',
  'organization',
  'team',
  'scoring',
  'preferences',
  'integrations',
] as const;

export type SettingsHubTab = (typeof SETTINGS_HUB_TABS)[number];
export type SettingsTab = SettingsHubTab | 'privacy';

export function parseSettingsTab(value: string | null): SettingsHubTab {
  if (value === 'account') return 'account';
  if (value === 'team') return 'team';
  if (value === 'scoring') return 'scoring';
  if (value === 'preferences') return 'preferences';
  if (value === 'integrations') return 'integrations';
  return 'organization';
}

export function settingsTabPath(tab: SettingsHubTab): string {
  if (tab === 'organization') return '/settings';
  return `/settings?tab=${tab}`;
}
