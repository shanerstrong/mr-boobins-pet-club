import type { ExpoConfig } from 'expo/config';

declare const process: { env: Record<string, string | undefined> };

const baseUrl = process.env.EXPO_PUBLIC_BASE_URL ?? '/';

const config: ExpoConfig = {
  name: "Mr. Boobins' Pet Club",
  slug: 'mr-boobins-pet-club',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  web: {
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router'],
  experiments: {
    baseUrl,
  },
};

export default config;
