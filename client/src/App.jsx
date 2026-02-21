import './index.css';

// ── Dashboard section components ──────────────────────────────
import AudioUpload    from './components/Dashboard/AudioUpload';
import AudioInfo      from './components/Dashboard/AudioInfo';
import WaveformPlayer from './components/Dashboard/WaveformPlayer';
import ModuleButtons  from './components/Dashboard/ModuleButtons';

// ── Module modals ─────────────────────────────────────────────
import EnhancementModule    from './components/Modules/EnhancementModule';
import ExplainabilityModule from './components/Modules/ExplainabilityModule';
import AQIModule            from './components/Modules/AQIModule';
import ForensicsModule      from './components/Modules/ForensicsModule';

// ── Shared context ────────────────────────────────────────────
import { useAudio } from './context/AudioContext';

// ─────────────────────────────────────────────────────────────
//  Sub-component — top header bar
// ─────────────────────────────────────────────────────────────
const AppHeader = () => {
  const { audioInfo } = useAudio();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-slate-200">
      {/* Blue accent stripe across the very top */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 py-3">

          {/* Logo mark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xl shadow-md shadow-blue-200 select-none">
              🔊
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 leading-none tracking-tight">
                SoundGuard<span className="text-blue-600 ml-1">AI</span>
              </h1>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5 hidden sm:block tracking-wide">
                Intelligent Audio Analysis System
              </p>
            </div>
          </div>

          {/* Vertical divider */}
          <div className="hidden md:block h-8 w-px bg-slate-200 mx-2" />

          {/* Nav pills */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-500">
            {['Upload', 'Analyse', 'Enhance', 'Forensics'].map((label) => (
              <span key={label} className="px-2.5 py-1 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-default">
                {label}
              </span>
            ))}
          </nav>

          <div className="flex-1" />

          {/* File name chip */}
          {audioInfo && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 max-w-[200px]">
              <span className="text-base leading-none select-none">🎵</span>
              <span className="text-xs font-medium text-slate-600 truncate">{audioInfo.filename}</span>
            </div>
          )}

          {/* System status */}
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">System Online</span>
          </span>

        </div>
      </div>
    </header>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — section divider label
// ─────────────────────────────────────────────────────────────
const Divider = ({ label }) => (
  <div className="flex items-center gap-3 my-1">
    <div className="flex-1 h-px bg-slate-200" />
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{label}</span>
    <div className="flex-1 h-px bg-slate-200" />
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Main App
// ─────────────────────────────────────────────────────────────
const App = () => {
  const { activeModule, closeModule } = useAudio();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* HEADER */}
      <AppHeader />

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-8">

          {/* SECTION 1 — Upload */}
          <section id="upload">
            <AudioUpload />
          </section>

          <Divider label="Audio Details" />

          {/* SECTION 2 — Info + Waveform side by side on wide screens */}
          <section id="details">
            <div className="flex flex-col xl:flex-row gap-6">
              <div className="flex-1 min-w-0">
                <AudioInfo />
              </div>
              <div className="xl:w-[480px] shrink-0">
                <WaveformPlayer />
              </div>
            </div>
          </section>

          <Divider label="AI Analysis Modules" />

          {/* SECTION 3 — Module Buttons 2x2 grid */}
          <section id="modules">
            <ModuleButtons />
          </section>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base select-none">🔊</span>
              <span className="text-sm font-bold text-slate-700">SoundGuard AI</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-400">Intelligent Audio Analysis System</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {['DEMUCS', 'RawNet3', 'FullSubNet+', 'Librosa'].map((tech, i, arr) => (
                <span key={tech} className="flex items-center gap-3">
                  <span className="font-medium">{tech}</span>
                  {i < arr.length - 1 && <span className="text-slate-300">·</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* MODULE MODALS */}
      <EnhancementModule
        isOpen={activeModule === 'enhancement'}
        onClose={closeModule}
      />
      <ExplainabilityModule
        isOpen={activeModule === 'explainability'}
        onClose={closeModule}
      />
      <AQIModule
        isOpen={activeModule === 'aqi'}
        onClose={closeModule}
      />
      <ForensicsModule
        isOpen={activeModule === 'forensics'}
        onClose={closeModule}
      />

    </div>
  );
};

export default App;