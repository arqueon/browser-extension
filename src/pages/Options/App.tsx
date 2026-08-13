import Container from '../../@/components/Container.tsx';
import { SettingsView } from '../../@/components/SettingsView.tsx';
import WholeContainer from '../../@/components/WholeContainer.tsx';

const App = () => (
  <WholeContainer>
    <Container>
      <header className="mb-3 border-b pb-2">
        <h1 className="text-lg font-semibold">Tagwarden settings</h1>
        <p className="text-xs text-muted-foreground">
          This compatibility page uses the same settings view as the popup.
        </p>
      </header>
      <SettingsView />
    </Container>
  </WholeContainer>
);

export default App;
