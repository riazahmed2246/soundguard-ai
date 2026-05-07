import React from 'react';
import { Wand2, BarChart2, Shield, Brain, Scissors, Wind, Music } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import EnhancementPanel     from '../Modules/EnhancementPanel';
import AQIPanel             from '../Modules/AQIPanel';
import ForensicsPanel       from '../Modules/ForensicsPanel';
import ExplainabilityPanel  from '../Modules/ExplainabilityPanel';
import AudioEditorPanel     from '../Modules/AudioEditorPanel';
import NoiseRemovalPanel    from '../Modules/NoiseRemovalPanel';
import SourceSeparationPanel from '../Modules/SourceSeparationPanel';

const TABS = [
  { id:'tools',    label:'Enhance', icon:Wand2    },
  { id:'editor',   label:'Edit',    icon:Scissors },
  { id:'denoise',  label:'Denoise', icon:Wind     },
  { id:'separate', label:'Stems',   icon:Music    },
  { id:'aqi',      label:'AQI',     icon:BarChart2 },
  { id:'forensics',label:'Forensic',icon:Shield   },
  { id:'explain',  label:'Explain', icon:Brain    },
];

const RightPanel = () => {
  const { activeTab, setActiveTab } = useAudio();
  return (
    <aside className="flex flex-col shrink-0 overflow-hidden"
           style={{ width:'var(--right-panel-width)', background:'var(--bg-surface)',
                    borderLeft:'1px solid var(--border-default)' }}>

      {/* Tab bar — scrollable for 7 tabs */}
      <div className="shrink-0 overflow-x-auto" style={{ borderBottom:'1px solid var(--border-default)' }}>
        <div className="flex" style={{ minWidth: 'max-content' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1 px-3 py-2.5 text-[10.5px] font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab===id ? 'border-[--accent-blue]' : 'border-transparent'}`}
              style={{ color: activeTab===id ? 'var(--accent-blue)' : 'var(--text-muted)',
                       background:'transparent', fontFamily:'var(--font-ui)' }}>
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tools'     && <EnhancementPanel />}
        {activeTab === 'editor'    && <AudioEditorPanel />}
        {activeTab === 'denoise'   && <NoiseRemovalPanel />}
        {activeTab === 'separate'  && <SourceSeparationPanel />}
        {activeTab === 'aqi'       && <AQIPanel />}
        {activeTab === 'forensics' && <ForensicsPanel />}
        {activeTab === 'explain'   && <ExplainabilityPanel />}
      </div>
    </aside>
  );
};

export default RightPanel;
