import React, { useState, useEffect, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface NumberPuzzleGameProps {
  onBack: () => void;
}

const NumberPuzzleGame: React.FC<NumberPuzzleGameProps> = ({ onBack }) => {
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [level, setLevel] = useState(1);
  const [gridSize, setGridSize] = useState(3);

  // Load level from storage
  useEffect(() => {
    const saved = localStorage.getItem('puzzle-level');
    if (saved) setLevel(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    localStorage.setItem('puzzle-level', level.toString());
    // Level 1: 3x3 (9 tiles, 8 numbers)
    // Level 2: 4x4 (16 tiles, 15 numbers)
    // Level 3: 5x5 (25 tiles, 24 numbers)
    // This roughly satisfies "increase ~10 numbers step by step"
    setGridSize(level + 2);
  }, [level]);

  // Initialize ordered grid and shuffle based on level difficulty
  const initGame = useCallback(() => {
    if (gridSize < 3) return;
    
    const tileCount = gridSize * gridSize;
    
    // 1. Create solved state: [1, 2, ..., N-1, 0] (0 is empty)
    const solved = Array.from({ length: tileCount }, (_, i) => (i + 1) % tileCount);
    
    // 2. Shuffle by performing valid moves (guarantees solvability)
    let currentTiles = [...solved];
    let emptyIdx = tileCount - 1;
    let previousIdx = -1;

    // Difficulty increases with grid size
    const shuffleCount = gridSize * gridSize * 10; 

    for (let i = 0; i < shuffleCount; i++) {
      const neighbors = [];
      const row = Math.floor(emptyIdx / gridSize);
      const col = emptyIdx % gridSize;

      if (row > 0) neighbors.push(emptyIdx - gridSize); // Up
      if (row < gridSize - 1) neighbors.push(emptyIdx + gridSize); // Down
      if (col > 0) neighbors.push(emptyIdx - 1); // Left
      if (col < gridSize - 1) neighbors.push(emptyIdx + 1); // Right

      // Don't undo the immediate last move to encourage mixing
      const validNeighbors = neighbors.filter(n => n !== previousIdx);
      const candidates = validNeighbors.length > 0 ? validNeighbors : neighbors;
      const randomNeighbor = candidates[Math.floor(Math.random() * candidates.length)];

      // Swap
      [currentTiles[emptyIdx], currentTiles[randomNeighbor]] = [currentTiles[randomNeighbor], currentTiles[emptyIdx]];
      previousIdx = emptyIdx;
      emptyIdx = randomNeighbor;
    }

    setTiles(currentTiles);
    setMoves(0);
    setIsSolved(false);
  }, [gridSize]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const checkWin = (currentTiles: number[]) => {
    const tileCount = gridSize * gridSize;
    for (let i = 0; i < tileCount - 1; i++) {
      if (currentTiles[i] !== i + 1) return false;
    }
    return true;
  };

  const moveTile = (index: number) => {
    if (isSolved) return;

    const emptyIndex = tiles.indexOf(0);
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const emptyRow = Math.floor(emptyIndex / gridSize);
    const emptyCol = emptyIndex % gridSize;

    // Check adjacency (manhattan distance = 1)
    const dist = Math.abs(row - emptyRow) + Math.abs(col - emptyCol);

    if (dist === 1) {
      const newTiles = [...tiles];
      // Swap
      [newTiles[index], newTiles[emptyIndex]] = [newTiles[emptyIndex], newTiles[index]];
      
      setTiles(newTiles);
      setMoves(m => m + 1);
      audioController.playEatSound(); 

      if (checkWin(newTiles)) {
        setIsSolved(true);
        audioController.playGameOverSound(); 
      }
    }
  };

  const nextLevel = () => {
      setLevel(l => l + 1);
  };

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
                <span className="text-fuchsia-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{level}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-fuchsia-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Moves</span>
                <span className="text-3xl text-fuchsia-50 font-light tracking-tight opacity-80">{moves}</span>
            </div>
         </div>
         
         <button onClick={initGame} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RESET
         </button>
      </div>

      {/* Game Board */}
      <div className="flex-1 w-full flex items-center justify-center p-6 min-h-0">
        <div className="relative aspect-square w-full max-w-[500px] max-h-[500px]">
           
           <div 
             className="absolute inset-0 bg-white/5 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(217,70,239,0.15)] backdrop-blur-sm p-4 grid gap-2 sm:gap-3 transition-all duration-300"
             style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`
             }}
           >
              {tiles.map((num, index) => {
                 const isEmpty = num === 0;
                 // Adjust font size based on grid complexity
                 const fontSize = gridSize > 5 ? 'text-lg sm:text-xl' : gridSize > 4 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl';
                 
                 return (
                   <button
                     key={`${index}-${num}`}
                     disabled={isEmpty || isSolved}
                     onClick={() => moveTile(index)}
                     className={`
                        relative w-full h-full rounded-lg flex items-center justify-center ${fontSize} font-light transition-all duration-200
                        ${isEmpty 
                          ? 'invisible cursor-default' 
                          : 'bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40 border border-fuchsia-500/30 text-white shadow-lg hover:border-fuchsia-400/60 hover:shadow-[0_0_15px_rgba(217,70,239,0.3)] active:scale-95'
                        }
                        ${isSolved && !isEmpty ? 'bg-green-500/20 border-green-500/50 text-green-200' : ''}
                     `}
                   >
                     {!isEmpty && (
                       <>
                         <span className="relative z-10">{num}</span>
                         {/* Subtle grid pattern on tile */}
                         <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:4px_4px] pointer-events-none rounded-lg" />
                       </>
                     )}
                   </button>
                 );
              })}
           </div>

            {/* Win Overlay */}
            {isSolved && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl animate-[fadeIn_0.5s_ease-out]">
                    <h2 className="text-5xl text-fuchsia-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(217,70,239,0.5)] mb-2">Solved</h2>
                    <p className="text-white/50 text-sm tracking-[0.3em] mb-8">{moves} MOVES</p>
                    <button 
                       onClick={nextLevel}
                       className="px-8 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold tracking-[0.2em] rounded shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all active:scale-95"
                    >
                       NEXT LEVEL
                    </button>
                </div>
             )}

        </div>
      </div>

    </div>
  );
};

export default NumberPuzzleGame;