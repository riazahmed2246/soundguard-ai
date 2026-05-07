import React, { useEffect } from 'react';
import { AudioProvider } from './context/AudioContext';
import MainLayout from './components/Layout/MainLayout';
import './index.css';

const App = () => {
  // Block accidental browser file-open on drag outside the drop zone
  useEffect(() => {
    const prevent = (e) => {
      if (!e.target.closest('[data-dropzone]')) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      }
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop',     prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop',     prevent);
    };
  }, []);

  return (
    <AudioProvider>
      <MainLayout />
    </AudioProvider>
  );
};

export default App;
