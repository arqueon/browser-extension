import { z } from 'zod';

export const configSchema = z.object({
  baseUrl: z.string().url(),
  defaultCollection: z.string().optional().default('Unorganized'),
  defaultCollectionId: z.number().optional(),
  apiKey: z.string(),
  allowInsecureHttp: z.boolean().optional(),
  connectionVerified: z.boolean().optional(),
  syncBookmarks: z.boolean().optional().default(false),
});

export type configType = z.infer<typeof configSchema>;
