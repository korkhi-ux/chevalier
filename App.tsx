import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { GameStats } from './types';
import { GameEngine } from './services/GameEngine';

const INITIAL_STATS: GameStats = {
  hp: 100, maxHp: 100, mana: 100, maxMana: 100,
  gold: 0, blood: 0, kills: 0,
  wave: 1, maxWave: 10, waveProgress: 0, waveTimer: null,
  swordLevel: 0,
  hasMagnet: false, hasMinimap: false, canPause: false,
  forgeUnlocked: false, altarUnlocked: false,
  isPaused: false, gameOver: false, victory: false,
  activeModal: 'none'
};

export default function App() {
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
  const [engine, setEngine] = useState<GameEngine | null>(null);

  // This callback is called 60 times a second, so we should be careful.
  // However, React 18 automatic batching handles this quite well.
  // If performance degrades, we can throttle this.
  const handleUiUpdate = useCallback((newStats: GameStats) => {
    setStats(newStats);
  }, []);

  return (
    <div className="flex justify-center items-center h-screen bg-[#050505] font-mono text-white select-none">
      <div className="relative w-[800px] h-[600px] border-8 border-gray-600 bg-black shadow-[0_0_60px_rgba(0,0,0,1)] overflow-hidden">
        <GameCanvas onUiUpdate={handleUiUpdate} setGameEngine={setEngine} />
        <UIOverlay stats={stats} engine={engine} />
      </div>
    </div>
  );
}
