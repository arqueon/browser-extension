import { getStorageItem, setStorageItem } from './utils.ts';
import {
  isAllowedInstanceUrl,
  isInsecureLocalInstanceUrl,
  isSecureInstanceUrl,
  normalizeBaseUrl,
} from './instance-url.ts';
import { configType } from './validators/config.ts';

export {
  isAllowedInstanceUrl,
  isInsecureLocalInstanceUrl,
  isSecureInstanceUrl,
  normalizeBaseUrl,
};

const DEFAULTS: configType = {
  baseUrl: '',
  apiKey: '',
  allowInsecureHttp: false,
  connectionVerified: false,
  defaultCollection: 'Unorganized',
  defaultCollectionId: undefined,
  syncBookmarks: false,
};

const CONFIG_KEY = 'linkwarden_config';

export async function getConfig(): Promise<configType> {
  const config = await getStorageItem(CONFIG_KEY);
  return config ? { ...DEFAULTS, ...JSON.parse(config) } : DEFAULTS;
}

export async function saveConfig(config: configType) {
  return await setStorageItem(CONFIG_KEY, JSON.stringify(config));
}

export async function isConfigured() {
  const config = await getConfig();
  return (
    !!config.baseUrl &&
    config.baseUrl !== '' &&
    !!config.apiKey &&
    config.apiKey !== '' &&
    isAllowedInstanceUrl(config.baseUrl, config.allowInsecureHttp ?? false) &&
    config.connectionVerified !== false
  );
}

export async function clearConfig() {
  return await setStorageItem(
    CONFIG_KEY,
    JSON.stringify({
      baseUrl: '',
      apiKey: '',
      allowInsecureHttp: false,
      connectionVerified: false,
      defaultCollection: 'Unorganized',
      defaultCollectionId: undefined,
      syncBookmarks: false,
    })
  );
}
