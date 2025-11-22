import React, { useRef, useEffect } from 'react';
import { GameEngine } from '../services/GameEngine';
import { GameStats } from '../types';
import { KEYS, SCREEN_H, SCREEN_W } from '../constants';

interface GameCanvasProps {
  onUiUpdate: (stats: GameStats) => void;
  setGameEngine: (engine: GameEngine) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ onUiUpdate, setGameEngine }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Instantiate Engine
    const engine = new GameEngine(ctx, onUiUpdate);
    engineRef.current = engine;
    setGameEngine(engine);

    // Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if(engine.keys) engine.keys[e.key.toLowerCase()] = true;
      if (e.key === KEYS.ULTIMATE && engine.player.swordLevel === 3) engine.triggerUltimate();
      if (e.key === KEYS.PAUSE && engine.player.canPause) engine.togglePause();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if(engine.keys) engine.keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      engine.mouse.screenX = (e.clientX - r.left) * (SCREEN_W / r.width);
      engine.mouse.screenY = (e.clientY - r.top) * (SCREEN_H / r.height);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) engine.startSwing();
      if (e.button === 2) engine.fireFireball();
    };
    
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('contextmenu', handleContextMenu);

    // Game Loop
    const loop = () => {
      engine.update();
      engine.draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);

    // Cleanup
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={SCREEN_W}
      height={SCREEN_H}
      className="block cursor-crosshair shadow-[0_0_60px_rgba(0,0,0,1)] bg-black"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};