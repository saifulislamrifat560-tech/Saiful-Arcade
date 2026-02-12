import React, { useState, useEffect, useCallback, useRef } from 'react';
import { audioController } from '../utils/audio';

interface ArrowPuzzleGameProps {
  onBack: () => void;
}

// 0: UP, 1: RIGHT, 2: DOWN, 3: LEFT
type Direction = 0 | 1 | 2 | 3;

interface Cell {
  type: 'START' | 'END' | 'EMPTY' | 'WALL';
  dir: Direction;
  isFixed: boolean; // Walls are fixed
}

interface LevelData {
  rows: number;
  cols: number;
  layout: string[]; // S=Start, E=End, #=Wall, .=Empty
  solution: Direction[]; // Linear array of correct directions for the grid
}

const LEVELS: LevelData[] = [
  // Level 1: 3x3 Simple
  {
    rows: 3,
    cols: 3,
    layout: [
      "S..",
      "...",
      "..E"
    ],
    solution: [
      1, 1, 2, // (0,0)R->(0,1)R->(0,2)D
      1, 2, 2, // (1,0)R->(1,1)D, (1,2)D
      0, 1, 0  // (2,0)U, (2,1)R, (2,2)E
    ]
  },
  // Level 2: 4x4 ZigZag
  {
    rows: 4,
    cols: 4,
    layout: [
      "S...",
      ".##.",
      ".##.",
      "...E"
    ],
    solution: [
      1, 1, 1, 2, // R R R D
      2, 0, 0, 2, // D (Walls) D
      2, 0, 0, 2, // D (Walls) D
      1, 1, 1, 0  // R R R (End)
    ]
  },
  // Level 3: 4x4 Snake
  {
    rows: 4,
    cols: 4,
    layout: [
      "S...",
      "....",
      "....",
      "...E"
    ],
    solution: [
      2, 0, 0, 0,
      1, 2, 0, 0,
      0, 1, 2, 0,
      0, 0, 1, 0
    ]
  },
  // Level 4: 5x5 Maze
  {
    rows: 5,
    cols: 5,
    layout: [
      "S.#..",
      ".#...",
      ".....",
      "...#.",
      "..#E."
    ],
    solution: [
      2, 0, 0, 0, 0,
      1, 0, 1, 1, 2,
      0, 0, 1, 2, 2,
      1, 1, 0, 0, 2,
      0, 0, 0, 1, 0
    ]
  },
  // Level 5: 5x5 Full
  {
    rows: 5,
    cols: 5,
    layout: [
      "S....",
      ".###.",
      ".....",
      ".###.",
      "....E"
    ],
    solution: [
      1, 1, 1, 1, 2,
      0, 0, 0, 0, 2,
      2, 3, 3, 3, 3,
      2, 0, 0, 0, 0,
      1, 1, 1, 1, 0
    ]
  }
];

const ArrowPuzzleGame: React.FC<ArrowPuzzleGameProps> = ({ onBack }) => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [grid, setGrid] = useState<Cell[]>([]);
  const [ballPos, setBallPos] = useState<{r:number, c:number} | null>(null);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'RUNNING' | 'WON' | 'LOST'>('IDLE');

  // Load level
  useEffect(() => {
    loadLevel(levelIndex);
  }, [levelIndex]);

  const loadLevel = (idx: number) => {
    const level = LEVELS[idx % LEVELS.length];
    const newGrid: Cell[] = [];
    
    // Parse layout
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        const char = level.layout[r][c];
        let type: Cell['type'] = 'EMPTY';
        if (char === 'S') type = 'START';
        else if (char === 'E') type = 'END';
        else if (char === '#') type = 'WALL';

        const randomDir = Math.floor(Math.random() * 4) as Direction;
        
        newGrid.push({
          type,
          dir: randomDir,
          isFixed: type === 'WALL'
        });
      }
    }
    
    setGrid(newGrid);
    setGameStatus('IDLE');
    setBallPos(null);
  };

  const handleCellClick = (index: number) => {
    if (gameStatus === 'RUNNING' || grid[index].type === 'WALL' || grid[index].type === 'END') return;
    
    const newGrid = [...grid];
    newGrid[index].dir = ((newGrid[index].dir + 1) % 4) as Direction;
    setGrid(newGrid);
    audioController.playEatSound();
  };

  const solvePuzzle = () => {
     if (gameStatus === 'RUNNING') return;
     const level = LEVELS[levelIndex % LEVELS.length];
     const newGrid = grid.map((cell, i) => ({
        ...cell,
        dir: level.solution[i]
     }));
     setGrid(newGrid);
     audioController.playEatSound();
  };

  const runSimulation = () => {
    if (gameStatus === 'RUNNING') return;
    
    const level = LEVELS[levelIndex % LEVELS.length];
    
    // Find Start
    let startIdx = grid.findIndex(c => c.type === 'START');
    if (startIdx === -1) return;

    setGameStatus('RUNNING');
    let r = Math.floor(startIdx / level.cols);
    let c = startIdx % level.cols;
    setBallPos({ r, c });

    const maxSteps = level.rows * level.cols * 3;
    let step = 0;

    const interval = setInterval(() => {
       const currentIdx = r * level.cols + c;
       const currentCell = grid[currentIdx];

       if (!currentCell) {
         fail(); clearInterval(interval); return;
       }

       if (currentCell.type === 'END') {
         win(); clearInterval(interval); return;
       }

       // Move based on arrow
       let dr = 0, dc = 0;
       if (currentCell.dir === 0) dr = -1; // UP
       else if (currentCell.dir === 1) dc = 1; // RIGHT
       else if (currentCell.dir === 2) dr = 1; // DOWN
       else if (currentCell.dir === 3) dc = -1; // LEFT

       const nextR = r + dr;
       const nextC = c + dc;

       if (nextR < 0 || nextR >= level.rows || nextC < 0 || nextC >= level.cols) {
         fail(); clearInterval(interval); return;
       }

       const nextIdx = nextR * level.cols + nextC;
       const nextCell = grid[nextIdx];

       if (nextCell.type === 'WALL') {
         fail(); clearInterval(interval); return;
       }

       // Update pos
       r = nextR;
       c = nextC;
       setBallPos({ r, c });
       audioController.playEatSound();

       step++;
       if (step > maxSteps) {
         fail(); clearInterval(interval);
       }
    }, 250); 
  };

  const win = () => {
    setGameStatus('WON');
    audioController.playGameOverSound();
  };

  const fail = () => {
    setGameStatus('LOST');
    setTimeout(() => {
        setGameStatus('IDLE');
        setBallPos(null);
    }, 1000);
  };

  const nextLevel = () => {
      setLevelIndex(l => l + 1);
  };

  const level = LEVELS[levelIndex % LEVELS.length];

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent">
      
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>

         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{levelIndex + 1}</span>
            </div>
         </div>
         
         <button onClick={() => loadLevel(levelIndex)} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RESET
         </button>
      </div>

      {/* Board */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         <div className="relative aspect-square w-full max-w-[400px] max-h-[400px]">
            {/* Background container */}
            <div className="w-full h-full bg-slate-950 p-6 rounded-3xl border border-white/5 shadow-[0_0_50px_rgba(6,182,212,0.1)] flex items-center justify-center relative overflow-hidden">
               
               {/* Grid */}
               <div 
                  className="grid gap-2 w-full h-full relative z-10"
                  style={{
                    gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${level.rows}, minmax(0, 1fr))`
                  }}
               >
                  {grid.map((cell, i) => {
                      const r = Math.floor(i / level.cols);
                      const c = i % level.cols;
                      const isBallHere = ballPos && ballPos.r === r && ballPos.c === c;
                      
                      let rotation = 0;
                      if (cell.dir === 1) rotation = 90;
                      if (cell.dir === 2) rotation = 180;
                      if (cell.dir === 3) rotation = 270;

                      // Styles for "No Button" look
                      // We remove background/border for normal cells, only show the arrow
                      let containerClass = "relative w-full h-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95";
                      let arrowColor = "text-cyan-600";
                      
                      if (cell.type === 'START') {
                          containerClass += ""; 
                          arrowColor = "text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]";
                      } else if (cell.type === 'END') {
                          containerClass += "";
                          arrowColor = "text-red-500";
                      } else if (cell.type === 'WALL') {
                          containerClass += " cursor-default bg-slate-800 rounded-lg";
                          arrowColor = "text-transparent";
                      } else {
                          // Standard Arrow
                          arrowColor = "text-cyan-500 drop-shadow-[0_0_5px_rgba(6,182,212,0.3)] hover:text-cyan-400 hover:drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]";
                      }

                      return (
                          <div 
                            key={i} 
                            onClick={() => handleCellClick(i)}
                            className={containerClass}
                          >
                             {cell.type !== 'WALL' && cell.type !== 'END' && (
                                 <svg 
                                    className={`w-[80%] h-[80%] transition-transform duration-300 ${arrowColor}`}
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                 >
                                     {/* Thick arrow shaft */}
                                     <path d="M12 20V6" strokeWidth="5" strokeLinecap="round" />
                                     {/* Thick arrow head */}
                                     <path d="M5 10L12 3L19 10" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                                 </svg>
                             )}
                             
                             {cell.type === 'END' && (
                                 <div className="w-2/3 h-2/3 rounded-full border-[6px] border-red-500 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                                     <div className="w-1/2 h-1/2 bg-red-500 rounded-full animate-pulse" />
                                 </div>
                             )}

                             {isBallHere && (
                                 <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                     <div className="w-5 h-5 bg-white rounded-full shadow-[0_0_20px_white] animate-[soft-pulse_0.5s_infinite]" />
                                 </div>
                             )}
                          </div>
                      );
                  })}
               </div>

            </div>

            {/* Win Overlay */}
            {gameStatus === 'WON' && (
               <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-3xl animate-[fadeIn_0.5s_ease-out]">
                   <h2 className="text-5xl text-cyan-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] mb-2">Complete</h2>
                   <div className="w-16 h-1 bg-cyan-500 rounded-full mb-8" />
                   <button 
                      onClick={nextLevel}
                      className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95"
                   >
                      NEXT LEVEL
                   </button>
               </div>
            )}
         </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4">
         <div className="flex gap-4">
             <button 
                onClick={runSimulation}
                disabled={gameStatus === 'RUNNING'}
                className="w-32 h-12 bg-green-500 hover:bg-green-400 text-black font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                RUN
             </button>

             <button 
                onClick={solvePuzzle}
                disabled={gameStatus === 'RUNNING'}
                className="w-32 h-12 bg-white/10 hover:bg-white/20 text-cyan-400 border border-cyan-500/30 font-bold tracking-[0.2em] rounded-full transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                SOLVE
             </button>
         </div>
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Tap paths to guide the light</p>
      </div>

    </div>
  );
};

export default ArrowPuzzleGame;