import axios from 'axios';
import { optionsFormValues } from './validators/optionsForm.ts';

export interface InstanceInfo {
  version: string | null;
  name: string;
}

export async function getInstanceInfo(
  baseUrl: string,
  apiKey: string
): Promise<InstanceInfo> {
  const response = await axios.get<{
    response?: {
      INSTANCE_VERSION?: string | null;
      CUSTOM_NAME?: string | null;
    };
  }>(`${baseUrl}/api/v1/config`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return {
    version: response.data.response?.INSTANCE_VERSION ?? null,
    name: response.data.response?.CUSTOM_NAME || 'Linkwarden',
  };
}

// Just a placeholder for now, until apis routes and token auth are implemented
// TODO: Implement apis routes and token auth, if not possible on just queries for react query, I don't really want to manage it on a separate class
export class LinkwardenApi {
  configuration: optionsFormValues;

  constructor(conf: optionsFormValues) {
    this.configuration = conf;
  }

  async testConnection() {
    return await getInstanceInfo(
      this.configuration.baseUrl,
      this.configuration.apiKey ?? ''
    );
  }
}
