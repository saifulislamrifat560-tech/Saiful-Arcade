import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface BrickBreakerGameProps {
  onBack: () => void;
}

// --- Game Constants ---
const PADDLE_HEIGHT = 12;
const PADDLE_WIDTH_INITIAL = 100;
const BALL_RADIUS = 6;
const BRICK_ROW_COUNT = 6;
const BRICK_PADDING = 8;
const BRICK_OFFSET_TOP = 50;
const BRICK_OFFSET_LEFT = 20;
const INITIAL_LIVES = 3;

interface GameObject {
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  dx?: number;
  dy?: number;
  color?: string;
  active?: boolean;
  life?: number; // For particles
}

interface Brick extends GameObject {
  status: number; // 1 = active, 0 = broken
}

const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#a855f7', // Purple
];

const BrickBreakerGame: React.FC<BrickBreakerGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER' | 'WIN'>('IDLE');

  // Mutable Game State
  const gameState = useRef({
    paddle: { x: 0, y: 0, w: PADDLE_WIDTH_INITIAL, h: PADDLE_HEIGHT },
    ball: { x: 0, y: 0, dx: 0, dy: 0, radius: BALL_RADIUS, active: false },
    bricks: [] as Brick[],
    particles: [] as GameObject[],
    lives: INITIAL_LIVES, 
    brickWidth: 0,
    brickHeight: 20,
    isResetting: false, 
  });

  useEffect(() => {
    const saved = localStorage.getItem('breaker-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Initialization ---
  const initLevel = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    
    // Calculate brick layout
    const availableWidth = canvas.width - (2 * BRICK_OFFSET_LEFT);
    // Determine columns based on width (approx 60px per brick)
    const colCount = Math.floor(availableWidth / 60);
    state.brickWidth = (availableWidth - (colCount - 1) * BRICK_PADDING) / colCount;
    
    state.bricks = [];
    for(let c=0; c<colCount; c++) {
        for(let r=0; r<BRICK_ROW_COUNT; r++) {
            state.bricks.push({
                x: BRICK_OFFSET_LEFT + c * (state.brickWidth + BRICK_PADDING),
                y: BRICK_OFFSET_TOP + r * (state.brickHeight + BRICK_PADDING),
                status: 1,
                color: COLORS[r % COLORS.length]
            });
        }
    }
  }, []);

  const resetBall = useCallback((canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      state.isResetting = false;
      state.ball.x = canvas.width / 2;
      state.ball.y = canvas.height - 40;
      // Randomize launch angle slightly
      state.ball.dx = 4 * (Math.random() > 0.5 ? 1 : -1);
      state.ball.dy = -4;
      
      // Center paddle
      state.paddle.x = (canvas.width - state.paddle.w) / 2;
      state.paddle.y = canvas.height - 30;
      
      state.ball.active = true;
  }, []);

  const startGame = useCallback(() => {
     if (!canvasRef.current) return;
     const canvas = canvasRef.current;
     setScore(0);
     gameState.current.lives = INITIAL_LIVES;
     gameState.current.isResetting = false;
     setLives(INITIAL_LIVES);
     initLevel(canvas);
     resetBall(canvas);
     setGameStatus('PLAYING');
  }, [initLevel, resetBall]);

  const spawnParticles = (x: number, y: number, color: string) => {
      for(let i=0; i<8; i++) {
          gameState.current.particles.push({
              x, y, w: Math.random() * 3 + 1, h: Math.random() * 3 + 1,
              dx: (Math.random() - 0.5) * 4,
              dy: (Math.random() - 0.5) * 4,
              life: 30,
              color,
              active: true
          });
      }
  };

  // --- Game Loop ---
  const update = useCallback((canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      if (gameStatus !== 'PLAYING') return;
      
      // ALWAYS allow particles to update
      state.particles.forEach(p => {
          if (p.active && p.dx !== undefined && p.dy !== undefined && p.life !== undefined) {
              p.x += p.dx;
              p.y += p.dy;
              p.life--;
              if (p.life <= 0) p.active = false;
          }
      });
      state.particles = state.particles.filter(p => p.active);

      // If resetting, skip ball logic but allow rendering
      if (state.isResetting) return;

      // 1. Move Ball
      if (state.ball.active) {
          state.ball.x += state.ball.dx;
          state.ball.y += state.ball.dy;

          // Wall Collisions
          if (state.ball.x + state.ball.radius > canvas.width || state.ball.x - state.ball.radius < 0) {
              state.ball.dx = -state.ball.dx;
              audioController.playEatSound();
          }
          if (state.ball.y - state.ball.radius < 0) {
              state.ball.dy = -state.ball.dy;
              audioController.playEatSound();
          }
          
          // Paddle Collision
          if (
              state.ball.y + state.ball.radius >= state.paddle.y &&
              state.ball.y - state.ball.radius <= state.paddle.y + state.paddle.h &&
              state.ball.x >= state.paddle.x &&
              state.ball.x <= state.paddle.x + state.paddle.w
          ) {
              // Only bounce if coming downwards
              if (state.ball.dy > 0) {
                  state.ball.dy = -state.ball.dy;
                  
                  // Add spin/angle based on where it hit the paddle
                  const hitPoint = state.ball.x - (state.paddle.x + state.paddle.w/2);
                  state.ball.dx = hitPoint * 0.15; 
                  
                  // Increase speed slightly
                  const speedMultiplier = 1.02;
                  state.ball.dx *= speedMultiplier;
                  state.ball.dy *= speedMultiplier;

                  // Cap speed
                  const maxSpeed = 10;
                  if (Math.abs(state.ball.dx) > maxSpeed) state.ball.dx = maxSpeed * Math.sign(state.ball.dx);
                  if (Math.abs(state.ball.dy) > maxSpeed) state.ball.dy = maxSpeed * Math.sign(state.ball.dy);

                  audioController.playEatSound();
              }
          }

          // Floor Collision (Death)
          if (state.ball.y - state.ball.radius > canvas.height) { 
              state.ball.active = false; // Stop moving
              state.isResetting = true;  // Block updates momentarily
              
              // Logic
              state.lives -= 1;
              setLives(state.lives); 
              
              if (state.lives <= 0) {
                  setGameStatus('GAME_OVER');
                  audioController.playGameOverSound();
              } else {
                  // Delay reset
                  setTimeout(() => {
                      if (gameState.current.lives > 0) {
                          resetBall(canvas);
                      }
                  }, 1000);
              }
          }
      }

      // 2. Brick Collision
      let activeBricks = 0;
      state.bricks.forEach(b => {
          if (b.status === 1) {
              activeBricks++;
              if (
                  state.ball.x > b.x &&
                  state.ball.x < b.x + state.brickWidth &&
                  state.ball.y > b.y &&
                  state.ball.y < b.y + state.brickHeight
              ) {
                  state.ball.dy = -state.ball.dy;
                  b.status = 0;
                  setScore(prev => {
                      const newScore = prev + 10;
                      if (newScore > highScore) {
                          setHighScore(newScore);
                          localStorage.setItem('breaker-highscore', newScore.toString());
                      }
                      return newScore;
                  });
                  spawnParticles(b.x + state.brickWidth/2, b.y + state.brickHeight/2, b.color || '#fff');
                  audioController.playEatSound();
              }
          }
      });

      if (activeBricks === 0) {
          // Level Cleared
          initLevel(canvas);
          resetBall(canvas);
      }

  }, [gameStatus, highScore, initLevel, resetBall]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      
      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Paddle
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#22d3ee'; // Cyan glow
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h);
      ctx.shadowBlur = 0;

      // Draw Ball (only if active)
      if (state.ball.active) {
          ctx.beginPath();
          ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.closePath();
      }

      // Draw Bricks
      state.bricks.forEach(b => {
          if (b.status === 1 && b.color) {
              ctx.shadowBlur = 5;
              ctx.shadowColor = b.color;
              ctx.fillStyle = b.color;
              ctx.fillRect(b.x, b.y, state.brickWidth, state.brickHeight);
              ctx.shadowBlur = 0;
          }
      });

      // Draw Particles
      state.particles.forEach(p => {
          if(p.color && p.w && p.h && p.life) {
             ctx.fillStyle = p.color;
             ctx.globalAlpha = p.life / 30;
             ctx.fillRect(p.x, p.y, p.w, p.h);
             ctx.globalAlpha = 1.0;
          }
      });

  }, []);

  // --- Loop & Setup ---
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

  // Resize Handler
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            
            if (gameState.current.paddle.x > width) {
                gameState.current.paddle.x = width - gameState.current.paddle.w;
            }
            if (gameStatus === 'IDLE') {
                gameState.current.paddle.y = height - 30;
                initLevel(canvasRef.current);
            } else {
                 gameState.current.paddle.y = height - 30;
            }
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gameStatus, initLevel]);

  // --- Input ---
  const handlePointerMove = (e: React.PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      
      const paddleW = gameState.current.paddle.w;
      let newX = relativeX - paddleW / 2;
      
      // Clamp
      if (newX < 0) newX = 0;
      if (newX + paddleW > canvasRef.current.width) newX = canvasRef.current.width - paddleW;
      
      gameState.current.paddle.x = newX;
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
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight">{score}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Lives</span>
                <div className="flex gap-1 mt-2">
                    {[...Array(lives)].map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
                    ))}
                </div>
            </div>
         </div>
         
         <div className="w-12"></div> 
      </div>

      {/* Game Area */}
      <div ref={containerRef} className="flex-1 w-full max-w-lg p-4 relative min-h-0">
          <canvas 
            ref={canvasRef}
            className="w-full h-full bg-[#050505] rounded-xl border border-white/10 shadow-[0_0_30px_rgba(6,182,212,0.1)] cursor-none touch-none"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
          />

          {/* Overlays */}
          {(gameStatus === 'IDLE' || gameStatus === 'GAME_OVER') && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 flex flex-col items-center pointer-events-auto shadow-2xl animate-[fadeIn_0.5s_ease-out] max-w-[85%]">
                      <h2 className="text-3xl md:text-5xl text-cyan-500 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(6,182,212,0.6)] mb-2 text-center">
                          {gameStatus === 'GAME_OVER' ? 'Systems Offline' : 'Neon Breaker'}
                      </h2>
                      {gameStatus === 'GAME_OVER' && <p className="text-white/50 text-xs md:text-sm tracking-[0.3em] mb-6">SCORE: {score}</p>}
                      {gameStatus === 'IDLE' && <p className="text-white/50 text-xs md:text-sm tracking-[0.3em] mb-8 text-center">DRAG TO CONTROL PADDLE</p>}
                      
                      <button 
                        onClick={startGame}
                        className="px-6 py-3 md:px-8 md:py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95 w-full text-sm md:text-base"
                      >
                          {gameStatus === 'GAME_OVER' ? 'REBOOT' : 'START'}
                      </button>
                  </div>
              </div>
          )}
      </div>
      
      {/* Footer Instructions */}
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Destroy all blocks</p>
      </div>

    </div>
  );
};

export default BrickBreakerGame;