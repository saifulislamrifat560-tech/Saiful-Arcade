import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface SpaceShooterGameProps {
  onBack: () => void;
}

// --- Game Constants ---
const PLAYER_SIZE = 30;
const BULLET_SIZE = 4;
const BULLET_SPEED = 10;
const ENEMY_SIZE = 25;
const SPAWN_RATE_INITIAL = 60; // Frames between spawns
const PARTICLE_LIFE = 30;

interface GameObject {
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  color?: string;
  vx?: number;
  vy?: number;
  life?: number;
}

const SpaceShooterGame: React.FC<SpaceShooterGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [highScore, setHighScore] = useState(0);

  // Mutable Game State (Refs for performance in game loop)
  const gameState = useRef({
    player: { x: 0, y: 0, w: PLAYER_SIZE, h: PLAYER_SIZE, active: true },
    bullets: [] as GameObject[],
    enemies: [] as GameObject[],
    particles: [] as GameObject[],
    stars: [] as GameObject[],
    frame: 0,
    score: 0,
    spawnRate: SPAWN_RATE_INITIAL,
    isPlaying: false,
    lastShotTime: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem('shooter-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Game Engine ---
  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Reset State
    gameState.current = {
      player: { x: canvas.width / 2, y: canvas.height - 80, w: PLAYER_SIZE, h: PLAYER_SIZE, active: true },
      bullets: [],
      enemies: [],
      particles: [],
      stars: [],
      frame: 0,
      score: 0,
      spawnRate: SPAWN_RATE_INITIAL,
      isPlaying: true,
      lastShotTime: 0
    };

    // Init Stars
    for(let i=0; i<50; i++) {
        gameState.current.stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            w: Math.random() * 2 + 1,
            h: Math.random() * 2 + 1,
            vy: Math.random() * 2 + 0.5,
            active: true
        });
    }

    setScore(0);
    setGameOver(false);
    setIsStarted(true);
  }, []);

  const spawnExplosion = (x: number, y: number, color: string) => {
      for(let i=0; i<10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 4 + 1;
          gameState.current.particles.push({
              x, y, w: 2, h: 2,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: PARTICLE_LIFE,
              color,
              active: true
          });
      }
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    if (!state.isPlaying) return;

    state.frame++;

    // 1. Spawn Enemies
    // Increase difficulty: spawn faster as score goes up
    const currentSpawnRate = Math.max(20, SPAWN_RATE_INITIAL - Math.floor(state.score / 50));
    if (state.frame % currentSpawnRate === 0) {
        state.enemies.push({
            x: Math.random() * (canvas.width - ENEMY_SIZE),
            y: -ENEMY_SIZE,
            w: ENEMY_SIZE,
            h: ENEMY_SIZE,
            vy: 2 + Math.random() * 2 + (state.score / 500), // Speed up slightly over time
            active: true,
            color: `hsl(${Math.random() * 60 + 300}, 100%, 50%)` // Pink/Purple/Red range
        });
    }

    // 2. Player Auto-Shoot (every 15 frames = ~4 times/sec)
    if (state.frame % 15 === 0) {
        state.bullets.push({
            x: state.player.x,
            y: state.player.y - 10,
            w: BULLET_SIZE,
            h: 15,
            active: true,
            color: '#06b6d4' // Cyan
        });
        // Optional: Soft shot sound? Too frequent might be annoying.
    }

    // 3. Update Bullets
    state.bullets.forEach(b => {
        b.y -= BULLET_SPEED;
        if (b.y < -10) b.active = false;
    });

    // 4. Update Enemies
    state.enemies.forEach(e => {
        if (e.vy) e.y += e.vy;
        if (e.y > canvas.height) e.active = false; // Passed player

        // Check Player Collision
        const dx = (state.player.x) - (e.x + e.w/2);
        const dy = (state.player.y) - (e.y + e.h/2);
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < (PLAYER_SIZE/2 + ENEMY_SIZE/2)) {
            state.isPlaying = false;
            setGameOver(true);
            spawnExplosion(state.player.x, state.player.y, '#06b6d4');
            audioController.playGameOverSound();
            
            // Update High Score
            if (state.score > highScore) {
                setHighScore(state.score);
                localStorage.setItem('shooter-highscore', state.score.toString());
            }
        }
    });

    // 5. Check Bullet-Enemy Collisions
    state.bullets.forEach(b => {
        if (!b.active) return;
        state.enemies.forEach(e => {
            if (!e.active) return;
            
            // Simple AABB Collision
            if (b.x < e.x + e.w &&
                b.x + b.w > e.x &&
                b.y < e.y + e.h &&
                b.y + b.h > e.y) {
                    // Hit
                    b.active = false;
                    e.active = false;
                    spawnExplosion(e.x + e.w/2, e.y + e.h/2, e.color || '#f00');
                    state.score += 10;
                    setScore(state.score);
                    // Hit Sound
                    // audioController.playEatSound(); // Use eat sound as hit sound
            }
        });
    });

    // 6. Update Particles
    state.particles.forEach(p => {
        if (p.vx) p.x += p.vx;
        if (p.vy) p.y += p.vy;
        if (p.life) p.life--;
        if (p.life && p.life <= 0) p.active = false;
    });

    // 7. Update Stars
    state.stars.forEach(s => {
        if (s.vy) s.y += s.vy;
        if (s.y > canvas.height) {
            s.y = 0;
            s.x = Math.random() * canvas.width;
        }
    });

    // Cleanup arrays
    state.bullets = state.bullets.filter(b => b.active);
    state.enemies = state.enemies.filter(e => e.active);
    state.particles = state.particles.filter(p => p.active);

  }, [highScore]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const state = gameState.current;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    state.stars.forEach(s => {
        ctx.fillRect(s.x, s.y, s.w, s.h);
    });

    // Draw Player (Triangle)
    if (state.isPlaying) {
        ctx.save();
        ctx.translate(state.player.x, state.player.y);
        ctx.beginPath();
        ctx.moveTo(0, -PLAYER_SIZE/2);
        ctx.lineTo(PLAYER_SIZE/2, PLAYER_SIZE/2);
        ctx.lineTo(0, PLAYER_SIZE/4); // Indent
        ctx.lineTo(-PLAYER_SIZE/2, PLAYER_SIZE/2);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Thruster glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#06b6d4';
        ctx.stroke();
        ctx.restore();
    }

    // Draw Bullets
    state.bullets.forEach(b => {
        ctx.fillStyle = b.color || '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color || '#fff';
        ctx.fillRect(b.x - b.w/2, b.y, b.w, b.h);
        ctx.shadowBlur = 0;
    });

    // Draw Enemies
    state.enemies.forEach(e => {
        ctx.strokeStyle = e.color || '#f00';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = e.color || '#f00';
        // Diamond shape for enemies
        ctx.beginPath();
        ctx.moveTo(e.x + e.w/2, e.y);
        ctx.lineTo(e.x + e.w, e.y + e.h/2);
        ctx.lineTo(e.x + e.w/2, e.y + e.h);
        ctx.lineTo(e.x, e.y + e.h/2);
        ctx.closePath();
        ctx.stroke();
        ctx.shadowBlur = 0;
    });

    // Draw Particles
    state.particles.forEach(p => {
        ctx.fillStyle = p.color || '#fff';
        ctx.globalAlpha = (p.life || 1) / PARTICLE_LIFE;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.globalAlpha = 1.0;
    });

  }, []);

  // --- Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
        update(canvas);
        draw(ctx, canvas);
        animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [draw, update]);

  // --- Resize Handler ---
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            // Scale for high DPI
            const dpr = window.devicePixelRatio || 1;
            canvasRef.current.width = width * dpr;
            canvasRef.current.height = height * dpr;
            
            const ctx = canvasRef.current.getContext('2d');
            if(ctx) ctx.scale(dpr, dpr);
            
            // Re-normalize css size
            canvasRef.current.style.width = `${width}px`;
            canvasRef.current.style.height = `${height}px`;

            // Keep internal game logic on a fixed coordinate system if desired, 
            // but for simple arcade, mapping 1:1 to logical pixels is fine.
            // Let's rely on standard logical pixels.
            canvasRef.current.width = width;
            canvasRef.current.height = height;
        }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Input ---
  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isStarted || gameOver) return;
      if (!canvasRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      // Update player pos immediately for responsiveness
      gameState.current.player.x = Math.max(PLAYER_SIZE, Math.min(canvasRef.current.width - PLAYER_SIZE, x));
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent touch-none">
      
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>

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
         
         <div className="w-12"></div> {/* Spacer */}
      </div>

      {/* Game Area */}
      <div ref={containerRef} className="flex-1 w-full max-w-lg p-4 relative min-h-0">
          <canvas 
            ref={canvasRef}
            className="w-full h-full bg-[#050505] rounded-xl border border-white/10 shadow-[0_0_30px_rgba(236,72,153,0.1)] cursor-crosshair touch-none"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove} // Snap to position on touch
          />
          
          {/* Start / Game Over Overlay */}
          {(!isStarted || gameOver) && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 flex flex-col items-center pointer-events-auto shadow-2xl max-w-[85%]">
                      <h2 className="text-3xl md:text-5xl text-pink-500 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(236,72,153,0.6)] mb-2 text-center">
                          {gameOver ? 'Mission Failed' : 'Galaxy Raid'}
                      </h2>
                      {gameOver && <p className="text-white/50 text-xs md:text-sm tracking-[0.3em] mb-6">FINAL SCORE: {score}</p>}
                      {!gameOver && <p className="text-white/50 text-xs md:text-sm tracking-[0.3em] mb-8 text-center">DRAG TO MOVE • AUTO FIRE</p>}
                      
                      <button 
                        onClick={initGame}
                        className="px-6 py-3 md:px-8 md:py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all active:scale-95 w-full text-sm md:text-base"
                      >
                          {gameOver ? 'RETRY' : 'LAUNCH'}
                      </button>
                  </div>
              </div>
          )}
      </div>

       {/* Footer Instructions */}
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Slide finger to pilot ship</p>
      </div>

    </div>
  );
};

export default SpaceShooterGame;