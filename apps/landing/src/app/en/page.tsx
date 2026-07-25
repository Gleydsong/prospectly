import type { Metadata } from 'next';
import { HomeLanding } from '@/components/home-landing';

export const metadata: Metadata = {
  title: 'Google Maps and OpenStreetMap lead prospecting',
  description:
    'Tool for digital agencies to prospect local clients. Find businesses without a website and organize your pipeline.',
};

export default function EnHomePage() {
  return <HomeLanding locale="en" />;
}
