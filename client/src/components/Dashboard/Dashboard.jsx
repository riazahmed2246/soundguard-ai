/**
 * Dashboard.jsx
 * -------------
 * Layout shell kept for backwards compatibility.
 * All section rendering and module modals have been
 * moved into App.jsx for a flatter, cleaner component tree.
 *
 * Import this if you need a self-contained Dashboard drop-in;
 * otherwise App.jsx is the single source of truth for layout.
 */
import { useAudio } from '../../context/AudioContext';
import AudioUpload           from './AudioUpload';
import AudioInfo             from './AudioInfo';
import WaveformPlayer        from './WaveformPlayer';
import ModuleButtons         from './ModuleButtons';
import EnhancementModule     from '../Modules/EnhancementModule';
import ExplainabilityModule  from '../Modules/ExplainabilityModule';
import AQIModule             from '../Modules/AQIModule';
import ForensicsModule       from '../Modules/ForensicsModule';

const Dashboard = () => {
  const { activeModule, closeModule } = useAudio();

  return (
    <div className="flex flex-col gap-8">
      <AudioUpload />
      <AudioInfo />
      <WaveformPlayer />
      <ModuleButtons />

      <EnhancementModule    isOpen={activeModule === 'enhancement'}    onClose={closeModule} />
      <ExplainabilityModule isOpen={activeModule === 'explainability'} onClose={closeModule} />
      <AQIModule            isOpen={activeModule === 'aqi'}            onClose={closeModule} />
      <ForensicsModule      isOpen={activeModule === 'forensics'}      onClose={closeModule} />
    </div>
  );
};

export default Dashboard;