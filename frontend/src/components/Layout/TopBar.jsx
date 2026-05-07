import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, HelpCircle, Wifi, WifiOff, Sun, Moon } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { checkHealth } from '../../services/api';

const DropdownMenu = ({ items, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 w-48 rounded-md overflow-hidden shadow-2xl z-[100] animate-slide-in-up"
         style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)' }}>
      {items.map((item, i) =>
        item === '---' ? <div key={i} className="divider my-1" /> : (
          <button key={item.label}
            onClick={() => { item.action?.(); onClose(); }}
            disabled={item.disabled}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors"
            style={{ color: item.danger ? 'var(--accent-red)' : 'var(--text-secondary)', opacity: item.disabled ? 0.4 : 1 }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="flex items-center gap-2">
              {item.icon && <span className="text-[10px]">{item.icon}</span>}
              {item.label}
            </span>
            {item.shortcut && (
              <span className="font-mono text-[10px]" style={{ color: 'var(--text-disabled)' }}>
                {item.shortcut}
              </span>
            )}
          </button>
        )
      )}
    </div>
  );
};

const TopBar = () => {
  const {
    audioInfo, hasAudio, resetAudio,
    notify, setActiveTab,
    enhancementResults, aqiResults, forensicsResults,
    theme, toggleTheme,
  } = useAudio();

  const [openMenu,  setOpenMenu]  = useState(null);
  const [backendOk, setBackendOk] = useState(null);
  const pingRef = useRef(null);

  useEffect(() => {
    const ping = async () => {
      try { await checkHealth(); setBackendOk(true); }
      catch { setBackendOk(false); }
    };
    ping();
    pingRef.current = setInterval(ping, 30_000);
    return () => clearInterval(pingRef.current);
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setOpenMenu(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const closeMenu  = useCallback(() => setOpenMenu(null), []);
  const toggleMenu = useCallback((menu) => setOpenMenu(prev => prev === menu ? null : menu), []);

  const menus = {
    File: [
      { label: 'Upload Audio',    icon: '📂', shortcut: 'Ctrl+O',
        action: () => document.getElementById('audio-upload-trigger')?.click() },
      { label: 'Export Enhanced', icon: '💾', shortcut: 'Ctrl+E',
        disabled: !enhancementResults, action: () => notify('info', 'Use the Tools panel to choose export format.') },
      '---',
      { label: 'Download Report', icon: '📄', disabled: !aqiResults && !forensicsResults,
        action: () => notify('info', 'Generating report…') },
      '---',
      { label: 'Close Audio', icon: '✕', danger: true, disabled: !hasAudio,
        action: () => { resetAudio(); notify('info', 'Audio closed.'); } },
    ],
    Edit: [
      { label: 'Undo', icon: '↩', shortcut: 'Ctrl+Z', disabled: true },
      { label: 'Redo', icon: '↪', shortcut: 'Ctrl+Y', disabled: true },
      '---',
      { label: 'Preferences', icon: '⚙', action: () => notify('info', 'Preferences coming soon.') },
    ],
    View: [
      { label: 'Tools Panel',   icon: '🛠', action: () => setActiveTab('tools') },
      { label: 'AQI Panel',     icon: '📈', action: () => setActiveTab('aqi') },
      { label: 'Forensics',     icon: '🔍', action: () => setActiveTab('forensics') },
      { label: 'Explainability',icon: '🧠', action: () => setActiveTab('explain') },
      '---',
      { label: theme === 'dark' ? 'Light Mode' : 'Dark Mode', icon: theme === 'dark' ? '☀' : '🌙',
        action: toggleTheme },
    ],
    Analysis: [
      { label: 'Run Enhancement',  icon: '✨', disabled: !hasAudio, action: () => setActiveTab('tools') },
      { label: 'Calculate AQI',    icon: '📊', disabled: !hasAudio, action: () => setActiveTab('aqi') },
      { label: 'Detect Tampering', icon: '🛡', disabled: !hasAudio, action: () => setActiveTab('forensics') },
    ],
  };

  return (
    <header className="flex items-center justify-between px-4 shrink-0"
      style={{ height: 'var(--topbar-height)', background: 'var(--bg-surface)',
               borderBottom: '1px solid var(--border-default)' }}>

      {/* Left: Logo + menus */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-px h-5">
            {[3,5,4,6,4,5,3].map((h,i) => (
              <div key={i} className="w-0.5 rounded-sm"
                   style={{ height: `${h*3}px`, background: 'var(--accent-blue)', opacity: 0.7+i*0.04 }} />
            ))}
          </div>
          <span className="text-sm font-bold tracking-tight"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            SoundGuard<span style={{ color: 'var(--accent-blue)' }}> AI</span>
          </span>
        </div>

        <nav className="flex items-center gap-0.5">
          {Object.entries(menus).map(([label, items]) => (
            <div key={label} className="relative">
              <button onClick={() => toggleMenu(label)}
                className="px-3 py-1.5 text-xs rounded transition-colors"
                style={{ fontFamily: 'var(--font-ui)',
                         color: openMenu === label ? 'var(--text-primary)' : 'var(--text-secondary)',
                         background: openMenu === label ? 'var(--bg-overlay)' : 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { if (openMenu !== label) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              >
                {label}
              </button>
              {openMenu === label && <DropdownMenu items={items} onClose={closeMenu} />}
            </div>
          ))}
        </nav>
      </div>

      {/* Right: info + controls */}
      <div className="flex items-center gap-3">
        {audioInfo && (
          <div className="flex items-center gap-2 px-3 py-1 rounded text-[10.5px]"
               style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                        fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            <span>{(audioInfo.sample_rate / 1000).toFixed(1)} kHz</span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span>{audioInfo.channels === 2 ? 'Stereo' : 'Mono'}</span>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span className="max-w-[120px] truncate">{audioInfo.filename}</span>
          </div>
        )}

        {/* Backend status */}
        <div data-tooltip={backendOk === null ? 'Connecting…' : backendOk ? 'Backend connected' : 'Backend unreachable'}>
          {backendOk === false
            ? <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--accent-red)' }} />
            : <Wifi className="w-3.5 h-3.5" style={{ color: backendOk ? 'var(--accent-green)' : 'var(--text-disabled)' }} />
          }
        </div>

        {/* Theme toggle */}
        <button className="btn-icon" onClick={toggleTheme}
                data-tooltip={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark'
            ? <Sun  className="w-3.5 h-3.5" style={{ color: 'var(--accent-amber)' }} />
            : <Moon className="w-3.5 h-3.5" style={{ color: 'var(--accent-blue)'  }} />
          }
        </button>

        <button className="btn-icon" data-tooltip="Settings"
                onClick={() => notify('info', 'Settings panel coming soon.')}>
          <Settings className="w-3.5 h-3.5" />
        </button>

        <button className="btn-icon" data-tooltip="Help"
                onClick={() => notify('info', 'Documentation coming soon.')}>
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Live/Offline pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono"
             style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)' }}>
          <div className={`w-1.5 h-1.5 rounded-full ${backendOk ? 'animate-pulse-glow' : ''}`}
               style={{ background: backendOk ? 'var(--accent-green)' : 'var(--text-disabled)' }} />
          <span>{backendOk ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
