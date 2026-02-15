import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface LevelDevilGameProps {
  onBack: () => void;
}

const PLAYER_SIZE = 20;
const GRAVITY = 0.6;
const JUMP_FORCE = -10;
const SPEED = 4;

interface Entity {
  x: number;
  y: number;
  w: number;
  h: number;
}

// 0: Air, 1: Block, 2: Spike, 3: Goal, 4: Moving Spike (Horizontal), 5: Disappearing Block
type TileType = 0 | 1 | 2 | 3 | 4 | 5;

interface LevelData {
  layout: string[];
  start: { x: number, y: number };
}

const LEVELS: LevelData[] = [
  // Level 1: The Basics (with a tiny troll)
  {
    layout: [
      "....................",
      "....................",
      "....................",
      "S..................G",
      "#####..###..###..###",
      "#####..###..###..###"
    ],
    start: {x: 0, y: 3}
  },
  // Level 2: The Spike Surprise
  {
    layout: [
      "....................",
      "....................",
      "......^.............", // Surprise spike
      "S.....#.........^..G",
      "#######.....########",
      "#######.....########"
    ],
    start: {x: 0, y: 3}
  },
  // Level 3: Don't Trust the Floor
  {
    layout: [
      "....................",
      "....................",
      "...................G",
      "S...####...####...##",
      "####....###....###..", // Pitfalls
      "####....###....###.."
    ],
    start: {x: 0, y: 3}
  },
  // Level 4: Moving Hazards
  {
    layout: [
      "....................",
      "....................",
      "...M.......M.......G",
      "S..#.......#.......#",
      "####.......#.......#",
      "####.......#.......#"
    ],
    start: {x: 0, y: 3}
  }
];

const LevelDevilGame: React.FC<LevelDevilGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(0);
  const [deaths, setDeaths] = useState(0);
  
  // Game State
  const gameState = useRef({
    player: { x: 50, y: 50, vx: 0, vy: 0, grounded: false },
    keys: { left: false, right: false, up: false },
    platforms: [] as (Entity & { type: TileType, originalType?: TileType, timer?: number })[],
    goal: { x: 0, y: 0, w: 40, h: 40 },
    hazards: [] as (Entity & { dx?: number })[],
    frame: 0
  });

  const loadLevel = useCallback((lvlIdx: number) => {
    const currentLvl = LEVELS[lvlIdx % LEVELS.length];
    const tileSize = 40;
    
    gameState.current.platforms = [];
    gameState.current.hazards = [];
    
    // Parse Layout
    currentLvl.layout.forEach((row, r) => {
        for(let c=0; c<row.length; c++) {
            const char = row[c];
            const x = c * tileSize;
            const y = r * tileSize;
            
            if (char === '#') {
                gameState.current.platforms.push({ x, y, w: tileSize, h: tileSize, type: 1 });
            } else if (char === '^') {
                gameState.current.hazards.push({ x, y: y + 20, w: tileSize, h: tileSize/2 }); // Spike is shorter
            } else if (char === 'M') {
                // Moving Spike
                gameState.current.hazards.push({ x, y: y + 10, w: tileSize, h: tileSize - 10, dx: 2 }); 
            } else if (char === 'G') {
                gameState.current.goal = { x, y, w: tileSize, h: tileSize };
            } else if (char === 'S') {
                gameState.current.player.x = x;
                gameState.current.player.y = y;
                gameState.current.player.vx = 0;
                gameState.current.player.vy = 0;
            }
        }
    });

  }, []);

  useEffect(() => {
    loadLevel(level);
  }, [level, loadLevel]);

  // AABB Collision
  const checkCollision = (r1: Entity, r2: Entity) => {
      return (r1.x < r2.x + r2.w &&
              r1.x + r1.w > r2.x &&
              r1.y < r2.y + r2.h &&
              r1.y + r1.h > r2.y);
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    state.frame++;

    // Movement
    if (state.keys.left) state.player.vx = -SPEED;
    else if (state.keys.right) state.player.vx = SPEED;
    else state.player.vx = 0;

    // Jump
    if (state.keys.up && state.player.grounded) {
        state.player.vy = JUMP_FORCE;
        state.player.grounded = false;
        // audioController.playEatSound(); 
    }

    // Apply Gravity
    state.player.vy += GRAVITY;
    
    // Apply Horizontal Velocity
    state.player.x += state.player.vx;
    
    // Horizontal Collisions
    const playerRect = { x: state.player.x, y: state.player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
    
    state.platforms.forEach(plat => {
        if (checkCollision(playerRect, plat)) {
            // Determine side
            if (state.player.vx > 0) {
                state.player.x = plat.x - PLAYER_SIZE;
            } else if (state.player.vx < 0) {
                state.player.x = plat.x + plat.w;
            }
        }
    });

    // Apply Vertical Velocity
    state.player.y += state.player.vy;
    playerRect.x = state.player.x;
    playerRect.y = state.player.y; // Update rect

    state.player.grounded = false;
    state.platforms.forEach(plat => {
        if (checkCollision(playerRect, plat)) {
            if (state.player.vy > 0) {
                // Landing
                state.player.y = plat.y - PLAYER_SIZE;
                state.player.grounded = true;
                state.player.vy = 0;
            } else if (state.player.vy < 0) {
                // Hitting head
                state.player.y = plat.y + plat.h;
                state.player.vy = 0;
            }
        }
    });

    // Update Moving Hazards
    state.hazards.forEach(haz => {
        if (haz.dx) {
            haz.x += haz.dx;
            // Simple bounce logic bounds check (arbitrary 100px range for simplicity)
            // Or just bounce off platforms? Let's just oscillate
            if (Math.sin(state.frame / 20) > 0.95) haz.dx = -haz.dx!; // Rough oscillation hack
        }
    });

    // Check Hazard Collision (Death)
    let died = false;
    state.hazards.forEach(haz => {
        // Shrink hazard hitbox slightly
        const hazardRect = { x: haz.x + 5, y: haz.y + 5, w: haz.w - 10, h: haz.h - 5 };
        if (checkCollision(playerRect, hazardRect)) {
            died = true;
        }
    });

    // Fall off world
    if (state.player.y > canvas.height) died = true;

    if (died) {
        audioController.playGameOverSound();
        setDeaths(d => d + 1);
        loadLevel(level); // Reset
    }

    // Check Goal
    if (checkCollision(playerRect, state.goal)) {
        audioController.playEatSound();
        setLevel(l => l + 1);
    }

  }, [level, loadLevel]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const state = gameState.current;

    // Draw Platforms
    ctx.fillStyle = '#333';
    state.platforms.forEach(plat => {
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        // Detail
        ctx.strokeStyle = '#555';
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
    });

    // Draw Hazards
    ctx.fillStyle = '#ef4444'; // Red spikes
    state.hazards.forEach(haz => {
        ctx.beginPath();
        // Spike Triangle shape
        ctx.moveTo(haz.x, haz.y + haz.h);
        ctx.lineTo(haz.x + haz.w/2, haz.y);
        ctx.lineTo(haz.x + haz.w, haz.y + haz.h);
        ctx.fill();
    });

    // Draw Goal
    ctx.fillStyle = '#fbbf24'; // Gold
    ctx.fillRect(state.goal.x, state.goal.y, state.goal.w, state.goal.h);
    // Glow
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 20;
    ctx.fillRect(state.goal.x + 5, state.goal.y + 5, state.goal.w - 10, state.goal.h - 10);
    ctx.shadowBlur = 0;

    // Draw Player
    ctx.fillStyle = '#fff';
    ctx.fillRect(state.player.x, state.player.y, PLAYER_SIZE, PLAYER_SIZE);
    // Troll Face Eyes (simple)
    ctx.fillStyle = '#000';
    if (state.player.vx > 0) {
        ctx.fillRect(state.player.x + 12, state.player.y + 5, 4, 4);
    } else {
        ctx.fillRect(state.player.x + 4, state.player.y + 5, 4, 4);
    }


  }, []);

  // Loop
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
  const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gameState.current.keys.left = true;
      if (e.key === 'ArrowRight') gameState.current.keys.right = true;
      if (e.key === 'ArrowUp' || e.code === 'Space') gameState.current.keys.up = true;
  };

  const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gameState.current.keys.left = false;
      if (e.key === 'ArrowRight') gameState.current.keys.right = false;
      if (e.key === 'ArrowUp' || e.code === 'Space') gameState.current.keys.up = false;
  };

  useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, []);

  // Touch Controls
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

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-black touch-none">
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">Menu</button>
         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-red-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{level + 1}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-red-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Deaths</span>
                <span className="text-3xl text-red-500 font-light tracking-tight opacity-80">{deaths}</span>
            </div>
         </div>
         <button onClick={() => loadLevel(level)} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">RESET</button>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0 bg-[#111]">
         <div className="relative border-2 border-red-900 shadow-[0_0_30px_rgba(220,38,38,0.2)] rounded-lg overflow-hidden">
             <canvas 
                ref={canvasRef}
                width={800}
                height={240} // Wide aspect for platformer
                className="w-full max-w-[800px] h-auto bg-[#000]"
             />
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
             className="w-24 h-24 bg-red-600/20 border-2 border-red-500 rounded-full flex items-center justify-center active:bg-red-500/50"
         >
             <span className="text-red-500 font-bold tracking-widest">JUMP</span>
         </button>
      </div>
    </div>
  );
};

export default LevelDevilGame;
