import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface PingPongGameProps {
  onBack: () => void;
}

// Constants
const PADDLE_WIDTH = 80;
const PADDLE_HEIGHT = 12;
const BALL_RADIUS = 6;
const INITIAL_BALL_SPEED = 5;

const PingPongGame: React.FC<PingPongGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');

  const gameState = useRef({
    playerX: 0, // Center based
    aiX: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0, speed: INITIAL_BALL_SPEED },
    particles: [] as {x: number, y: number, vx: number, vy: number, life: number, color: string}[],
    containerWidth: 0,
    containerHeight: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem('pong-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Logic ---

  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const { width, height } = canvasRef.current;
    
    gameState.current.playerX = width / 2;
    gameState.current.aiX = width / 2;
    gameState.current.ball = {
        x: width / 2,
        y: height / 2,
        vx: (Math.random() > 0.5 ? 1 : -1) * 3,
        vy: (Math.random() > 0.5 ? -1 : 1) * INITIAL_BALL_SPEED,
        speed: INITIAL_BALL_SPEED
    };
    gameState.current.particles = [];
    setScore(0);
  }, []);

  const startGame = useCallback(() => {
    initGame();
    setGameStatus('PLAYING');
  }, [initGame]);

  const spawnParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
        gameState.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 20,
            color
        });
    }
  };

  const update = useCallback(() => {
    if (gameStatus !== 'PLAYING' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const state = gameState.current;
    
    // 1. Move Ball
    state.ball.x += state.ball.vx;
    state.ball.y += state.ball.vy;

    // 2. Wall Collisions (Left/Right)
    if (state.ball.x - BALL_RADIUS < 0) {
        state.ball.x = BALL_RADIUS;
        state.ball.vx *= -1;
        audioController.playEatSound();
    } else if (state.ball.x + BALL_RADIUS > canvas.width) {
        state.ball.x = canvas.width - BALL_RADIUS;
        state.ball.vx *= -1;
        audioController.playEatSound();
    }

    // 3. AI Movement (Top Paddle)
    // Make AI "Human-like": Limit speed so it can't teleport to save the ball.
    // Base speed + difficulty ramp based on score.
    const targetX = state.ball.x;
    const diff = targetX - state.aiX;
    
    // AI speed logic: 
    // Start slow (4.0) to give player a chance.
    // Speed increases with score up to a cap (8.0).
    const aiMaxSpeed = 4.0 + Math.min(4.0, score * 0.2); 
    
    if (Math.abs(diff) > aiMaxSpeed) {
        state.aiX += Math.sign(diff) * aiMaxSpeed;
    } else {
        state.aiX += diff; // Close enough to snap
    }
    
    // Clamp AI to screen
    state.aiX = Math.max(PADDLE_WIDTH/2, Math.min(canvas.width - PADDLE_WIDTH/2, state.aiX));

    // 4. Paddle Collisions
    // Player (Bottom)
    const playerY = canvas.height - 30;
    if (state.ball.y + BALL_RADIUS >= playerY && state.ball.y - BALL_RADIUS <= playerY + PADDLE_HEIGHT) {
        if (state.ball.x >= state.playerX - PADDLE_WIDTH/2 && state.ball.x <= state.playerX + PADDLE_WIDTH/2) {
            // Hit Player
            if (state.ball.vy > 0) {
                state.ball.vy *= -1;
                // Add English/Spin
                const hitOffset = (state.ball.x - state.playerX) / (PADDLE_WIDTH/2);
                state.ball.vx = hitOffset * 6;
                
                // Speed up game gradually
                state.ball.speed += 0.5;
                const speedMult = state.ball.speed / Math.sqrt(state.ball.vx**2 + state.ball.vy**2);
                state.ball.vx *= speedMult;
                state.ball.vy *= speedMult;

                spawnParticles(state.ball.x, state.ball.y, '#22d3ee');
                audioController.playEatSound();
            }
        }
    }

    // AI (Top)
    const aiY = 30;
    // Shrink AI hitbox slightly (by 10px) to prevent "unfair" edge saves
    const aiHitboxWidth = PADDLE_WIDTH - 10;
    
    if (state.ball.y - BALL_RADIUS <= aiY + PADDLE_HEIGHT && state.ball.y + BALL_RADIUS >= aiY) {
        if (state.ball.x >= state.aiX - aiHitboxWidth/2 && state.ball.x <= state.aiX + aiHitboxWidth/2) {
            // Hit AI
            if (state.ball.vy < 0) {
                state.ball.vy *= -1;
                const hitOffset = (state.ball.x - state.aiX) / (PADDLE_WIDTH/2);
                state.ball.vx = hitOffset * 6;
                spawnParticles(state.ball.x, state.ball.y, '#f472b6');
                audioController.playEatSound();
            }
        }
    }

    // 5. Scoring / Game Over
    // Ball passed Player (Bottom) -> Game Over
    if (state.ball.y > canvas.height + BALL_RADIUS) {
        setGameStatus('GAME_OVER');
        audioController.playGameOverSound();
    }

    // Ball passed AI (Top) -> Player Score
    if (state.ball.y < -BALL_RADIUS) {
        // Player Scored!
        spawnParticles(state.ball.x, 0, '#22d3ee');
        audioController.playEatSound();
        
        setScore(s => {
            const newScore = s + 1;
            if (newScore > highScore) {
                setHighScore(newScore);
                localStorage.setItem('pong-highscore', newScore.toString());
            }
            return newScore;
        });

        // Reset Ball
        state.ball.x = canvas.width / 2;
        state.ball.y = canvas.height / 2;
        state.ball.vx = (Math.random() - 0.5) * 4;
        state.ball.vy = INITIAL_BALL_SPEED; // Serve to player
        state.ball.speed = INITIAL_BALL_SPEED;
    }

    // 6. Particles
    state.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
    });
    state.particles = state.particles.filter(p => p.life > 0);

  }, [gameStatus, highScore, score]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const state = gameState.current;

    // Center Line
    ctx.strokeStyle = '#ffffff20';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height/2);
    ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();
    ctx.setLineDash([]);

    // AI Paddle (Top)
    ctx.fillStyle = '#f472b6'; // Pink
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f472b6';
    ctx.fillRect(state.aiX - PADDLE_WIDTH/2, 30, PADDLE_WIDTH, PADDLE_HEIGHT);
    
    // Player Paddle (Bottom)
    ctx.fillStyle = '#22d3ee'; // Cyan
    ctx.shadowColor = '#22d3ee';
    ctx.fillRect(state.playerX - PADDLE_WIDTH/2, canvas.height - 30, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Ball
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Particles
    state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 20;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

  }, []);

  // Loop
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animId: number;
      const render = () => {
          update();
          draw(ctx, canvas);
          animId = requestAnimationFrame(render);
      };
      render();
      return () => cancelAnimationFrame(animId);
  }, [draw, update]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            gameState.current.playerX = width / 2;
            gameState.current.aiX = width / 2;
        }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Input
  const handlePointerMove = (e: React.PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      gameState.current.playerX = Math.max(PADDLE_WIDTH/2, Math.min(canvasRef.current.width - PADDLE_WIDTH/2, x));
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
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Best</span>
                <span className="text-3xl text-cyan-50 font-light tracking-tight opacity-80">{highScore}</span>
            </div>
         </div>
         
         <div className="w-12"></div> 
      </div>

      {/* Game Area */}
      <div ref={containerRef} className="flex-1 w-full max-w-lg p-4 relative min-h-0">
          <canvas 
            ref={canvasRef}
            className="w-full h-full bg-[#050505] rounded-xl border border-white/10 shadow-[0_0_30px_rgba(34,211,238,0.1)] cursor-none touch-none"
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
          />

          {/* Overlays */}
          {(gameStatus === 'IDLE' || gameStatus === 'GAME_OVER') && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-md p-6 rounded-2xl border border-white/10 flex flex-col items-center pointer-events-auto shadow-2xl animate-[fadeIn_0.5s_ease-out] max-w-[85%]">
                      <h2 className="text-3xl md:text-5xl text-cyan-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(34,211,238,0.6)] mb-2 text-center">
                          {gameStatus === 'GAME_OVER' ? 'Match Point' : 'Neon Pong'}
                      </h2>
                      {gameStatus === 'GAME_OVER' && <p className="text-white/50 text-xs md:text-sm tracking-[0.3em] mb-6">SCORE: {score}</p>}
                      {gameStatus === 'IDLE' && <p className="text-white/50 text-xs md:text-sm tracking-[0.3em] mb-8 text-center">DRAG TO MOVE PADDLE</p>}
                      
                      <button 
                        onClick={startGame}
                        className="px-6 py-3 md:px-8 md:py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all active:scale-95 w-full text-sm md:text-base"
                      >
                          {gameStatus === 'GAME_OVER' ? 'REMATCH' : 'SERVE'}
                      </button>
                  </div>
              </div>
          )}
      </div>
      
      {/* Footer Instructions */}
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Defeat the AI</p>
      </div>

    </div>
  );
};

export default PingPongGame;