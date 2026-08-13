import { CheckCircle2, Loader2, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCollections } from '../lib/actions/collections.ts';
import { getInstanceInfo, InstanceInfo } from '../lib/api.ts';
import { getSession } from '../lib/auth/auth.ts';
import {
  extractSessionToken,
  normalizeAccessToken,
} from '../lib/credentials.ts';
import { describeConnectionError } from '../lib/connection-error.ts';
import {
  getConfig,
  isAllowedInstanceUrl,
  isInsecureLocalInstanceUrl,
  normalizeBaseUrl,
  saveConfig,
} from '../lib/config.ts';
import { requestInstancePermission } from '../lib/utils.ts';
import { Button } from './ui/Button.tsx';
import { Checkbox } from './ui/CheckBox.tsx';
import { Input } from './ui/Input.tsx';
import { Label } from './ui/Label.tsx';
import { RulesEditor } from './RulesEditor.tsx';
import { Separator } from './ui/Separator.tsx';
import { Theme, useTheme } from './ThemeProvider.tsx';

interface SettingsViewProps {
  onConfigured?: () => void;
}

interface CollectionOption {
  id: number;
  ownerId: number;
  name: string;
  pathname: string;
}

type MessageKind = 'success' | 'error' | 'info';

export function SettingsView({ onConfigured }: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [baseUrl, setBaseUrl] = useState('');
  const [allowInsecureHttp, setAllowInsecureHttp] = useState(false);
  const [method, setMethod] = useState<'apiKey' | 'password'>('apiKey');
  const [apiKey, setApiKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [defaultCollectionId, setDefaultCollectionId] = useState<number>();
  const [instance, setInstance] = useState<InstanceInfo>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [messageKind, setMessageKind] = useState<MessageKind>('info');

  useEffect(() => {
    void (async () => {
      const config = await getConfig();
      setBaseUrl(config.baseUrl || 'https://cloud.linkwarden.app');
      setAllowInsecureHttp(config.allowInsecureHttp ?? false);
      setApiKey(config.apiKey);
      setDefaultCollectionId(config.defaultCollectionId);

      if (!config.baseUrl || !config.apiKey) return;
      if (
        !isAllowedInstanceUrl(
          config.baseUrl,
          config.allowInsecureHttp ?? false
        )
      ) {
        setMessageKind('error');
        setMessage(
          'This saved HTTP connection needs explicit local-network consent before Tagwarden can use it.'
        );
        return;
      }
      if (config.connectionVerified === false) {
        setMessageKind('error');
        setMessage('Saved locally, but not verified. Check the values and save again.');
        return;
      }
      try {
        const [info, response] = await Promise.all([
          getInstanceInfo(config.baseUrl, config.apiKey),
          getCollections(config.baseUrl, config.apiKey),
        ]);
        setInstance(info);
        setCollections(response.data.response);
      } catch (_error) {
        setMessageKind('error');
        setMessage('The saved connection needs attention.');
      }
    })();
  }, []);

  const authenticate = async () => {
    const url = normalizeBaseUrl(baseUrl);
    if (!url) throw new Error('Enter the Linkwarden URL.');
    if (!isAllowedInstanceUrl(url, allowInsecureHttp)) {
      if (isInsecureLocalInstanceUrl(url))
        throw new Error(
          'This local instance uses unencrypted HTTP. Enable the warning below to connect on a trusted network, or use HTTPS.'
        );
      throw new Error(
        'Use HTTPS. The HTTP exception is available only for loopback and recognized local-network addresses.'
      );
    }
    const permissionGranted = await requestInstancePermission(url);
    if (!permissionGranted)
      throw new Error('Permission to connect to this instance was denied.');

    if (method === 'apiKey') {
      const token = normalizeAccessToken(apiKey);
      if (!token) throw new Error('Enter an API key.');
      setApiKey(token);
      return { url, token };
    }

    if (!username.trim() || !password)
      throw new Error('Enter the username and password.');
    const session = await getSession(url, username.trim(), password);
    const token = extractSessionToken(session.data);
    if (!token) throw new Error('Linkwarden did not return an API token.');
    setApiKey(token);
    return { url, token };
  };

  const connect = async (persist: boolean) => {
    setBusy(true);
    setMessage(undefined);
    setMessageKind('info');
    let savedLocally = false;
    try {
      const auth = await authenticate();

      if (persist) {
        const selectedCollection = collections.find(
          (collection) => collection.id === defaultCollectionId
        );
        await saveConfig({
          baseUrl: auth.url,
          apiKey: auth.token,
          allowInsecureHttp:
            isInsecureLocalInstanceUrl(auth.url) && allowInsecureHttp,
          defaultCollectionId,
          defaultCollection: selectedCollection?.name ?? 'Unorganized',
          connectionVerified: false,
          syncBookmarks: false,
        });
        savedLocally = true;
      }

      const [info, response] = await Promise.all([
        getInstanceInfo(auth.url, auth.token),
        getCollections(auth.url, auth.token),
      ]);
      setBaseUrl(auth.url);
      setInstance(info);
      setCollections(response.data.response);

      if (persist) {
        const selectedCollection = response.data.response.find(
          (collection) => collection.id === defaultCollectionId
        );
        await saveConfig({
          baseUrl: auth.url,
          apiKey: auth.token,
          allowInsecureHttp:
            isInsecureLocalInstanceUrl(auth.url) && allowInsecureHttp,
          defaultCollectionId,
          defaultCollection: selectedCollection?.name ?? 'Unorganized',
          connectionVerified: true,
          syncBookmarks: false,
        });
        setPassword('');
        setMessageKind('success');
        setMessage('Connection verified and saved.');
        onConfigured?.();
      } else {
        setMessageKind('success');
        setMessage('Connection successful. Choose defaults, then save.');
      }
    } catch (error) {
      const detail = describeConnectionError(error, normalizeBaseUrl(baseUrl));
      setMessageKind('error');
      setMessage(
        savedLocally
          ? `Saved locally, but validation failed. ${detail}`
          : detail
      );
      setInstance(undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Linkwarden connection</h2>
          <p className="text-xs text-muted-foreground">
            Credentials stay in this browser. Tagwarden has no telemetry.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="instance-url">Instance URL</Label>
          <Input
            id="instance-url"
            value={baseUrl}
            onChange={(event) => {
              const nextUrl = event.target.value;
              setBaseUrl(nextUrl);
              if (!isInsecureLocalInstanceUrl(normalizeBaseUrl(nextUrl)))
                setAllowInsecureHttp(false);
            }}
            placeholder="https://cloud.linkwarden.app"
          />
        </div>

        {isInsecureLocalInstanceUrl(normalizeBaseUrl(baseUrl)) ? (
          <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
            <Label
              htmlFor="allow-insecure-http"
              className="flex cursor-pointer items-start gap-2 text-sm"
            >
              <Checkbox
                id="allow-insecure-http"
                className="mt-0.5"
                checked={allowInsecureHttp}
                onCheckedChange={(checked) => {
                  if (checked === 'indeterminate') return;
                  setAllowInsecureHttp(checked);
                }}
              />
              Allow unencrypted HTTP for this local instance
            </Label>
            <p className="text-xs text-muted-foreground">
              Only enable this on a network you trust. Your API token or
              sign-in credentials, URLs, notes, and tags can travel without
              encryption. HTTPS remains the safer option.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 rounded-md bg-secondary p-1">
          <Button
            type="button"
            variant={method === 'apiKey' ? 'default' : 'ghost'}
            className="h-8"
            onClick={() => setMethod('apiKey')}
          >
            API key
          </Button>
          <Button
            type="button"
            variant={method === 'password' ? 'default' : 'ghost'}
            className="h-8"
            onClick={() => setMethod('password')}
          >
            Sign in
          </Button>
        </div>

        {method === 'apiKey' ? (
          <div className="space-y-1.5">
            <Label htmlFor="api-key">API key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste a Linkwarden API key"
            />
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username or email</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || method === 'password'}
            onClick={() => void connect(false)}
            title={
              method === 'password'
                ? 'Password sign-in creates a token, so use Sign in & save.'
                : undefined
            }
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test token
          </Button>
          <Button
            type="button"
            className="tagwarden-primary flex-1"
            disabled={busy}
            onClick={() => void connect(true)}
          >
            {method === 'password' ? 'Sign in & save' : 'Save connection'}
          </Button>
        </div>

        {method === 'password' ? (
          <p className="text-xs text-muted-foreground">
            Your password is sent once to Linkwarden and is never saved;
            Tagwarden stores only the token returned by the server.
          </p>
        ) : null}

        {message ? (
          <p
            className={
              messageKind === 'error'
                ? 'rounded-md border border-destructive bg-destructive/10 p-2 text-xs text-foreground'
                : 'rounded-md border p-2 text-xs'
            }
            aria-live="polite"
          >
            {messageKind === 'success' ? (
              <CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />
            ) : (
              <Server
                className={
                  messageKind === 'error'
                    ? 'mr-1 inline h-4 w-4 text-destructive'
                    : 'mr-1 inline h-4 w-4'
                }
              />
            )}
            {message}
          </p>
        ) : null}

        <p className="rounded-md border bg-secondary p-2 text-xs text-muted-foreground">
          When you test or save this connection, credentials go only to this
          Linkwarden instance. When you use Tagwarden, it sends the URLs,
          titles, notes, tags, and optional screenshots you choose to save or
          search. Domain rules and suggestion history remain in this browser.
        </p>

        {instance ? (
          <p className="text-xs text-muted-foreground">
            {instance.name} {instance.version ? `v${instance.version}` : ''}
          </p>
        ) : null}

        {collections.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="default-collection">Default collection</Label>
            <select
              id="default-collection"
              className="tagwarden-select"
              value={defaultCollectionId ?? ''}
              onChange={(event) =>
                setDefaultCollectionId(
                  event.target.value ? Number(event.target.value) : undefined
                )
              }
            >
              <option value="">Unorganized</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.pathname}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-2">
        <Label htmlFor="theme">Appearance</Label>
        <select
          id="theme"
          className="tagwarden-select"
          value={theme}
          onChange={(event) => setTheme(event.target.value as Theme)}
        >
          <option value="system">Follow system</option>
          <option value="light">Linkwarden light</option>
          <option value="dark">Linkwarden dark</option>
        </select>
      </section>

      <Separator />
      <RulesEditor />
    </div>
  );
}
