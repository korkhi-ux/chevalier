import React from 'react';
import { GameStats } from '../types';
import { FORGE_COSTS } from '../constants';
import { GameEngine } from '../services/GameEngine';

interface UIOverlayProps {
  stats: GameStats;
  engine: GameEngine | null;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({ stats, engine }) => {
  if (!engine) return null;

  const hpPercent = (stats.hp / stats.maxHp) * 100;
  const manaPercent = (stats.mana / stats.maxMana) * 100;
  const forgeCost = FORGE_COSTS[stats.swordLevel];

  return (
    <>
      {/* --- HUD --- */}
      <div className="absolute top-2 left-2 z-20 pointer-events-none scale-110 origin-top-left text-white text-shadow-sm font-mono font-bold">
        <div className="flex items-center mb-1">
          <span className="w-12">VIE</span>
          <div className="w-24 h-2 bg-gray-900 border-2 border-white ml-2">
            <div
              className="h-full bg-red-600 transition-all duration-100"
              style={{ width: `${Math.max(0, hpPercent)}%` }}
            />
          </div>
        </div>
        <div className="flex items-center mb-2">
          <span className="w-12">MANA</span>
          <div className="w-24 h-2 bg-gray-900 border-2 border-white ml-2">
            <div
              className="h-full bg-blue-500 transition-all duration-100"
              style={{ width: `${Math.max(0, manaPercent)}%` }}
            />
          </div>
        </div>
        <div className="text-sm text-gray-300 mt-2">
          <span className="text-yellow-400">OR: {Math.floor(stats.gold)}</span> |{' '}
          <span className="text-red-500">SANG: {stats.blood}</span> | KILLS:{' '}
          {stats.kills}
        </div>
      </div>

      {/* --- WAVE INFO --- */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-center z-20 pointer-events-none font-mono text-shadow-sm">
        <div className="text-yellow-400 font-bold text-lg">
          VAGUE {stats.wave} / {stats.maxWave}
        </div>
        <div className="text-xs text-gray-400">
          {stats.waveProgress}% Eliminé
        </div>
        {stats.waveTimer !== null && (
          <div className="text-red-500 text-sm font-bold mt-1 animate-pulse">
            PROCHAINE VAGUE DANS {stats.waveTimer}s
          </div>
        )}
      </div>

      {/* --- CONTROLS HINT --- */}
      <div className="absolute bottom-2 right-2 text-right text-gray-500 text-[10px] pointer-events-none font-mono z-10">
        Z,Q,S,D: Bouger | Clic G: Attaque | Clic D: Feu
        <br />
        E: Forge | R: Autel | ESPACE: Ultime
        <br />
        P: Pause
      </div>

      {/* --- MODALS --- */}

      {/* Forge */}
      {stats.activeModal === 'forge' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-slate-800 border-4 border-gray-500 p-5 text-center z-30 shadow-[0_0_50px_black] font-mono">
          <h2 className="m-0 mb-4 text-yellow-400 text-shadow-sm font-bold text-xl">
            FORGE ANTIQUE
          </h2>
          <div className="text-xs leading-6 text-white mb-4">
            NIVEAU EPÉE: {stats.swordLevel}
            <br />
            PRIX:{' '}
            <span className="text-yellow-400">
              {forgeCost ? `${forgeCost} OR` : 'MAX'}
            </span>
          </div>
          <button
            className="block w-full bg-red-700 border-2 border-black text-white p-2 font-bold text-sm cursor-pointer hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed mb-2"
            onClick={() => engine.upgradeSword()}
            disabled={!forgeCost || stats.gold < forgeCost}
          >
            AMÉLIORER
          </button>
          <button
            className="block w-full bg-gray-600 border-2 border-black text-white p-2 font-bold text-sm cursor-pointer hover:bg-gray-500"
            onClick={() => engine.closeModal()}
          >
            RETOUR
          </button>
        </div>
      )}

      {/* Altar */}
      {stats.activeModal === 'altar' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-[#1a0505] border-4 border-red-500 p-5 text-center z-30 shadow-[0_0_50px_black] font-mono">
          <h2 className="m-0 mb-4 text-red-500 text-shadow-sm font-bold text-xl">
            AUTEL DE SANG
          </h2>
          <div className="text-xs mb-4 text-gray-400">Offrez du sang...</div>

          <button
            className="block w-full bg-red-800 border-2 border-black text-white p-2 font-bold text-sm cursor-pointer hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed mb-2"
            onClick={() => engine.buyAltar('magnet')}
            disabled={stats.hasMagnet || stats.blood < 15}
          >
            AIMANT (15 Sang)
          </button>
          <button
            className="block w-full bg-red-800 border-2 border-black text-white p-2 font-bold text-sm cursor-pointer hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed mb-2"
            onClick={() => engine.buyAltar('minimap')}
            disabled={stats.hasMinimap || stats.blood < 25}
          >
            MINIMAP (25 Sang)
          </button>
          <button
            className="block w-full bg-red-800 border-2 border-black text-white p-2 font-bold text-sm cursor-pointer hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed mb-2"
            onClick={() => engine.buyAltar('pause')}
            disabled={stats.canPause || stats.blood < 10}
          >
            MENU PAUSE (10 Sang)
          </button>

          <button
            className="block w-full bg-gray-700 border-2 border-black text-white p-2 font-bold text-sm cursor-pointer hover:bg-gray-600 mt-4"
            onClick={() => engine.closeModal()}
          >
            QUITTER
          </button>
        </div>
      )}

      {/* Game Over */}
      {stats.gameOver && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-40 text-shadow-md font-mono">
          <h1 className="text-red-600 text-6xl font-bold mb-4">MORT</h1>
          <button
            className="bg-red-700 border-4 border-black text-white py-2 px-6 font-bold text-lg cursor-pointer hover:bg-red-600"
            onClick={() => engine.reset()}
          >
            RESSUSCITER
          </button>
        </div>
      )}

      {/* Victory */}
      {stats.victory && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-40 text-shadow-md font-mono">
          <h1 className="text-yellow-400 text-6xl font-bold mb-4">
            DONJON PURIFIÉ
          </h1>
          <button
            className="bg-red-700 border-4 border-black text-white py-2 px-6 font-bold text-lg cursor-pointer hover:bg-red-600"
            onClick={() => engine.reset()}
          >
            RECOMMENCER
          </button>
        </div>
      )}

      {/* Pause Screen */}
      {stats.isPaused && stats.activeModal === 'none' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-40 text-shadow-md font-mono">
          <h1 className="text-white text-6xl font-bold mb-4">PAUSE</h1>
          <button
            className="bg-red-700 border-4 border-black text-white py-2 px-6 font-bold text-lg cursor-pointer hover:bg-red-600"
            onClick={() => engine.togglePause()}
          >
            REPRENDRE
          </button>
        </div>
      )}
    </>
  );
};
