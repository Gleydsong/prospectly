export const SETTINGS_HUB_TABS = ['account', 'team', 'integrations'] as const;

export type SettingsHubTab = (typeof SETTINGS_HUB_TABS)[number];
export type SettingsTab = SettingsHubTab | 'privacy';

export function parseSettingsTab(value: string | null): SettingsHubTab {
  if (value === 'team' || value === 'integrations') return value;
  return 'account';
}

export function settingsTabPath(tab: SettingsHubTab): string {
  return tab === 'account' ? '/settings' : `/settings?tab=${tab}`;
}
