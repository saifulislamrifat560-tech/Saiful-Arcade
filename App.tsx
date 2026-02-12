import React, { useState } from 'react';
import SnakeGame from './components/SnakeGame';
import SpaceShooterGame from './components/SpaceShooterGame';
import PingPongGame from './components/PingPongGame';
import NumberPuzzleGame from './components/NumberPuzzleGame';
import { MainMenu } from './components/MainMenu';

type GameMode = 'menu' | 'snake' | 'space' | 'pong' | 'numberpuzzle';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<GameMode>('menu');

  return (
    <div className="fixed inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden font-sans">
      {/* Subtle ambient light shared across app */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px] pointer-events-none" />
      
      {currentMode === 'menu' && (
        <MainMenu onSelectGame={setCurrentMode} />
      )}

      {currentMode === 'snake' && (
        <SnakeGame onBack={() => setCurrentMode('menu')} />
      )}

      {currentMode === 'space' && (
        <SpaceShooterGame onBack={() => setCurrentMode('menu')} />
      )}

      {currentMode === 'pong' && (
        <PingPongGame onBack={() => setCurrentMode('menu')} />
      )}

      {currentMode === 'numberpuzzle' && (
        <NumberPuzzleGame onBack={() => setCurrentMode('menu')} />
      )}
    </div>
  );
};

export default App;