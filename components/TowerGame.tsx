import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface TowerGameProps {
  onBack: () => void;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];
const INITIAL_WIDTH = 150;
const INITIAL_SPEED = 3;
const BLOCK_HEIGHT = 25;

interface Block {
  x: number;
  y: number;
  width: number;
  color: string;
}

const TowerGame: React.FC<TowerGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  const gameState = useRef({
    blocks: [] as Block[],
    currentBlock: { x: 0, width: INITIAL_WIDTH, direction: 1, speed: INITIAL_SPEED },
    offsetY: 0, // Camera scroll
    isPlaying: false,
    hue: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem('tower-best');
    if (saved) setBestScore(parseInt(saved, 10));
  }, []);

  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Base block
    const baseBlock = {
      x: (canvas.width - INITIAL_WIDTH) / 2,
      y: canvas.height - 50,
      width: INITIAL_WIDTH,
      color: `hsl(0, 100%, 50%)`
    };

    gameState.current = {
      blocks: [baseBlock],
      currentBlock: { 
          x: 0, 
          width: INITIAL_WIDTH, 
          direction: 1, 
          speed: INITIAL_SPEED 
      },
      offsetY: 0,
      isPlaying: true,
      hue: 0
    };
    
    setScore(0);
    setGameOver(false);
  }, []);

  const placeBlock = () => {
    const state = gameState.current;
    if (!state.isPlaying) {
        if (gameOver) initGame();
        return;
    }
    
    const prevBlock = state.blocks[state.blocks.length - 1];
    const currX = state.currentBlock.x;
    const width = state.currentBlock.width;

    // Calculate overlap
    const dist = currX - prevBlock.x;
    const overlap = width - Math.abs(dist);

    if (overlap > 0) {
        // Success
        audioController.playEatSound();
        setScore(s => {
            const newScore = s + 1;
            if (newScore > bestScore) {
                setBestScore(newScore);
                localStorage.setItem('tower-best', newScore.toString());
            }
            return newScore;
        });

        // Cut block
        const newWidth = overlap;
        let newX = currX;
        
        // Align new block perfectly if overlap is high (Combo feel) or just simple cut
        if (dist > 0) {
             newX = currX; // Right side cut
        } else {
             newX = prevBlock.x; // Left side cut
        }
        
        // Determine final position based on cut logic
        // If dist > 0, we placed to the right. Valid width is overlap. New X is current X.
        // Wait, visuals:
        // Prev: [   ]
        // Curr:   [   ]
        // Overlap:  [ ]
        // The new block should sit exactly on top of the overlap region.
        
        let finalX = prevBlock.x;
        if (dist > 0) finalX = currX;
        
        // Color cycle
        state.hue = (state.hue + 20) % 360;
        const color = `hsl(${state.hue}, 100%, 50%)`;

        state.blocks.push({
            x: finalX,
            y: prevBlock.y - BLOCK_HEIGHT,
            width: newWidth,
            color: color
        });

        // Setup next block
        state.currentBlock = {
            x: -200, // Start off screen
            width: newWidth,
            direction: 1,
            speed: Math.min(10, INITIAL_SPEED + state.blocks.length * 0.1)
        };

        // Scroll camera if tower gets high
        const canvas = canvasRef.current;
        if (canvas) {
            const topBlockY = state.blocks[state.blocks.length - 1].y;
            if (topBlockY < canvas.height / 2) {
                state.offsetY += BLOCK_HEIGHT;
            }
        }

    } else {
        // Failed
        state.isPlaying = false;
        setGameOver(true);
        audioController.playGameOverSound();
    }
  };

  const update = (canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    if (!state.isPlaying) return;

    // Move current block
    state.currentBlock.x += state.currentBlock.speed * state.currentBlock.direction;

    // Bounce off walls (with margin for off-screen start)
    const limit = canvas.width - state.currentBlock.width;
    if (state.currentBlock.x > canvas.width) {
        state.currentBlock.direction = -1;
    } else if (state.currentBlock.x + state.currentBlock.width < 0) {
        state.currentBlock.direction = 1;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0f0c29');
      gradient.addColorStop(1, '#302b63');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply Camera Offset (smooth lerp could be added here)
      ctx.translate(0, state.offsetY);

      // Draw Stack
      state.blocks.forEach(b => {
          ctx.fillStyle = b.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = b.color;
          ctx.fillRect(b.x, b.y, b.width, BLOCK_HEIGHT);
          
          // Top highlight
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(b.x, b.y, b.width, 4);
          ctx.shadowBlur = 0;
      });

      // Draw Moving Block
      if (state.isPlaying) {
          const cb = state.currentBlock;
          const prevY = state.blocks[state.blocks.length-1].y;
          const currentY = prevY - BLOCK_HEIGHT;
          
          ctx.fillStyle = `hsl(${state.hue + 20}, 100%, 50%)`;
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'white';
          ctx.fillRect(cb.x, currentY, cb.width, BLOCK_HEIGHT);
          ctx.fillStyle = 'white';
          ctx.fillRect(cb.x, currentY, cb.width, 4);
          ctx.shadowBlur = 0;
      }

      ctx.restore();
  };

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Re-init logic center
    if (!gameState.current.isPlaying && !gameOver) initGame();

    let animId: number;
    const render = () => {
        update(canvas);
        draw(ctx, canvas);
        animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [initGame, gameOver]);

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-black touch-none" onPointerDown={placeBlock}>
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
                <span className="text-3xl text-pink-50 font-light tracking-tight opacity-80">{bestScore}</span>
            </div>
         </div>
         <button onClick={(e) => { e.stopPropagation(); initGame(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors pointer-events-auto">RESET</button>
      </div>

      {/* Game Area */}
      <div className="flex-1 w-full flex items-center justify-center p-0 min-h-0 relative">
          <canvas 
            ref={canvasRef}
            className="w-full h-full bg-transparent"
          />
          
          {/* Start / Game Over */}
          {(gameOver) && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/80 backdrop-blur-md p-8 rounded-2xl flex flex-col items-center animate-[pop_0.3s_ease-out]">
                   <h2 className="text-5xl font-bold text-white mb-2 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">Toppled</h2>
                   <p className="text-pink-500 text-xl font-mono tracking-widest mb-6">SCORE: {score}</p>
                   <p className="text-white/50 text-xs tracking-[0.3em] animate-pulse">TAP ANYWHERE TO RESTART</p>
                </div>
             </div>
          )}
          
          {!gameState.current.isPlaying && !gameOver && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <p className="text-white/30 text-xs tracking-[0.5em] animate-pulse">TAP TO PLACE BLOCKS</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default TowerGame;
