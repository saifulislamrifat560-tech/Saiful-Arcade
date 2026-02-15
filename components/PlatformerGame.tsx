import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface PlatformerGameProps {
  onBack: () => void;
}

const PLAYER_SIZE = 24;
const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const SPEED = 5;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LevelData {
  platforms: Rect[];
  hazards: Rect[];
  goal: Rect;
  start: { x: number, y: number };
}

const LEVELS: LevelData[] = [
  // Level 1: Basics
  {
    platforms: [
      { x: 0, y: 300, w: 800, h: 100 }, // Floor
      { x: 200, y: 220, w: 100, h: 20 },
      { x: 400, y: 160, w: 100, h: 20 },
      { x: 600, y: 100, w: 100, h: 20 },
    ],
    hazards: [
      { x: 300, y: 280, w: 40, h: 20 }, // Spike on floor
    ],
    goal: { x: 700, y: 60, w: 30, h: 30 },
    start: { x: 50, y: 250 }
  },
  // Level 2: Gaps
  {
    platforms: [
      { x: 0, y: 300, w: 200, h: 100 },
      { x: 250, y: 300, w: 200, h: 100 },
      { x: 500, y: 250, w: 100, h: 20 },
      { x: 650, y: 200, w: 150, h: 20 },
    ],
    hazards: [
      { x: 300, y: 280, w: 40, h: 20 },
    ],
    goal: { x: 750, y: 160, w: 30, h: 30 },
    start: { x: 50, y: 250 }
  },
  // Level 3: Verticality
  {
    platforms: [
      { x: 0, y: 350, w: 800, h: 50 },
      { x: 200, y: 280, w: 80, h: 20 },
      { x: 100, y: 200, w: 80, h: 20 },
      { x: 250, y: 140, w: 80, h: 20 },
      { x: 400, y: 140, w: 80, h: 20 },
      { x: 550, y: 200, w: 80, h: 20 },
      { x: 700, y: 280, w: 100, h: 20 },
    ],
    hazards: [
      { x: 400, y: 330, w: 40, h: 20 },
      { x: 440, y: 330, w: 40, h: 20 },
      { x: 480, y: 330, w: 40, h: 20 },
    ],
    goal: { x: 750, y: 240, w: 30, h: 30 },
    start: { x: 50, y: 300 }
  }
];

const PlatformerGame: React.FC<PlatformerGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [isWin, setIsWin] = useState(false);
  
  const gameState = useRef({
    player: { x: 50, y: 50, vx: 0, vy: 0, grounded: false },
    keys: { left: false, right: false, up: false },
    currentLevel: LEVELS[0],
    particles: [] as {x: number, y: number, vx: number, vy: number, life: number}[]
  });

  const loadLevel = useCallback((lvlIdx: number) => {
    const idx = lvlIdx % LEVELS.length;
    gameState.current.currentLevel = LEVELS[idx];
    gameState.current.player = {
        x: LEVELS[idx].start.x,
        y: LEVELS[idx].start.y,
        vx: 0,
        vy: 0,
        grounded: false
    };
    gameState.current.particles = [];
    setIsWin(false);
  }, []);

  useEffect(() => {
    loadLevel(level);
  }, [level, loadLevel]);

  const spawnParticles = (x: number, y: number) => {
      for(let i=0; i<10; i++) {
          gameState.current.particles.push({
              x, y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              life: 20
          });
      }
  };

  const checkRectCollision = (r1: Rect, r2: Rect) => {
      return (r1.x < r2.x + r2.w &&
              r1.x + r1.w > r2.x &&
              r1.y < r2.y + r2.h &&
              r1.y + r1.h > r2.y);
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
     if (isWin) return;
     const state = gameState.current;
     const lvl = state.currentLevel;

     // Input
     if (state.keys.left) state.player.vx = -SPEED;
     else if (state.keys.right) state.player.vx = SPEED;
     else state.player.vx = 0;

     // Jump
     if (state.keys.up && state.player.grounded) {
         state.player.vy = JUMP_FORCE;
         state.player.grounded = false;
     }

     // Gravity
     state.player.vy += GRAVITY;

     // Move X
     state.player.x += state.player.vx;
     const pRect = { x: state.player.x, y: state.player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };

     // Collision X
     lvl.platforms.forEach(plat => {
         if (checkRectCollision(pRect, plat)) {
             if (state.player.vx > 0) state.player.x = plat.x - PLAYER_SIZE;
             else if (state.player.vx < 0) state.player.x = plat.x + plat.w;
         }
     });

     // Move Y
     state.player.y += state.player.vy;
     pRect.x = state.player.x;
     pRect.y = state.player.y;

     state.player.grounded = false;
     // Collision Y
     lvl.platforms.forEach(plat => {
         if (checkRectCollision(pRect, plat)) {
             if (state.player.vy > 0) {
                 state.player.y = plat.y - PLAYER_SIZE;
                 state.player.grounded = true;
                 state.player.vy = 0;
             } else if (state.player.vy < 0) {
                 state.player.y = plat.y + plat.h;
                 state.player.vy = 0;
             }
         }
     });

     // Hazards (Reset)
     let dead = false;
     if (state.player.y > canvas.height) dead = true;
     lvl.hazards.forEach(haz => {
         // Smaller hitbox for hazards
         const hRect = { x: haz.x + 5, y: haz.y + 5, w: haz.w - 10, h: haz.h - 5 };
         if (checkRectCollision(pRect, hRect)) dead = true;
     });

     if (dead) {
         audioController.playGameOverSound();
         spawnParticles(state.player.x, state.player.y);
         state.player.x = lvl.start.x;
         state.player.y = lvl.start.y;
         state.player.vx = 0;
         state.player.vy = 0;
         setAttempts(a => a + 1);
     }

     // Goal
     if (checkRectCollision(pRect, lvl.goal)) {
         audioController.playEatSound();
         if (level < LEVELS.length - 1) {
             setLevel(l => l + 1);
         } else {
             setIsWin(true);
         }
     }

     // Particles
     state.particles.forEach(p => {
         p.x += p.vx;
         p.y += p.vy;
         p.life--;
     });
     state.particles = state.particles.filter(p => p.life > 0);

  }, [isWin, level]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const state = gameState.current;
      const lvl = state.currentLevel;

      // Platforms
      ctx.fillStyle = '#334155';
      lvl.platforms.forEach(p => {
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = '#64748b'; // Top highlight
          ctx.fillRect(p.x, p.y, p.w, 4);
          ctx.fillStyle = '#334155';
      });

      // Hazards
      ctx.fillStyle = '#ef4444';
      lvl.hazards.forEach(h => {
          ctx.beginPath();
          ctx.moveTo(h.x, h.y + h.h);
          ctx.lineTo(h.x + h.w / 2, h.y);
          ctx.lineTo(h.x + h.w, h.y + h.h);
          ctx.fill();
      });

      // Goal
      ctx.fillStyle = '#eab308';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#eab308';
      ctx.fillRect(lvl.goal.x, lvl.goal.y, lvl.goal.w, lvl.goal.h);
      ctx.shadowBlur = 0;

      // Player
      ctx.fillStyle = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#22d3ee';
      ctx.fillRect(state.player.x, state.player.y, PLAYER_SIZE, PLAYER_SIZE);
      ctx.shadowBlur = 0;

      // Particles
      ctx.fillStyle = '#fff';
      state.particles.forEach(p => {
          ctx.globalAlpha = p.life / 20;
          ctx.fillRect(p.x, p.y, 4, 4);
      });
      ctx.globalAlpha = 1;

  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animId: number;
    const render = () => {
        update(canvas);
        draw(ctx, canvas);
        animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [draw, update]);

  // Controls
  const handleTouchStart = (action: 'left' | 'right' | 'jump') => {
      if (action === 'left') gameState.current.keys.left = true;
      if (action === 'right') gameState.current.keys.right = true;
      if (action === 'jump') gameState.current.keys.up = true;
  };

  const handleTouchEnd = (action: 'left' | 'right' | 'jump') => {
      if (action === 'left') gameState.current.keys.left = false;
      if (action === 'right') gameState.current.keys.right = false;
      if (action === 'jump') gameState.current.keys.up = false;
  };

  useEffect(() => {
      const down = (e: KeyboardEvent) => {
          if (e.key === 'ArrowLeft') gameState.current.keys.left = true;
          if (e.key === 'ArrowRight') gameState.current.keys.right = true;
          if (e.key === 'ArrowUp' || e.code === 'Space') gameState.current.keys.up = true;
      };
      const up = (e: KeyboardEvent) => {
          if (e.key === 'ArrowLeft') gameState.current.keys.left = false;
          if (e.key === 'ArrowRight') gameState.current.keys.right = false;
          if (e.key === 'ArrowUp' || e.code === 'Space') gameState.current.keys.up = false;
      };
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      return () => {
          window.removeEventListener('keydown', down);
          window.removeEventListener('keyup', up);
      };
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-black touch-none">
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">Menu</button>
         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-yellow-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{level + 1}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-yellow-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Attempts</span>
                <span className="text-3xl text-yellow-500 font-light tracking-tight opacity-80">{attempts}</span>
            </div>
         </div>
         <button onClick={() => loadLevel(level)} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">RESET</button>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0 bg-[#0a0a0a]">
         <div className="relative border-2 border-yellow-900/50 shadow-[0_0_30px_rgba(234,179,8,0.1)] rounded-lg overflow-hidden max-w-full">
             <canvas 
                ref={canvasRef}
                width={800}
                height={400}
                className="w-full h-auto bg-[#0f172a] object-contain"
                style={{ maxHeight: '100%', maxWidth: '100%' }}
             />
             
             {isWin && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
                     <h2 className="text-5xl text-yellow-400 font-bold uppercase tracking-widest drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">Complete</h2>
                 </div>
             )}
         </div>
      </div>

      {/* Mobile Controls */}
      <div className="flex-shrink-0 w-full h-32 z-30 bg-transparent flex items-center justify-between px-8 pb-4">
         <div className="flex gap-4">
             <button 
                onPointerDown={() => handleTouchStart('left')} 
                onPointerUp={() => handleTouchEnd('left')}
                onPointerLeave={() => handleTouchEnd('left')}
                className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center active:bg-white/30"
             >
                 <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
             </button>
             <button 
                onPointerDown={() => handleTouchStart('right')} 
                onPointerUp={() => handleTouchEnd('right')}
                onPointerLeave={() => handleTouchEnd('right')}
                className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center active:bg-white/30"
             >
                 <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
             </button>
         </div>
         
         <button 
             onPointerDown={() => handleTouchStart('jump')} 
             onPointerUp={() => handleTouchEnd('jump')}
             onPointerLeave={() => handleTouchEnd('jump')}
             className="w-24 h-24 bg-yellow-600/20 border-2 border-yellow-500 rounded-full flex items-center justify-center active:bg-yellow-500/50"
         >
             <span className="text-yellow-500 font-bold tracking-widest">JUMP</span>
         </button>
      </div>
    </div>
  );
};

export default PlatformerGame;