export const emailTheme = {
  colors: {
    background: '#f3fafc',
    surface: '#ffffff',
    footer: '#f8fbfc',
    primary: '#2563eb',
    primaryText: '#ffffff',
    text: '#101828',
    muted: '#526987',
    border: '#d8e4eb',
    success: '#047857',
    successSurface: '#ecfdf5',
  },
  radius: {
    card: '12px',
    button: '8px',
    logo: '8px',
  },
  layout: {
    contentWidth: '600px',
    fontFamily:
      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  },
  brand: {
    name: 'Prospectly',
    supportEmail: 'support@prospectlyonboard.com',
    siteHost: 'prospectlyonboard.com',
    defaultSiteUrl: 'https://prospectlyonboard.com',
    logoPath: '/brand/prospectly-mark.png',
  },
} as const;

export type EmailLocale = 'pt' | 'en';
export type EmailTemplateId =
  | 'welcome'
  | 'account-activation'
  | 'credits-purchased'
  | 'password-reset'
  | 'waitlist-confirmation'
  | 'waitlist-notify';
