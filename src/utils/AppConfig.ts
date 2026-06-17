import { enUS, zhCN } from '@clerk/localizations';
import type { LocalizationResource } from '@clerk/shared/types';
import type { LocalePrefixMode } from 'next-intl/routing';

/** Locale prefix strategy for next-intl routing. */
const localePrefix: LocalePrefixMode = 'as-needed';
const localeDetection = false;

// FIXME: Customize this configuration for your product
/** Centralized application configuration */
export const AppConfig = {
  name: 'Agent Foundry',
  i18n: {
    locales: ['zh', 'en'],
    defaultLocale: 'zh',
    localeDetection,
    localePrefix,
  },
};

const zhClerkLocalization: LocalizationResource = {
  ...zhCN,
  signIn: {
    ...zhCN.signIn,
    start: {
      ...zhCN.signIn?.start,
      title: `登录 ${AppConfig.name}`,
      titleCombined: `继续使用 ${AppConfig.name}`,
    },
  },
  signUp: {
    ...zhCN.signUp,
    start: {
      ...zhCN.signUp?.start,
      subtitle: `继续使用 ${AppConfig.name}`,
      subtitleCombined: `继续使用 ${AppConfig.name}`,
    },
  },
};

const enClerkLocalization: LocalizationResource = {
  ...enUS,
  signIn: {
    ...enUS.signIn,
    start: {
      ...enUS.signIn?.start,
      title: `Sign in to ${AppConfig.name}`,
      titleCombined: `Continue to ${AppConfig.name}`,
    },
  },
  signUp: {
    ...enUS.signUp,
    start: {
      ...enUS.signUp?.start,
      subtitle: `Continue to ${AppConfig.name}`,
      subtitleCombined: `Continue to ${AppConfig.name}`,
    },
  },
};

const supportedLocales: Record<string, LocalizationResource> = {
  zh: zhClerkLocalization,
  en: enClerkLocalization,
};

export const ClerkLocalizations = {
  defaultLocale: zhClerkLocalization,
  supportedLocales,
};
