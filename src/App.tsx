import { Dashboard } from '@/pages/Dashboard';
import { GlobalDragOverlay } from '@/components/GlobalDragOverlay';
import { OnboardingTour } from '@/components/OnboardingTour';
import { ConnectivityToast } from '@/components/ConnectivityToast';
import './index.css';

function App() {
  return (
    <>
      <Dashboard />
      <GlobalDragOverlay />
      <OnboardingTour />
      <ConnectivityToast />
    </>
  );
}

export default App;
