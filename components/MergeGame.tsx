import React, { useState, useEffect, useCallback } from 'react';
import { audioController } from '../utils/audio';
import { Direction } from '../types';
import { Dpad } from './Dpad';

interface MergeGameProps {
  onBack: () => void;
}

const GRID_SIZE = 4;

const MergeGame: React.FC<MergeGameProps> = ({ onBack }) => {
  const [grid, setGrid] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false); // Reached 2048

  // Persist Best Score
  useEffect(() => {
    const saved = localStorage.getItem('merge-best');
    if (saved) setBestScore(parseInt(saved, 10));
    startNewGame();
  }, []);

  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem('merge-best', score.toString());
    }
  }, [score, bestScore]);

  // --- Game Logic ---

  const getEmptyCells = (currentGrid: number[][]) => {
    const cells: {x: number, y: number}[] = [];
    currentGrid.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val === 0) cells.push({x, y});
      });
    });
    return cells;
  };

  const addRandomTile = (currentGrid: number[][]) => {
    const empty = getEmptyCells(currentGrid);
    if (empty.length === 0) return currentGrid;
    
    const {x, y} = empty[Math.floor(Math.random() * empty.length)];
    currentGrid[y][x] = Math.random() < 0.9 ? 2 : 4;
    return currentGrid;
  };

  const startNewGame = () => {
    let newGrid = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
    newGrid = addRandomTile(newGrid);
    newGrid = addRandomTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    setIsWin(false);
  };

  // Helper to slide and merge a single row
  const slideRow = (row: number[]) => {
    // 1. Filter zeros
    let arr = row.filter(val => val !== 0);
    let gainedScore = 0;

    // 2. Merge
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        gainedScore += arr[i];
        arr[i + 1] = 0;
        
        if (arr[i] === 2048) setIsWin(true);
      }
    }

    // 3. Filter zeros again (from merges) and pad
    arr = arr.filter(val => val !== 0);
    while (arr.length < GRID_SIZE) {
      arr.push(0);
    }

    return { newRow: arr, score: gainedScore };
  };

  const move = useCallback((dir: Direction) => {
    if (gameOver) return;

    setGrid(prevGrid => {
      let moved = false;
      let totalScoreGain = 0;
      const newGrid = prevGrid.map(row => [...row]);

      const processRows = (rows: number[][]) => {
        return rows.map(row => {
          const result = slideRow(row);
          totalScoreGain += result.score;
          if (result.newRow.join(',') !== row.join(',')) moved = true;
          return result.newRow;
        });
      };

      // Transform grid to always operate on "Left" slide logic
      if (dir === Direction.LEFT) {
        const processed = processRows(newGrid);
        for(let i=0; i<GRID_SIZE; i++) newGrid[i] = processed[i];
      } else if (dir === Direction.RIGHT) {
        const reversed = newGrid.map(r => [...r].reverse());
        const processed = processRows(reversed);
        for(let i=0; i<GRID_SIZE; i++) newGrid[i] = processed[i].reverse();
      } else if (dir === Direction.UP) {
        // Transpose
        let cols = newGrid[0].map((_, i) => newGrid.map(row => row[i]));
        const processed = processRows(cols);
        // Transpose back
        for(let i=0; i<GRID_SIZE; i++) {
            for(let j=0; j<GRID_SIZE; j++) {
                newGrid[i][j] = processed[j][i];
            }
        }
      } else if (dir === Direction.DOWN) {
        // Transpose
        let cols = newGrid[0].map((_, i) => newGrid.map(row => row[i]));
        // Reverse cols to treat as Left
        let revCols = cols.map(c => [...c].reverse());
        const processed = processRows(revCols);
        // Reverse back and Transpose back
        const unRev = processed.map(c => c.reverse());
        for(let i=0; i<GRID_SIZE; i++) {
            for(let j=0; j<GRID_SIZE; j++) {
                newGrid[i][j] = unRev[j][i];
            }
        }
      }

      if (moved) {
        const gridWithTile = addRandomTile(newGrid);
        setScore(s => s + totalScoreGain);
        audioController.playEatSound();

        // Check Game Over
        if (getEmptyCells(gridWithTile).length === 0) {
           // Check if any merges possible
           let canMerge = false;
           for(let y=0; y<GRID_SIZE; y++) {
               for(let x=0; x<GRID_SIZE; x++) {
                   const val = gridWithTile[y][x];
                   if (x < GRID_SIZE-1 && val === gridWithTile[y][x+1]) canMerge = true;
                   if (y < GRID_SIZE-1 && val === gridWithTile[y+1][x]) canMerge = true;
               }
           }
           if (!canMerge) {
               setGameOver(true);
               audioController.playGameOverSound();
           }
        }
        return gridWithTile;
      }
      return prevGrid;
    });
  }, [gameOver]);

  // --- Input ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp': move(Direction.UP); break;
        case 'ArrowDown': move(Direction.DOWN); break;
        case 'ArrowLeft': move(Direction.LEFT); break;
        case 'ArrowRight': move(Direction.RIGHT); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  // --- Rendering ---

  const getTileStyle = (val: number) => {
    const base = "w-full h-full rounded flex items-center justify-center font-bold text-lg sm:text-3xl transition-all duration-200 border shadow-inner select-none";
    
    switch(val) {
        case 0: return "invisible";
        case 2: return `${base} bg-cyan-900/20 text-cyan-200 border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]`;
        case 4: return `${base} bg-cyan-800/40 text-cyan-100 border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.2)]`;
        case 8: return `${base} bg-blue-600/50 text-white border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]`;
        case 16: return `${base} bg-indigo-600/60 text-white border-indigo-400/50 shadow-[0_0_20px_rgba(99,102,241,0.4)]`;
        case 32: return `${base} bg-violet-600/70 text-white border-violet-400/60 shadow-[0_0_20px_rgba(139,92,246,0.5)]`;
        case 64: return `${base} bg-fuchsia-600/70 text-white border-fuchsia-400/60 shadow-[0_0_25px_rgba(217,70,239,0.5)]`;
        case 128: return `${base} bg-rose-600/70 text-white border-rose-400/60 shadow-[0_0_25px_rgba(244,63,94,0.5)]`;
        case 256: return `${base} bg-red-600/80 text-white border-red-400/60 shadow-[0_0_30px_rgba(239,68,68,0.6)]`;
        case 512: return `${base} bg-orange-500/80 text-white border-orange-300/60 shadow-[0_0_35px_rgba(249,115,22,0.7)]`;
        case 1024: return `${base} bg-amber-400/90 text-black border-amber-200/60 shadow-[0_0_40px_rgba(251,191,36,0.8)]`;
        case 2048: return `${base} bg-white text-black border-white shadow-[0_0_50px_rgba(255,255,255,0.9)] animate-pulse`;
        default: return `${base} bg-black text-white border-white`;
    }
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
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight">{score}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Best</span>
                <span className="text-3xl text-cyan-50 font-light tracking-tight opacity-80">{bestScore}</span>
            </div>
         </div>
         
         <button onClick={startNewGame} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RESET
         </button>
      </div>

      {/* Board */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         <div className="relative aspect-square w-full max-w-[500px] max-h-[500px]">
            
            <div className="w-full h-full bg-[#050505] p-3 rounded-xl border border-white/10 shadow-[0_0_30px_rgba(6,182,212,0.1)] grid grid-cols-4 grid-rows-4 gap-2 sm:gap-3">
               {grid.map((row, y) => (
                  row.map((val, x) => (
                     <div key={`${x}-${y}`} className="relative w-full h-full bg-white/5 rounded">
                        <div className={`absolute inset-0 ${val !== 0 ? 'animate-[pop_0.2s_ease-out]' : ''}`}>
                             <div className={getTileStyle(val)}>
                                {val > 0 && val}
                             </div>
                        </div>
                     </div>
                  ))
               ))}
            </div>

            {/* Overlays */}
            {(gameOver || isWin) && (
               <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-xl animate-[fadeIn_0.5s_ease-out]">
                   <h2 className={`text-5xl font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] mb-2 ${isWin ? 'text-cyan-400' : 'text-rose-500'}`}>
                      {isWin ? '2048' : 'Over'}
                   </h2>
                   <p className="text-white/50 text-sm tracking-[0.3em] mb-8">{isWin ? 'MISSION COMPLETE' : 'SYSTEM FAILURE'}</p>
                   <button 
                      onClick={startNewGame}
                      className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold tracking-[0.2em] rounded shadow transition-all active:scale-95"
                   >
                      TRY AGAIN
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

export default MergeGame;
