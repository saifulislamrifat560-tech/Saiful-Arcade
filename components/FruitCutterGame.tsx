import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface FruitCutterGameProps {
  onBack: () => void;
}

const GRAVITY = 0.15;
const INITIAL_LIVES = 3;

interface GameObject {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: 'fruit' | 'bomb';
  rotation: number;
  rotationSpeed: number;
  sliced: boolean;
  lifeTime: number; // For fading out after slice
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

const FruitCutterGame: React.FC<FruitCutterGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  
  // Game State
  const gameState = useRef({
    objects: [] as GameObject[],
    particles: [] as Particle[],
    trail: [] as TrailPoint[],
    isMouseDown: false,
    activePointerId: null as number | null,
    spawnTimer: 0,
    isPlaying: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('slice-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const initGame = useCallback(() => {
    gameState.current = {
      objects: [],
      particles: [],
      trail: [],
      isMouseDown: false,
      activePointerId: null,
      spawnTimer: 0,
      isPlaying: true
    };
    setScore(0);
    setLives(INITIAL_LIVES);
    setGameOver(false);
  }, []);

  const spawnObject = (canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      const isBomb = Math.random() < 0.15 + (Math.min(score, 100) * 0.002); // Bomb chance increases slightly
      
      const radius = 25 + Math.random() * 15;
      const x = 50 + Math.random() * (canvas.width - 100);
      const y = canvas.height + radius;
      
      // Calculate velocity to throw towards center area
      const targetX = canvas.width / 2 + (Math.random() - 0.5) * 200;
      const flightTime = 90 + Math.random() * 30; // Frames to reach near top
      
      const vx = (targetX - x) / flightTime;
      const vy = - (11 + Math.random() * 4); // Upward force

      state.objects.push({
          id: Math.random(),
          x, y, vx, vy, radius,
          color: isBomb ? '#fff' : `hsl(${Math.random() * 360}, 100%, 50%)`,
          type: isBomb ? 'bomb' : 'fruit',
          rotation: 0,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          sliced: false,
          lifeTime: 1
      });
  };

  const createExplosion = (x: number, y: number, color: string, isBomb: boolean) => {
      const count = isBomb ? 40 : 15;
      for(let i=0; i<count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * (isBomb ? 15 : 8);
          gameState.current.particles.push({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: isBomb ? (Math.random() > 0.5 ? '#fff' : '#f00') : color,
              life: 1.0,
              size: Math.random() * 4 + 1
          });
      }
  };

  // Line segment to Circle collision
  const checkSlice = (p1: TrailPoint, p2: TrailPoint, obj: GameObject) => {
      if (obj.sliced) return false;
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx*dx + dy*dy;
      
      // Safety: Ignore if points are same or massive jump (glitch/multitouch artifact)
      if (lenSq === 0 || lenSq > 300 * 300) return false;

      const t = Math.max(0, Math.min(1, ((obj.x - p1.x) * dx + (obj.y - p1.y) * dy) / lenSq));
      
      const closestX = p1.x + t * dx;
      const closestY = p1.y + t * dy;
      
      const distSq = (obj.x - closestX)**2 + (obj.y - closestY)**2;
      return distSq < obj.radius**2;
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      if (!state.isPlaying) return;

      // Spawning
      state.spawnTimer++;
      const spawnRate = Math.max(20, 60 - Math.floor(score / 5)); // Faster over time
      if (state.spawnTimer > spawnRate) {
          spawnObject(canvas);
          state.spawnTimer = 0;
          // Chance to spawn burst
          if (Math.random() < 0.1) spawnObject(canvas); 
      }

      // Physics & Logic
      for (let i = state.objects.length - 1; i >= 0; i--) {
          const obj = state.objects[i];
          
          obj.x += obj.vx;
          obj.y += obj.vy;
          obj.vy += GRAVITY;
          obj.rotation += obj.rotationSpeed;

          // Remove if off screen
          if (obj.y > canvas.height + obj.radius + 50) {
              if (obj.type === 'fruit' && !obj.sliced) {
                  // Missed fruit
                  setLives(l => {
                      const newLives = l - 1;
                      if (newLives <= 0) {
                          setGameOver(true);
                          state.isPlaying = false;
                          audioController.playGameOverSound();
                      }
                      return newLives;
                  });
              }
              state.objects.splice(i, 1);
              continue;
          }

          // Slice Detection
          if (state.isMouseDown && !obj.sliced && state.trail.length >= 2) {
              const p1 = state.trail[state.trail.length - 2];
              const p2 = state.trail[state.trail.length - 1];
              
              if (checkSlice(p1, p2, obj)) {
                  if (obj.type === 'bomb') {
                      // Game Over
                      obj.sliced = true;
                      createExplosion(obj.x, obj.y, '#fff', true);
                      setGameOver(true);
                      state.isPlaying = false;
                      audioController.playGameOverSound();
                  } else {
                      // Fruit Sliced
                      obj.sliced = true;
                      obj.vx *= 0.5; // Slow down fall slightly
                      createExplosion(obj.x, obj.y, obj.color, false);
                      setScore(s => {
                          const newScore = s + 10;
                          if (newScore > highScore) {
                              setHighScore(newScore);
                              localStorage.setItem('slice-highscore', newScore.toString());
                          }
                          return newScore;
                      });
                      audioController.playEatSound();
                  }
              }
          }
      }

      // Cleanup sliced objects faster
      state.objects = state.objects.filter(obj => !obj.sliced || (obj.lifeTime -= 0.1) > 0);

      // Particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
          const p = state.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.2; // Gravity
          p.life -= 0.02;
          if (p.life <= 0) state.particles.splice(i, 1);
      }

      // Trail decay
      if (state.trail.length > 0) {
          for (let i = 0; i < state.trail.length; i++) {
              state.trail[i].life -= 0.15;
          }
          state.trail = state.trail.filter(t => t.life > 0);
      }

  }, [score, highScore]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Trail
      if (state.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(state.trail[0].x, state.trail[0].y);
          for (let i = 1; i < state.trail.length; i++) {
              ctx.lineTo(state.trail[i].x, state.trail[i].y);
          }
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#06b6d4';
          ctx.stroke();
          ctx.shadowBlur = 0;
          
          // White core
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
      }

      // Draw Objects
      state.objects.forEach(obj => {
          ctx.save();
          ctx.translate(obj.x, obj.y);
          ctx.rotate(obj.rotation);
          
          if (obj.sliced) {
              // Draw split halves effect (fading out)
              ctx.globalAlpha = obj.lifeTime;
              ctx.fillStyle = obj.color;
              // Left half
              ctx.beginPath();
              ctx.arc(-5, 0, obj.radius, Math.PI/2, Math.PI*1.5);
              ctx.fill();
              // Right half
              ctx.beginPath();
              ctx.arc(5, 0, obj.radius, Math.PI*1.5, Math.PI/2);
              ctx.fill();
              ctx.globalAlpha = 1;
          } else {
              if (obj.type === 'bomb') {
                  // Draw Bomb
                  ctx.fillStyle = '#111';
                  ctx.beginPath();
                  ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Spikes
                  ctx.strokeStyle = '#f00';
                  ctx.lineWidth = 3;
                  for(let i=0; i<8; i++) {
                      ctx.beginPath();
                      ctx.moveTo(0,0);
                      const a = (i / 8) * Math.PI * 2;
                      ctx.lineTo(Math.cos(a) * (obj.radius + 5), Math.sin(a) * (obj.radius + 5));
                      ctx.stroke();
                  }
                  
                  // Pulse core
                  const pulse = 1 + Math.sin(Date.now() / 100) * 0.2;
                  ctx.fillStyle = '#f00';
                  ctx.beginPath();
                  ctx.arc(0, 0, obj.radius * 0.4 * pulse, 0, Math.PI * 2);
                  ctx.fill();

              } else {
                  // Draw Fruit (Neon Shape)
                  ctx.shadowBlur = 20;
                  ctx.shadowColor = obj.color;
                  ctx.fillStyle = obj.color; // Fill for neon look
                  
                  ctx.beginPath();
                  ctx.arc(0, 0, obj.radius, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Inner glow ring
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(0, 0, obj.radius * 0.8, 0, Math.PI * 2);
                  ctx.stroke();
                  
                  ctx.shadowBlur = 0;
              }
          }
          ctx.restore();
      });

      // Draw Particles
      state.particles.forEach(p => {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
      });

  }, []);

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    const resize = () => {
        if (canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
        }
    };
    resize();
    window.addEventListener('resize', resize);

    initGame();

    let animId: number;
    const render = () => {
        update(canvas);
        draw(ctx, canvas);
        animId = requestAnimationFrame(render);
    };
    render();
    
    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animId);
    };
  }, [draw, update, initGame]);

  // Input Handling
  const handlePointerDown = (e: React.PointerEvent) => {
      const state = gameState.current;
      // Prevent multi-touch glitches (ignore extra fingers)
      if (state.activePointerId !== null) return;

      state.activePointerId = e.pointerId;
      state.isMouseDown = true;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      state.trail = [{ x, y, life: 1.0 }];
      
      // Capture pointer for better tracking
      canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      const state = gameState.current;
      // Only track the initial active pointer
      if (!state.isMouseDown || e.pointerId !== state.activePointerId) return;
      
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Add point if distance is enough (perf optimization)
      const last = state.trail[state.trail.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) > 5) {
          state.trail.push({ x, y, life: 1.0 });
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      const state = gameState.current;
      if (e.pointerId === state.activePointerId) {
          state.isMouseDown = false;
          state.activePointerId = null;
          // Don't clear trail immediately, let it fade out visually
          canvasRef.current?.releasePointerCapture(e.pointerId);
      }
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-black touch-none">
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20 pointer-events-none">
         <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1 pointer-events-auto">Menu</button>
         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight">{score}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Lives</span>
                <div className="flex gap-1 mt-2">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full ${i < lives ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-gray-800'}`} />
                    ))}
                </div>
            </div>
         </div>
         <button onClick={(e) => { e.stopPropagation(); initGame(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors pointer-events-auto">RESET</button>
      </div>

      {/* Game Area */}
      <div className="flex-1 w-full h-full relative overflow-hidden bg-gradient-to-b from-slate-900 to-black">
          <canvas 
            ref={canvasRef}
            className="w-full h-full cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          
          {/* Game Over Overlay */}
          {gameOver && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 animate-[fadeIn_0.3s_ease-out] pointer-events-none">
                <div className="text-center pointer-events-auto p-8 rounded-2xl border border-white/10 bg-black/50">
                   <h2 className="text-5xl text-red-500 font-bold uppercase tracking-widest drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] mb-4">Game Over</h2>
                   <p className="text-white text-xl font-mono tracking-widest mb-2">SCORE: {score}</p>
                   <p className="text-cyan-500/50 text-sm tracking-[0.2em] mb-8">BEST: {highScore}</p>
                   <button 
                      onClick={initGame} 
                      className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-[0.2em] rounded shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                   >
                      PLAY AGAIN
                   </button>
                </div>
             </div>
          )}
          
          {!gameOver && score === 0 && (
              <div className="absolute top-1/3 w-full text-center pointer-events-none opacity-50 animate-pulse">
                  <p className="text-white text-lg tracking-[0.5em] uppercase">Swipe to Slice!</p>
                  <p className="text-red-500 text-xs tracking-[0.2em] mt-2 uppercase">Don't touch the bombs</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default FruitCutterGame;
