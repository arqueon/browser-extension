import {
  BookmarkPlus,
  Layers,
  Search,
  Settings,
  Tags,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import BookmarkForm from '../../@/components/BookmarkForm.tsx';
import { BatchSaveView } from '../../@/components/BatchSaveView.tsx';
import Container from '../../@/components/Container.tsx';
import { LibraryView } from '../../@/components/LibraryView.tsx';
import { SettingsView } from '../../@/components/SettingsView.tsx';
import { TagManagerView } from '../../@/components/TagManagerView.tsx';
import WholeContainer from '../../@/components/WholeContainer.tsx';
import { Button } from '../../@/components/ui/Button.tsx';
import { isConfigured } from '../../@/lib/config.ts';
import { getBrowser } from '../../@/lib/utils.ts';

type PopupView = 'capture' | 'tags' | 'library' | 'batch' | 'settings';

const viewTitles: Record<PopupView, string> = {
  capture: 'Save or edit',
  tags: 'Manage tags',
  library: 'Find links',
  batch: 'Save tabs',
  settings: 'Settings',
};

function App() {
  const [configured, setConfigured] = useState<boolean>();
  const [view, setView] = useState<PopupView>('capture');

  useEffect(() => {
    void Promise.all([
      isConfigured(),
      getBrowser().storage.local.get(['tagwarden_initial_view']),
    ]).then(async ([ready, stored]) => {
      setConfigured(ready);
      const requestedView = stored.tagwarden_initial_view as
        | PopupView
        | undefined;
      if (!ready) {
        setView('settings');
      } else if (requestedView === 'capture' || requestedView === 'batch') {
        setView(requestedView);
      }
      await getBrowser().storage.local.remove('tagwarden_initial_view');
    });
  }, []);

  const navigation = [
    { view: 'capture' as const, icon: BookmarkPlus, label: 'Save or edit' },
    { view: 'tags' as const, icon: Tags, label: 'Manage tags' },
    { view: 'library' as const, icon: Search, label: 'Find links' },
    { view: 'batch' as const, icon: Layers, label: 'Save open tabs' },
    { view: 'settings' as const, icon: Settings, label: 'Settings' },
  ];

  return (
    <WholeContainer>
      <Container>
        <header className="shrink-0 border-b pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <img
                src="/32.png"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 shrink-0"
              />
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold">Tagwarden</h1>
                <p className="truncate text-[11px] text-muted-foreground">
                  {viewTitles[view]} · for Linkwarden
                </p>
              </div>
            </div>
            <nav className="flex items-center gap-0.5" aria-label="Tagwarden views">
              {navigation.map((item) => {
                const Icon = item.icon;
                const disabled = configured === false && item.view !== 'settings';
                return (
                  <Button
                    key={item.view}
                    type="button"
                    variant={view === item.view ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    title={item.label}
                    aria-label={item.label}
                    aria-current={view === item.view ? 'page' : undefined}
                    disabled={disabled}
                    onClick={() => setView(item.view)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="mt-3 flex min-h-0 flex-1 flex-col">
          {configured === undefined ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Preparing Tagwarden…
            </div>
          ) : view === 'settings' ? (
            <SettingsView
              onConfigured={() => {
                setConfigured(true);
                setView('capture');
              }}
            />
          ) : view === 'tags' ? (
            <TagManagerView />
          ) : view === 'library' ? (
            <LibraryView />
          ) : view === 'batch' ? (
            <BatchSaveView />
          ) : (
            <BookmarkForm onManageTags={() => setView('tags')} />
          )}
        </main>
      </Container>
    </WholeContainer>
  );
}

export default App;
