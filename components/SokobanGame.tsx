import React, { useState, useEffect, useCallback } from 'react';
import { Direction } from '../types';
import { Dpad } from './Dpad';
import { audioController } from '../utils/audio';

// --- Types ---
interface Position { x: number; y: number; }

interface LevelData {
  grid: string[];
  playerStart?: Position; // Optional override, otherwise found in grid
}

interface SokobanGameProps {
  onBack: () => void;
}

// --- Constants & Levels ---
// Using well-known solvable "Microban" and "Classic" levels.
const LEVELS: LevelData[] = [
  // Level 1: Classic Boxxle 1
  {
    grid: [
      "    #####          ",
      "    #   #          ",
      "    #$  #          ",
      "  ###  $##         ",
      "  #  $ $ #         ",
      "### # . .#         ",
      "#   #   .#         ",
      "#     ####         ",
      "#######            "
    ]
  },
  // Level 2
  {
    grid: [
      "############",
      "#..  #     ###",
      "#..  # $  $  #",
      "#..  #$####  #",
      "#..    @ ##  #",
      "#..  #   $   #",
      "######   #####",
      "     #####    "
    ]
  },
  // Level 3
  {
    grid: [
      "        ######## ",
      "        #     @# ",
      "        # $#$ ## ",
      "        # $  $#  ",
      "        ##$ $ #  ",
      "######### . # #  ",
      "#....  ## .   #  ",
      "##...    .  ###  ",
      "###########      "
    ]
  },
   // Level 4
  {
    grid: [
      "##########",
      "#    #   #",
      "#  #   $ #",
      "#  #$  # #",
      "#  # . # #",
      "#  # . # #",
      "#  # . # #",
      "#@ $ .   #",
      "##########"
    ]
  }
];

const SokobanGame: React.FC<SokobanGameProps> = ({ onBack }) => {
  // State
  const [levelIndex, setLevelIndex] = useState(() => {
     const saved = localStorage.getItem('sokoban-level');
     return saved ? parseInt(saved, 10) : 0;
  });
  const [moves, setMoves] = useState(0);
  const [player, setPlayer] = useState<Position>({ x: 0, y: 0 });
  const [boxes, setBoxes] = useState<Position[]>([]);
  const [isWin, setIsWin] = useState(false);

  // Parse static grid (Walls and Targets don't move)
  const [staticGrid, setStaticGrid] = useState<('WALL' | 'TARGET' | 'FLOOR')[][]>([]);

  // --- Initialization ---
  const loadLevel = useCallback((index: number) => {
    // Ensure index is valid
    const safeIndex = index % LEVELS.length;
    localStorage.setItem('sokoban-level', safeIndex.toString());
    
    const lvl = LEVELS[safeIndex];
    const rawGrid = lvl.grid;
    const height = rawGrid.length;
    const width = rawGrid.reduce((max, row) => Math.max(max, row.length), 0);
    
    const newStaticGrid: ('WALL' | 'TARGET' | 'FLOOR')[][] = [];
    const newBoxes: Position[] = [];
    let newPlayer = { x: 1, y: 1 }; // Default fallback

    if (lvl.playerStart) {
        newPlayer = { ...lvl.playerStart };
    }

    for (let y = 0; y < height; y++) {
      const row: ('WALL' | 'TARGET' | 'FLOOR')[] = [];
      for (let x = 0; x < width; x++) {
        const char = rawGrid[y][x] || ' ';
        
        if (char === '#') {
          row.push('WALL');
        } else if (char === '.') {
          row.push('TARGET');
        } else if (char === '$') {
          row.push('FLOOR');
          newBoxes.push({ x, y });
        } else if (char === '@') {
          row.push('FLOOR');
          newPlayer = { x, y };
        } else if (char === '*') { // Box on target in raw data
          row.push('TARGET');
          newBoxes.push({ x, y });
        } else if (char === '+') { // Player on target
          row.push('TARGET');
          newPlayer = { x, y };
        } else {
          row.push('FLOOR');
        }
      }
      newStaticGrid.push(row);
    }

    setStaticGrid(newStaticGrid);
    setBoxes(newBoxes);
    setPlayer(newPlayer);
    setMoves(0);
    setIsWin(false);
  }, []);

  useEffect(() => {
    loadLevel(levelIndex);
  }, [levelIndex, loadLevel]);

  // --- Logic ---
  const isWall = (x: number, y: number) => {
    if (y < 0 || y >= staticGrid.length || x < 0 || x >= staticGrid[0].length) return true;
    return staticGrid[y][x] === 'WALL';
  };

  const getBoxIndex = (x: number, y: number) => {
    return boxes.findIndex(b => b.x === x && b.y === y);
  };

  const checkWin = (currentBoxes: Position[]) => {
    const allOnTarget = currentBoxes.every(b => staticGrid[b.y][b.x] === 'TARGET');
    if (allOnTarget) {
      setIsWin(true);
      audioController.playEatSound(); 
    }
  };

  const move = useCallback((dx: number, dy: number) => {
    if (isWin) return;

    const newX = player.x + dx;
    const newY = player.y + dy;

    // Check Wall
    if (isWall(newX, newY)) return;

    // Check Box
    const boxIdx = getBoxIndex(newX, newY);
    if (boxIdx !== -1) {
      // Trying to push box
      const boxNextX = newX + dx;
      const boxNextY = newY + dy;

      // Can't push into wall or another box
      if (isWall(boxNextX, boxNextY) || getBoxIndex(boxNextX, boxNextY) !== -1) {
        return;
      }

      // Move Box
      const newBoxes = [...boxes];
      newBoxes[boxIdx] = { x: boxNextX, y: boxNextY };
      setBoxes(newBoxes);
      setPlayer({ x: newX, y: newY });
      setMoves(m => m + 1);
      checkWin(newBoxes);
    } else {
      // Just Move Player
      setPlayer({ x: newX, y: newY });
      setMoves(m => m + 1);
    }
  }, [boxes, isWin, player, staticGrid]);

  // --- Input ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
         e.preventDefault();
       }
       switch(e.key) {
         case 'ArrowUp': move(0, -1); break;
         case 'ArrowDown': move(0, 1); break;
         case 'ArrowLeft': move(-1, 0); break;
         case 'ArrowRight': move(1, 0); break;
         case 'r': case 'R': loadLevel(levelIndex); break;
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move, levelIndex, loadLevel]);

  const handleDpad = (dir: Direction) => {
    switch(dir) {
      case Direction.UP: move(0, -1); break;
      case Direction.DOWN: move(0, 1); break;
      case Direction.LEFT: move(-1, 0); break;
      case Direction.RIGHT: move(1, 0); break;
    }
  };

  // --- Render ---
  return (
    <div className="w-full h-full flex flex-col items-center bg-transparent select-none">
       
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>

         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-amber-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{levelIndex + 1}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-amber-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Moves</span>
                <span className="text-3xl text-amber-50 font-light tracking-tight opacity-80">{moves}</span>
            </div>
         </div>
         
         <button onClick={() => loadLevel(levelIndex)} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RESET
         </button>
      </div>

      {/* Board */}
      <div className="flex-1 w-full flex items-center justify-center p-2 min-h-0 overflow-hidden">
          {/* Container uses vmin to scale with smallest dimension */}
          <div className="relative flex items-center justify-center p-4 bg-[#0a0a0a] rounded-xl border border-white/5 shadow-2xl overflow-hidden max-w-full max-h-full">
                {staticGrid.length > 0 && (
                  <div style={{
                      display: 'grid',
                      // Dynamic sizing: Uses smallest viewport dimension divided by max grid dimension (plus padding)
                      // This ensures cells are as big as possible without overflowing
                      gridTemplateColumns: `repeat(${staticGrid[0].length}, minmax(0, 1fr))`,
                  }}>
                    {staticGrid.map((row, y) => (
                        row.map((cellType, x) => {
                          const isPlayer = player.x === x && player.y === y;
                          const boxIdx = getBoxIndex(x, y);
                          const isBox = boxIdx !== -1;
                          const isTarget = cellType === 'TARGET';
                          const isWallTile = cellType === 'WALL';
                          
                          const isBoxOnTarget = isBox && isTarget;

                          return (
                            <div key={`${x}-${y}`} className="w-[8vmin] h-[8vmin] max-w-[40px] max-h-[40px] relative">
                              
                              {/* Floor / Target */}
                              <div className={`absolute inset-0 border border-white/[0.02] ${isTarget ? 'bg-rose-900/20' : ''}`}>
                                {isTarget && (
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                )}
                              </div>

                              {/* Wall */}
                              {isWallTile && (
                                <div className="absolute inset-0 bg-slate-800 rounded-sm border border-slate-700 shadow-inner" />
                              )}

                              {/* Box */}
                              {isBox && (
                                <div className={`absolute inset-[10%] rounded-sm transition-all duration-200 ${
                                  isBoxOnTarget 
                                  ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]' 
                                  : 'bg-amber-700/80 border border-amber-500/50'
                                }`}>
                                    {isBoxOnTarget && <div className="absolute inset-0 bg-white/30 animate-pulse" />}
                                </div>
                              )}

                              {/* Player */}
                              {isPlayer && (
                                <div className="absolute inset-[10%] rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] z-10 scale-90" />
                              )}

                            </div>
                          );
                        })
                    ))}
                  </div>
                )}
          </div>
      </div>

      {/* Win Overlay */}
      {isWin && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-[fadeIn_0.5s_ease-out]">
            <h2 className="text-4xl text-amber-400 font-light tracking-widest uppercase drop-shadow-[0_0_20px_rgba(251,191,36,0.5)] mb-4">Completed</h2>
            <button 
                onClick={() => setLevelIndex(i => (i + 1) % LEVELS.length)}
                className="px-8 py-3 bg-amber-500 text-black font-bold tracking-[0.2em] rounded hover:bg-amber-400 transition-colors shadow-lg"
            >
                NEXT LEVEL
            </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex-shrink-0 w-full z-30 md:hidden bg-transparent pt-2 pb-6">
         <Dpad onDirectionChange={handleDpad} />
      </div>

    </div>
  );
};

export default SokobanGame;