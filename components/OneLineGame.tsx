import React, { useState, useEffect, useCallback } from 'react';
import { Direction } from '../types';
import { Dpad } from './Dpad';
import { audioController } from '../utils/audio';

interface OneLineGameProps {
  onBack: () => void;
}

interface Coordinate {
  x: number;
  y: number;
}

// 1 = Playable Cell, 0 = Empty/Void
type GridShape = number[][];

interface LevelData {
  shape: GridShape;
  start: Coordinate;
  solution: Coordinate[]; // The path to solve the level
}

// Re-defining levels to ensure 100% solvability with single path for simplicity
const VALID_LEVELS: LevelData[] = [
  // 1. Easy Hook
  {
    shape: [[1,1], [1,0]],
    start: {x:1, y:0},
    solution: [{x:1,y:0}, {x:0,y:0}, {x:0,y:1}]
  },
  // 2. The U
  {
    shape: [[1,0,1], [1,0,1], [1,1,1]],
    start: {x:0, y:0},
    solution: [{x:0,y:0}, {x:0,y:1}, {x:0,y:2}, {x:1,y:2}, {x:2,y:2}, {x:2,y:1}, {x:2,y:0}]
  },
  // 3. 3x3 Full
  {
    shape: [[1,1,1], [1,1,1], [1,1,1]],
    start: {x:0, y:0},
    solution: [
       {x:0,y:0}, {x:1,y:0}, {x:2,y:0}, 
       {x:2,y:1}, {x:1,y:1}, {x:0,y:1},
       {x:0,y:2}, {x:1,y:2}, {x:2,y:2}
    ]
  },
  // 4. The Donut (Square Loop) - Replaced the impossible Cross
  {
    shape: [
      [1,1,1],
      [1,0,1],
      [1,1,1]
    ],
    start: {x:0, y:0},
    solution: [
      {x:0,y:0}, {x:1,y:0}, {x:2,y:0},
      {x:2,y:1}, {x:2,y:2}, {x:1,y:2},
      {x:0,y:2}, {x:0,y:1}
    ]
  },
  // 5. The Glasses
  {
    shape: [
      [1,1,1,1],
      [1,0,0,1],
      [1,1,1,1]
    ],
    start: {x:0, y:1},
    solution: [
      {x:0,y:1}, {x:0,y:2}, {x:1,y:2}, {x:2,y:2}, {x:3,y:2},
      {x:3,y:1}, {x:3,y:0}, {x:2,y:0}, {x:1,y:0}, {x:0,y:0} 
    ]
  },
  // 6. 4x4 Snake
  {
     shape: [
       [1,1,1,1],
       [1,1,1,1],
       [1,1,1,1],
       [1,1,1,1]
     ],
     start: {x:0, y:0},
     solution: [
       {x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0},
       {x:3,y:1}, {x:2,y:1}, {x:1,y:1}, {x:0,y:1},
       {x:0,y:2}, {x:1,y:2}, {x:2,y:2}, {x:3,y:2},
       {x:3,y:3}, {x:2,y:3}, {x:1,y:3}, {x:0,y:3}
     ]
  }
];

const OneLineGame: React.FC<OneLineGameProps> = ({ onBack }) => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [path, setPath] = useState<Coordinate[]>([]);
  const [isWin, setIsWin] = useState(false);
  const [showHint, setShowHint] = useState(false);
  
  // Persist Level
  useEffect(() => {
    const saved = localStorage.getItem('oneline-level');
    if (saved) setLevelIndex(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    localStorage.setItem('oneline-level', levelIndex.toString());
  }, [levelIndex]);

  // Load Level
  const loadLevel = useCallback(() => {
    const safeIndex = levelIndex % VALID_LEVELS.length;
    const lvl = VALID_LEVELS[safeIndex];
    setPath([lvl.start]);
    setIsWin(false);
    setShowHint(false);
  }, [levelIndex]);

  useEffect(() => {
    loadLevel();
  }, [loadLevel]);

  // Game Logic
  const getCurrentLevel = () => VALID_LEVELS[levelIndex % VALID_LEVELS.length];

  const isValidMove = (x: number, y: number) => {
    const level = getCurrentLevel();
    const height = level.shape.length;
    const width = level.shape[0].length;

    // Bounds check
    if (y < 0 || y >= height || x < 0 || x >= width) return false;
    
    // Void check
    if (level.shape[y][x] === 0) return false;

    // Already visited check
    if (path.some(p => p.x === x && p.y === y)) return false;

    return true;
  };

  const move = useCallback((dir: Direction) => {
    if (isWin) return;

    const currentHead = path[path.length - 1];
    let dx = 0;
    let dy = 0;

    switch (dir) {
      case Direction.UP: dy = -1; break;
      case Direction.DOWN: dy = 1; break;
      case Direction.LEFT: dx = -1; break;
      case Direction.RIGHT: dx = 1; break;
    }

    const nextX = currentHead.x + dx;
    const nextY = currentHead.y + dy;

    // Backtracking Logic
    if (path.length > 1) {
      const prevNode = path[path.length - 2];
      if (prevNode.x === nextX && prevNode.y === nextY) {
        setPath(prev => prev.slice(0, -1));
        audioController.playEatSound(); 
        return;
      }
    }

    if (isValidMove(nextX, nextY)) {
      const newPath = [...path, { x: nextX, y: nextY }];
      setPath(newPath);
      audioController.playEatSound();

      // Check Win
      const level = getCurrentLevel();
      const totalPlayableCells = level.shape.flat().filter(c => c === 1).length;
      if (newPath.length === totalPlayableCells) {
        setIsWin(true);
        audioController.playGameOverSound(); 
      }
    }
  }, [path, isWin, levelIndex]);

  // Keyboard Inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        switch (e.key) {
          case 'ArrowUp': move(Direction.UP); break;
          case 'ArrowDown': move(Direction.DOWN); break;
          case 'ArrowLeft': move(Direction.LEFT); break;
          case 'ArrowRight': move(Direction.RIGHT); break;
        }
      }
      if (e.key === 'r' || e.key === 'R') loadLevel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, loadLevel]);

  // Next Level
  const nextLevel = () => {
    setLevelIndex(prev => prev + 1);
  };

  const currentLevelData = getCurrentLevel();

  // Rendering Helpers
  const getCellClass = (x: number, y: number, isPlayable: boolean) => {
    if (!isPlayable) return "invisible";
    
    const pathIndex = path.findIndex(p => p.x === x && p.y === y);
    const isVisited = pathIndex !== -1;
    const isHead = pathIndex === path.length - 1;

    let base = "relative w-full h-full rounded-lg transition-all duration-300 ";

    if (isHead) {
      base += "bg-lime-400 shadow-[0_0_20px_rgba(163,230,53,0.8)] scale-105 z-10 animate-pulse";
    } else if (isVisited) {
      base += "bg-lime-600 shadow-[0_0_10px_rgba(163,230,53,0.4)] scale-100";
    } else {
      base += "bg-white/10 border border-white/5";
    }

    return base;
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent">
      
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>

         <div className="flex gap-4 sm:gap-8">
            <div className="flex flex-col items-center">
                <span className="text-lime-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{levelIndex + 1}</span>
            </div>
            
            {/* Hint Button */}
            {!isWin && (
              <button 
                onClick={() => setShowHint(!showHint)} 
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border transition-all ${showHint ? 'bg-lime-500/20 border-lime-500 text-lime-400' : 'bg-transparent border-white/10 text-white/30 hover:text-white'}`}
              >
                  <span className="text-[8px] font-bold tracking-widest uppercase">Hint</span>
              </button>
            )}
         </div>
         
         <button onClick={loadLevel} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RETRY
         </button>
      </div>

      {/* Board */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         <div className="relative aspect-square w-full max-w-[400px] max-h-[400px]">
            <div className="w-full h-full bg-[#050505] p-6 rounded-3xl border border-white/10 shadow-[0_0_40px_rgba(132,204,22,0.1)] flex items-center justify-center relative">
               
               <div 
                  className="grid gap-3 w-full h-full relative z-10"
                  style={{
                    gridTemplateColumns: `repeat(${currentLevelData.shape[0].length}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${currentLevelData.shape.length}, minmax(0, 1fr))`
                  }}
               >
                  {currentLevelData.shape.map((row, y) => (
                    row.map((val, x) => (
                      <div key={`${x}-${y}`} className={getCellClass(x, y, val === 1)}>
                         {/* Connector Lines Logic */}
                         {path.map((p, i) => {
                            if (p.x !== x || p.y !== y) return null;
                            if (i === path.length - 1) return null; 
                            const next = path[i+1];
                            const dx = next.x - x;
                            const dy = next.y - y;
                            
                            let styleClass = "absolute bg-lime-400 z-0 ";
                            if (dx === 1) styleClass += "h-2 top-1/2 -translate-y-1/2 left-1/2 w-[150%]"; 
                            if (dx === -1) styleClass += "h-2 top-1/2 -translate-y-1/2 right-1/2 w-[150%]"; 
                            if (dy === 1) styleClass += "w-2 left-1/2 -translate-x-1/2 top-1/2 h-[150%]"; 
                            if (dy === -1) styleClass += "w-2 left-1/2 -translate-x-1/2 bottom-1/2 h-[150%]"; 
                            
                            return <div key={i} className={styleClass} />;
                         })}

                         {/* Hint Overlay (Ghost Path) */}
                         {showHint && currentLevelData.solution.map((p, i) => {
                            if (p.x !== x || p.y !== y) return null;
                            const indexLabel = i + 1;
                            
                            return (
                                <div key={`hint-${i}`} className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                    <span className="text-lime-500 font-bold opacity-60 text-lg">{indexLabel}</span>
                                </div>
                            );
                         })}
                      </div>
                    ))
                  ))}
               </div>

            </div>

            {/* Win Overlay */}
            {isWin && (
               <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-3xl animate-[fadeIn_0.5s_ease-out]">
                   <h2 className="text-5xl text-lime-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(163,230,53,0.5)] mb-2">Solved</h2>
                   <div className="w-16 h-1 bg-lime-500 rounded-full mb-8" />
                   <button 
                      onClick={nextLevel}
                      className="px-8 py-3 bg-lime-600 hover:bg-lime-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(163,230,53,0.4)] transition-all active:scale-95"
                   >
                      NEXT PUZZLE
                   </button>
               </div>
            )}
         </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 w-full z-30 md:hidden bg-transparent pt-2 pb-6">
         <Dpad onDirectionChange={move} />
      </div>

    </div>
  );
};

export default OneLineGame;