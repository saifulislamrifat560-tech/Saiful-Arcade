import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface JumpGameProps {
  onBack: () => void;
}

const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const PLAYER_SIZE = 15;
const PLATFORM_WIDTH = 60;
const PLATFORM_HEIGHT = 15;
const MOVE_SPEED = 7;

interface Platform {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'STATIC' | 'MOVING' | 'BREAKABLE';
  vx: number;
  active: boolean;
}

const JumpGame: React.FC<JumpGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  const gameState = useRef({
    player: { x: 0, y: 0, vx: 0, vy: 0 },
    platforms: [] as Platform[],
    cameraY: 0,
    score: 0,
    isPlaying: false,
    keys: { left: false, right: false },
    touchX: null as number | null,
    highestY: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem('jump-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Initial Platforms
    const platforms: Platform[] = [];
    // Base platform
    platforms.push({
        id: 0, x: canvas.width/2 - PLATFORM_WIDTH/2, y: canvas.height - 50, 
        w: PLATFORM_WIDTH, h: PLATFORM_HEIGHT, type: 'STATIC', vx: 0, active: true
    });

    // Generate starting platforms
    let y = canvas.height - 150;
    for(let i=0; i<10; i++) {
        platforms.push(generatePlatform(y, canvas.width));
        y -= 100; // Gap between platforms
    }

    gameState.current = {
      player: { x: canvas.width/2, y: canvas.height - 150, vx: 0, vy: 0 },
      platforms: platforms,
      cameraY: 0,
      score: 0,
      isPlaying: true,
      keys: { left: false, right: false },
      touchX: null,
      highestY: 0
    };
    
    setScore(0);
    setGameOver(false);
  }, []);

  const generatePlatform = (y: number, screenWidth: number): Platform => {
      const typeRoll = Math.random();
      let type: 'STATIC' | 'MOVING' | 'BREAKABLE' = 'STATIC';
      if (typeRoll > 0.8) type = 'MOVING';
      else if (typeRoll > 0.95) type = 'BREAKABLE'; // Rare

      return {
          id: Math.random(),
          x: Math.random() * (screenWidth - PLATFORM_WIDTH),
          y: y,
          w: PLATFORM_WIDTH,
          h: PLATFORM_HEIGHT,
          type: type,
          vx: type === 'MOVING' ? (Math.random() > 0.5 ? 2 : -2) : 0,
          active: true
      };
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    if (!state.isPlaying) return;

    const p = state.player;

    // Input Handling (Keyboard + Touch)
    if (state.keys.left) p.vx = -MOVE_SPEED;
    else if (state.keys.right) p.vx = MOVE_SPEED;
    else if (state.touchX !== null) {
        // Smooth follow touch
        const diff = state.touchX - p.x;
        if (Math.abs(diff) > 5) {
            p.vx = Math.sign(diff) * MOVE_SPEED;
        } else {
            p.vx = 0;
        }
    } else {
        p.vx *= 0.8; // Friction
    }

    // Physics
    p.x += p.vx;
    p.vy += GRAVITY;
    p.y += p.vy;

    // Screen Wrap
    if (p.x > canvas.width) p.x = 0;
    else if (p.x < 0) p.x = canvas.width;

    // Camera Scroll (Only goes up)
    // We want the player to stay around the middle/lower-middle of the screen
    const targetCameraY = p.y - canvas.height * 0.5;
    if (targetCameraY < state.cameraY) {
        state.cameraY = targetCameraY;
        // Score based on height
        const heightScore = Math.floor(-state.cameraY / 10);
        if (heightScore > state.score) {
            state.score = heightScore;
            setScore(state.score);
        }
    }

    // Platform Logic
    state.platforms.forEach(plat => {
        if (!plat.active) return;

        // Move Moving Platforms
        if (plat.type === 'MOVING') {
            plat.x += plat.vx;
            if (plat.x <= 0 || plat.x + plat.w >= canvas.width) plat.vx *= -1;
        }

        // Bounce Collision
        // Only bounce if falling AND hitting top of platform
        if (p.vy > 0 && 
            p.y + PLAYER_SIZE/2 >= plat.y && 
            p.y + PLAYER_SIZE/2 <= plat.y + plat.h + 10 && // Tolerance
            p.x + PLAYER_SIZE/2 > plat.x && 
            p.x - PLAYER_SIZE/2 < plat.x + plat.w) {
            
            if (plat.type === 'BREAKABLE') {
                plat.active = false;
                audioController.playEatSound(); // Break sound
                p.vy = GRAVITY; // No bounce, just fall through (or small bounce?) Standard is break and fall.
            } else {
                p.vy = JUMP_FORCE;
                audioController.playEatSound();
            }
        }
    });

    // Generate new platforms & Cleanup old
    // If camera moved up, we might need new platforms at the top (smaller Y)
    // Top-most platform Y
    const topPlat = state.platforms[state.platforms.length - 1];
    if (topPlat.y > state.cameraY - 100) {
        // Need more platforms
        state.platforms.push(generatePlatform(topPlat.y - 100 - Math.random()*40, canvas.width));
    }

    // Remove platforms below screen
    const screenBottom = state.cameraY + canvas.height;
    state.platforms = state.platforms.filter(plat => plat.y < screenBottom + 100);

    // Game Over
    if (p.y > screenBottom) {
        state.isPlaying = false;
        setGameOver(true);
        audioController.playGameOverSound();
        if (state.score > highScore) {
            setHighScore(state.score);
            localStorage.setItem('jump-highscore', state.score.toString());
        }
    }

  }, [highScore]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const state = gameState.current;

    ctx.save();
    // Apply Camera
    // We shift everything DOWN by -cameraY (since cameraY is negative going up)
    ctx.translate(0, -state.cameraY);

    // Draw Platforms
    state.platforms.forEach(plat => {
        if (!plat.active) return;
        
        ctx.fillStyle = plat.type === 'MOVING' ? '#3b82f6' : (plat.type === 'BREAKABLE' ? '#fff' : '#22c55e');
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(plat.x, plat.y, plat.w, 4);
        
        ctx.shadowBlur = 0;
    });

    // Draw Player
    const p = state.player;
    ctx.fillStyle = '#f472b6'; // Pink
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#f472b6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_SIZE, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes (direction based)
    ctx.fillStyle = 'white';
    const lookDir = p.vx >= 0 ? 1 : -1;
    ctx.beginPath(); ctx.arc(p.x + (4*lookDir), p.y - 4, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + (10*lookDir), p.y - 4, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.arc(p.x + (5*lookDir), p.y - 4, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + (11*lookDir), p.y - 4, 1.5, 0, Math.PI*2); ctx.fill();

    ctx.restore();

    // Score HUD (Fixed position)
    // Already handled by React State UI, but we can draw it here too if needed?
    // Nah, React UI is fine.

  }, []);

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    const handleResize = () => {
        if (canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    
    initGame();

    let animId: number;
    const render = () => {
        update(canvas);
        draw(ctx, canvas);
        animId = requestAnimationFrame(render);
    };
    render();
    
    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animId);
    };
  }, [draw, update, initGame]);

  // Input
  const handlePointerDown = (e: React.PointerEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      gameState.current.touchX = x;
      canvasRef.current?.setPointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
      if (gameState.current.touchX !== null) {
        const rect = canvasRef.current!.getBoundingClientRect();
        gameState.current.touchX = e.clientX - rect.left;
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      gameState.current.touchX = null;
      gameState.current.keys.left = false;
      gameState.current.keys.right = false;
      canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  // Keyboard
  useEffect(() => {
      const down = (e: KeyboardEvent) => {
          if (e.key === 'ArrowLeft') gameState.current.keys.left = true;
          if (e.key === 'ArrowRight') gameState.current.keys.right = true;
      };
      const up = (e: KeyboardEvent) => {
          if (e.key === 'ArrowLeft') gameState.current.keys.left = false;
          if (e.key === 'ArrowRight') gameState.current.keys.right = false;
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
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20 pointer-events-none">
         <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1 pointer-events-auto">Menu</button>
         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-pink-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight">{score}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-pink-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Best</span>
                <span className="text-3xl text-pink-50 font-light tracking-tight opacity-80">{highScore}</span>
            </div>
         </div>
         <button onClick={(e) => { e.stopPropagation(); initGame(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors pointer-events-auto">RESET</button>
      </div>

      {/* Game Area */}
      <div className="flex-1 w-full flex items-center justify-center p-0 min-h-0 relative">
          <canvas 
            ref={canvasRef}
            className="w-full h-full bg-gradient-to-b from-slate-900 to-black cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          
          {/* Game Over Overlay */}
          {gameOver && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                <div className="bg-black/80 backdrop-blur-md p-8 rounded-2xl flex flex-col items-center animate-[pop_0.3s_ease-out] pointer-events-auto border border-pink-500/30">
                   <h2 className="text-5xl font-bold text-pink-500 mb-2 tracking-widest uppercase drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]">Fell Down</h2>
                   <p className="text-white text-sm tracking-[0.2em] mb-6">BEST SCORE: {highScore}</p>
                   <button 
                     onClick={initGame}
                     className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold tracking-[0.2em] rounded shadow-lg transition-all active:scale-95"
                   >
                     TRY AGAIN
                   </button>
                </div>
             </div>
          )}
          
          {!gameOver && score === 0 && (
              <div className="absolute top-1/2 w-full text-center pointer-events-none opacity-50 animate-pulse">
                 <p className="text-white text-xs tracking-[0.5em] uppercase">DRAG TO MOVE</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default JumpGame;