import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface FlappyBirdGameProps {
  onBack: () => void;
}

const GRAVITY = 0.5;
const JUMP = -7; // Slightly reduced for better feel
const PIPE_SPEED = 3;
const PIPE_SPAWN_RATE = 110;
const BIRD_SIZE = 24;
const PIPE_WIDTH = 52;
const GAP_SIZE = 160; // Slightly larger gap for playability

interface Pipe {
  x: number;
  y: number; // Top pipe height
  passed: boolean;
}

const FlappyBirdGame: React.FC<FlappyBirdGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Game state refs to avoid closure stale state in game loop
  const gameState = useRef({
    birdY: 0,
    velocity: 0,
    pipes: [] as Pipe[],
    frame: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem('flappy-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // --- Core Game Logic ---

  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    gameState.current = {
      birdY: canvas.height / 2,
      velocity: 0,
      pipes: [],
      frame: 0
    };
    
    setScore(0);
  }, []);

  const startGame = useCallback(() => {
    initGame();
    setGameStatus('PLAYING');
    
    // Initial jump to start flying
    gameState.current.velocity = JUMP;
    // audioController.playEatSound(); 
  }, [initGame]);

  const jump = useCallback(() => {
    if (gameStatus === 'PLAYING') {
      gameState.current.velocity = JUMP;
      // audioController.playEatSound(); 
    } else if (gameStatus === 'IDLE') {
      startGame();
    } else if (gameStatus === 'GAME_OVER') {
        // Debounce slightly to prevent accidental restarts
        // but here we just restart
        startGame();
    }
  }, [gameStatus, startGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault();
            jump();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  const update = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    if (gameStatus !== 'PLAYING') return;

    state.frame++;

    // Bird Physics
    state.velocity += GRAVITY;
    state.birdY += state.velocity;

    // Spawn Pipes
    if (state.frame % PIPE_SPAWN_RATE === 0) {
      const minHeight = 60;
      const maxHeight = canvas.height - GAP_SIZE - minHeight;
      // Ensure we have valid space
      if (maxHeight > minHeight) {
          const height = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
          
          state.pipes.push({
            x: canvas.width,
            y: height,
            passed: false
          });
      }
    }

    // Move Pipes
    state.pipes.forEach(pipe => {
      pipe.x -= PIPE_SPEED;
    });

    // Remove off-screen pipes
    if (state.pipes.length > 0 && state.pipes[0].x < -PIPE_WIDTH) {
      state.pipes.shift();
    }

    // Collision Detection
    const birdRect = {
      x: 50, // Bird fixed X position
      y: state.birdY,
      w: BIRD_SIZE,
      h: BIRD_SIZE
    };

    // 1. Floor/Ceiling collision
    if (state.birdY + BIRD_SIZE >= canvas.height || state.birdY <= 0) {
      setGameStatus('GAME_OVER');
      audioController.playGameOverSound();
      return;
    }

    // 2. Pipe collision
    for (const pipe of state.pipes) {
      // Check pass (score update)
      if (!pipe.passed && pipe.x + PIPE_WIDTH < birdRect.x) {
        pipe.passed = true;
        setScore(s => {
             const newScore = s + 1;
             // Check high score immediately
             setHighScore(prev => {
                 if (newScore > prev) {
                     localStorage.setItem('flappy-highscore', newScore.toString());
                     return newScore;
                 }
                 return prev;
             });
             return newScore;
        });
        audioController.playEatSound();
      }

      // Check collision
      // Bird is within pipe horizontal area
      if (birdRect.x + birdRect.w > pipe.x && birdRect.x < pipe.x + PIPE_WIDTH) {
          // Bird hits Top Pipe OR Bird hits Bottom Pipe
          if (birdRect.y < pipe.y || birdRect.y + birdRect.h > pipe.y + GAP_SIZE) {
              setGameStatus('GAME_OVER');
              audioController.playGameOverSound();
              return;
          }
      }
    }

  }, [gameStatus]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const state = gameState.current;

    // Draw Bird
    ctx.save();
    ctx.translate(50 + BIRD_SIZE/2, state.birdY + BIRD_SIZE/2);
    // Rotate bird based on velocity
    const rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (state.velocity * 0.1)));
    ctx.rotate(rotation);
    
    ctx.fillStyle = '#facc15'; // Yellow-400
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#facc15';
    ctx.fillRect(-BIRD_SIZE/2, -BIRD_SIZE/2, BIRD_SIZE, BIRD_SIZE);
    
    // Bird Eye
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 0;
    ctx.fillRect(BIRD_SIZE/2 - 8, -BIRD_SIZE/2 + 4, 4, 4);
    // Wing
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-BIRD_SIZE/2 + 4, 0, 12, 8);
    
    ctx.restore();

    // Draw Pipes
    state.pipes.forEach(pipe => {
      ctx.fillStyle = '#22c55e'; // Green-500
      ctx.shadowBlur = 0; // Performance optimization
      
      // Top Pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.y);
      // Bottom Pipe
      ctx.fillRect(pipe.x, pipe.y + GAP_SIZE, PIPE_WIDTH, canvas.height - (pipe.y + GAP_SIZE));
      
      // Pipe Caps (Retro style)
      ctx.fillStyle = '#4ade80'; // Green-400
      ctx.fillRect(pipe.x - 2, pipe.y - 24, PIPE_WIDTH + 4, 24); // Top Cap
      ctx.fillRect(pipe.x - 2, pipe.y + GAP_SIZE, PIPE_WIDTH + 4, 24); // Bottom Cap
      
      // Add neon glow to pipe edges only
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 2;
      ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.y);
      ctx.strokeRect(pipe.x, pipe.y + GAP_SIZE, PIPE_WIDTH, canvas.height - (pipe.y + GAP_SIZE));
    });

    // Floor Line
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(canvas.width, canvas.height);
    ctx.stroke();

  }, []);

  // Loop
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

  // Resize
  useEffect(() => {
    const handleResize = () => {
        if (containerRef.current && canvasRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            
            // If IDLE, re-center bird
            if (gameStatus === 'IDLE') {
                gameState.current.birdY = height / 2;
            }
        }
    };
    
    // Initial size set
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gameStatus]);

  // Handle Input (Touch/Click)
  const handleInput = (e: React.PointerEvent | React.MouseEvent) => {
      // Prevent default to stop double-firing on some devices if mixed events
      // e.preventDefault(); 
      jump();
  };

  return (
    <div 
        className="w-full h-full flex flex-col items-center select-none bg-transparent touch-none outline-none" 
        onPointerDown={handleInput}
    >
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20 pointer-events-none">
         <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1 pointer-events-auto">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>

         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-yellow-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight">{score}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-yellow-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Best</span>
                <span className="text-3xl text-yellow-50 font-light tracking-tight opacity-80">{highScore}</span>
            </div>
         </div>
         
         <div className="w-12"></div> 
      </div>

      {/* Game Area */}
      <div ref={containerRef} className="flex-1 w-full max-w-lg p-4 relative min-h-0">
          <canvas 
            ref={canvasRef}
            className="w-full h-full bg-[#050505] rounded-xl border border-white/10 shadow-[0_0_30px_rgba(250,204,21,0.1)] cursor-pointer touch-none"
          />

          {/* Overlays */}
          {(gameStatus === 'IDLE' || gameStatus === 'GAME_OVER') && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-md p-8 rounded-2xl border border-white/10 flex flex-col items-center pointer-events-auto shadow-2xl animate-[fadeIn_0.5s_ease-out]">
                      <h2 className="text-4xl md:text-5xl text-yellow-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] mb-2 text-center">
                          {gameStatus === 'GAME_OVER' ? 'CRASHED' : 'Neon Flap'}
                      </h2>
                      {gameStatus === 'GAME_OVER' && <p className="text-white/50 text-sm tracking-[0.3em] mb-6">SCORE: {score}</p>}
                      {gameStatus === 'IDLE' && <p className="text-white/50 text-sm tracking-[0.3em] mb-8">TAP OR SPACE TO FLY</p>}
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); startGame(); }}
                        className="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(250,204,21,0.4)] transition-all active:scale-95 w-full"
                      >
                          {gameStatus === 'GAME_OVER' ? 'RETRY' : 'START'}
                      </button>
                  </div>
              </div>
          )}
      </div>
      
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4 pointer-events-none">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Tap Screen or Spacebar to Jump</p>
      </div>

    </div>
  );
};

export default FlappyBirdGame;