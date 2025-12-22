import { Dashboard } from '@/pages/Dashboard';
import { GlobalDragOverlay } from '@/components/GlobalDragOverlay';
import { OnboardingTour } from '@/components/OnboardingTour';
import './index.css';

function App() {
  return (
    <>
      <Dashboard />
      <GlobalDragOverlay />
      <OnboardingTour />
    </>
  );
}

export default App;
