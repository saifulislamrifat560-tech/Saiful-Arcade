import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface TetrisGameProps {
  onBack: () => void;
}

const ROWS = 20;
const COLS = 10;
// We will scale block size dynamically based on canvas size
const SPEEDS = [800, 700, 600, 500, 400, 300, 200, 100, 50];

const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: '#06b6d4' }, // Cyan
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#3b82f6' }, // Blue
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#f97316' }, // Orange
  O: { shape: [[1, 1], [1, 1]], color: '#eab308' }, // Yellow
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#22c55e' }, // Green
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#a855f7' }, // Purple
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#ef4444' }, // Red
};

type TetrominoKey = keyof typeof TETROMINOS;

const TetrisGame: React.FC<TetrisGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Game State
  const gameState = useRef({
    grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    currentPiece: null as null | { shape: number[][], color: string, x: number, y: number },
    score: 0,
    level: 1,
    dropCounter: 0,
    lastTime: 0,
    isPlaying: false
  });

  const getRandomPiece = () => {
    const keys = Object.keys(TETROMINOS) as TetrominoKey[];
    const key = keys[Math.floor(Math.random() * keys.length)];
    const piece = TETROMINOS[key];
    return {
      shape: piece.shape,
      color: piece.color,
      x: Math.floor(COLS / 2) - Math.ceil(piece.shape[0].length / 2),
      y: 0
    };
  };

  const initGame = useCallback(() => {
    gameState.current = {
      grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      currentPiece: getRandomPiece(),
      score: 0,
      level: 1,
      dropCounter: 0,
      lastTime: 0,
      isPlaying: true
    };
    setScore(0);
    setLevel(1);
    setGameOver(false);
    setIsPaused(false);
  }, []);

  // Check Collision
  const isValidMove = (piece: { shape: number[][], x: number, y: number }, grid: any[][]) => {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c]) {
          const newX = piece.x + c;
          const newY = piece.y + r;
          if (newX < 0 || newX >= COLS || newY >= ROWS || (newY >= 0 && grid[newY][newX])) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const rotatePiece = (piece: any) => {
    const newShape = piece.shape[0].map((_: any, index: number) => 
      piece.shape.map((row: any[]) => row[index]).reverse()
    );
    return { ...piece, shape: newShape };
  };

  const mergePiece = () => {
    const state = gameState.current;
    if (!state.currentPiece) return;

    state.currentPiece.shape.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) {
          const y = state.currentPiece!.y + r;
          const x = state.currentPiece!.x + c;
          if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
            state.grid[y][x] = state.currentPiece!.color;
          }
        }
      });
    });

    let linesCleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (state.grid[r].every(cell => cell !== 0)) {
        state.grid.splice(r, 1);
        state.grid.unshift(Array(COLS).fill(0));
        linesCleared++;
        r++;
      }
    }

    if (linesCleared > 0) {
      state.score += linesCleared * 100 * linesCleared;
      setScore(state.score);
      const newLevel = Math.floor(state.score / 500) + 1;
      if (newLevel > state.level) {
          state.level = newLevel;
          setLevel(newLevel);
      }
      audioController.playEatSound();
    }

    state.currentPiece = getRandomPiece();
    
    if (!isValidMove(state.currentPiece, state.grid)) {
      state.isPlaying = false;
      setGameOver(true);
      audioController.playGameOverSound();
    }
  };

  const update = (time: number) => {
    const state = gameState.current;
    if (!state.isPlaying || isPaused) return;

    const deltaTime = time - state.lastTime;
    state.lastTime = time;
    state.dropCounter += deltaTime;

    const speed = SPEEDS[Math.min(state.level - 1, SPEEDS.length - 1)];

    if (state.dropCounter > speed) {
      if (state.currentPiece) {
        const nextPos = { ...state.currentPiece, y: state.currentPiece.y + 1 };
        if (isValidMove(nextPos, state.grid)) {
          state.currentPiece = nextPos;
        } else {
          mergePiece();
        }
      }
      state.dropCounter = 0;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    const width = canvas.width;
    const height = canvas.height;
    const blockSize = width / COLS; // Calculate block size dynamically

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Grid Lines (Subtle)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for(let i=0; i<=COLS; i++) {
        ctx.beginPath(); ctx.moveTo(i*blockSize, 0); ctx.lineTo(i*blockSize, height); ctx.stroke();
    }
    for(let i=0; i<=ROWS; i++) {
        ctx.beginPath(); ctx.moveTo(0, i*blockSize); ctx.lineTo(width, i*blockSize); ctx.stroke();
    }

    const drawBlock = (x: number, y: number, color: string) => {
        const px = x * blockSize;
        const py = y * blockSize;
        
        // Block Body
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, blockSize - 2, blockSize - 2);
        
        // Bevel Effect
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(px + 1, py + 1, blockSize - 2, 4); // Top highlight
        ctx.fillRect(px + 1, py + 1, 4, blockSize - 2); // Left highlight
        
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(px + 1, py + blockSize - 5, blockSize - 2, 4); // Bottom shadow
        ctx.fillRect(px + blockSize - 5, py + 1, 4, blockSize - 2); // Right shadow

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeRect(px, py, blockSize, blockSize);
        ctx.shadowBlur = 0;
    };

    // Draw Locked Blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.grid[r][c]) {
          drawBlock(c, r, state.grid[r][c]);
        }
      }
    }

    // Draw Current Piece
    if (state.currentPiece) {
      state.currentPiece.shape.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val) {
            drawBlock(state.currentPiece!.x + c, state.currentPiece!.y + r, state.currentPiece!.color);
          }
        });
      });
    }
  };

  const handleInput = useCallback((action: 'LEFT' | 'RIGHT' | 'DOWN' | 'ROTATE') => {
      const state = gameState.current;
      if (!state.isPlaying || isPaused || !state.currentPiece) return;

      if (action === 'LEFT') {
          const next = { ...state.currentPiece, x: state.currentPiece.x - 1 };
          if (isValidMove(next, state.grid)) state.currentPiece = next;
      } else if (action === 'RIGHT') {
          const next = { ...state.currentPiece, x: state.currentPiece.x + 1 };
          if (isValidMove(next, state.grid)) state.currentPiece = next;
      } else if (action === 'DOWN') {
          const next = { ...state.currentPiece, y: state.currentPiece.y + 1 };
          if (isValidMove(next, state.grid)) state.currentPiece = next;
      } else if (action === 'ROTATE') {
          const next = rotatePiece(state.currentPiece);
          if (isValidMove(next, state.grid)) {
              state.currentPiece = next;
          } else {
             // Wall kicks
             const tryLeft = { ...next, x: next.x - 1 };
             const tryRight = { ...next, x: next.x + 1 };
             if (isValidMove(tryLeft, state.grid)) state.currentPiece = tryLeft;
             else if (isValidMove(tryRight, state.grid)) state.currentPiece = tryRight;
          }
      }
  }, [isPaused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        switch(e.key) {
            case 'ArrowLeft': handleInput('LEFT'); break;
            case 'ArrowRight': handleInput('RIGHT'); break;
            case 'ArrowDown': handleInput('DOWN'); break;
            case 'ArrowUp': handleInput('ROTATE'); break;
            case ' ': setIsPaused(p => !p); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      
      const resize = () => {
          const { width, height } = container.getBoundingClientRect();
          // Maintain 1:2 aspect ratio if possible, otherwise fit to container
          const targetAspect = COLS / ROWS;
          const containerAspect = width / height;
          
          let drawWidth, drawHeight;
          
          if (containerAspect > targetAspect) {
              drawHeight = height;
              drawWidth = height * targetAspect;
          } else {
              drawWidth = width;
              drawHeight = width / targetAspect;
          }

          // Use high DPI
          const dpr = window.devicePixelRatio || 1;
          canvas.width = drawWidth * dpr;
          canvas.height = drawHeight * dpr;
          
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.scale(dpr, dpr);
          
          canvas.style.width = `${drawWidth}px`;
          canvas.style.height = `${drawHeight}px`;
      };
      
      resize();
      window.addEventListener('resize', resize);
      
      initGame();

      let animId: number;
      const ctx = canvas.getContext('2d');
      const render = (time: number) => {
          if (ctx) {
             update(time);
             draw(ctx, canvas);
          }
          animId = requestAnimationFrame(render);
      };
      render(0);
      
      return () => {
          window.removeEventListener('resize', resize);
          cancelAnimationFrame(animId);
      };
  }, [initGame]);

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-black touch-none">
       {/* Header */}
       <div className="w-full h-16 px-6 flex justify-between items-center z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">Menu</button>
         <div className="flex gap-6">
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight">{score}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-cyan-500 font-light tracking-tight opacity-80">{level}</span>
            </div>
         </div>
         <button onClick={initGame} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">RESET</button>
      </div>

      {/* Game Area - Maximized for Mobile */}
      <div className="flex-1 w-full flex items-center justify-center p-2 min-h-0 overflow-hidden">
         <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
             <canvas 
                ref={canvasRef}
                className="bg-[#050505] rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.1)] border border-white/10"
             />
             
             {gameOver && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 rounded-lg">
                     <div className="text-center">
                         <h2 className="text-4xl text-cyan-400 font-bold uppercase tracking-widest drop-shadow-[0_0_20px_rgba(6,182,212,0.8)] mb-4">Game Over</h2>
                         <button onClick={initGame} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-[0.2em] rounded">TRY AGAIN</button>
                     </div>
                 </div>
             )}
         </div>
      </div>

      {/* Controls - Better Spacing */}
      <div className="flex-shrink-0 w-full h-40 z-30 bg-transparent flex flex-col justify-center gap-4 px-6 pb-6">
         <div className="flex justify-between w-full max-w-lg mx-auto gap-4">
             {/* Left/Right/Down Cluster */}
             <div className="flex gap-4">
                 <button 
                    onPointerDown={() => handleInput('LEFT')} 
                    className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center active:bg-cyan-500/30 border border-white/5 shadow-lg"
                 >
                     <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                 </button>
                 <button 
                    onPointerDown={() => handleInput('DOWN')} 
                    className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center active:bg-cyan-500/30 border border-white/5 shadow-lg"
                 >
                     <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                 </button>
                 <button 
                    onPointerDown={() => handleInput('RIGHT')} 
                    className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center active:bg-cyan-500/30 border border-white/5 shadow-lg"
                 >
                     <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                 </button>
             </div>
             
             {/* Rotate Button (Large) */}
             <div className="flex items-center">
                 <button 
                    onPointerDown={() => handleInput('ROTATE')} 
                    className="w-20 h-20 bg-cyan-600/20 border-2 border-cyan-500 rounded-full flex items-center justify-center active:bg-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                 >
                     <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                 </button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default TetrisGame;