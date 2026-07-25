import { staticFile } from 'remotion';

export const CAPTURE_FILES = {
  landingHero: 'captures/landing-hero.png',
  landingScroll: 'captures/landing-scroll.png',
  login: 'captures/app-login.png',
  dashboard: 'captures/app-dashboard.png',
  search: 'captures/app-search.png',
  searchFilled: 'captures/app-search-filled.png',
  leads: 'captures/app-leads.png',
  pipeline: 'captures/app-pipeline.png',
  registerEmpty: 'captures/app-register-empty.png',
  registerFilled: 'captures/app-register-filled.png',
  demoVideo: 'captures/demo-walkthrough.webm',
} as const;

export type CaptureKey = keyof typeof CAPTURE_FILES;

export const captureSrc = (key: CaptureKey): string =>
  staticFile(CAPTURE_FILES[key]);

export const REQUIRED_STILL_ASSETS: CaptureKey[] = [
  'landingHero',
  'landingScroll',
  'login',
  'dashboard',
  'search',
  'searchFilled',
  'leads',
  'pipeline',
  'registerEmpty',
  'registerFilled',
];

export const OPTIONAL_VIDEO_ASSETS: CaptureKey[] = ['demoVideo'];

export const SIGNUP_STILL_ASSETS: CaptureKey[] = [
  'landingHero',
  'registerEmpty',
  'registerFilled',
  'dashboard',
];
