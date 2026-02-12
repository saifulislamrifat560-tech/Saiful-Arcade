import React, { useState, useEffect, useCallback, useRef } from 'react';

interface FlowGameProps {
  onBack: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface LevelData {
  size: number;
  dots: { color: string, x: number, y: number }[];
}

const COLORS: Record<string, { bg: string, ring: string, line: string, shadow: string }> = {
  red:    { bg: 'bg-red-500',    ring: 'border-red-500',    line: 'bg-red-500',    shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.6)]' },
  blue:   { bg: 'bg-blue-500',   ring: 'border-blue-500',   line: 'bg-blue-500',   shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.6)]' },
  green:  { bg: 'bg-green-500',  ring: 'border-green-500',  line: 'bg-green-500',  shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.6)]' },
  yellow: { bg: 'bg-yellow-400', ring: 'border-yellow-400', line: 'bg-yellow-400', shadow: 'shadow-[0_0_15px_rgba(250,204,21,0.6)]' },
  cyan:   { bg: 'bg-cyan-400',   ring: 'border-cyan-400',   line: 'bg-cyan-400',   shadow: 'shadow-[0_0_15px_rgba(34,211,238,0.6)]' },
  purple: { bg: 'bg-purple-500', ring: 'border-purple-500', line: 'bg-purple-500', shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.6)]' },
  orange: { bg: 'bg-orange-500', ring: 'border-orange-500', line: 'bg-orange-500', shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.6)]' },
};

const LEVELS: LevelData[] = [
  // Level 1: 5x5 Easy
  {
    size: 5,
    dots: [
      { color: 'red', x: 0, y: 0 }, { color: 'red', x: 4, y: 1 },
      { color: 'blue', x: 0, y: 1 }, { color: 'blue', x: 3, y: 3 },
      { color: 'green', x: 2, y: 2 }, { color: 'green', x: 4, y: 4 },
      { color: 'yellow', x: 1, y: 3 }, { color: 'yellow', x: 3, y: 1 },
    ]
  },
  // Level 2: 5x5 Medium
  {
    size: 5,
    dots: [
      { color: 'red', x: 0, y: 0 }, { color: 'red', x: 4, y: 3 },
      { color: 'blue', x: 4, y: 0 }, { color: 'blue', x: 0, y: 2 },
      { color: 'green', x: 1, y: 1 }, { color: 'green', x: 2, y: 4 },
      { color: 'yellow', x: 0, y: 4 }, { color: 'yellow', x: 3, y: 3 },
    ]
  },
  // Level 3: 6x6 Harder
  {
      size: 6,
      dots: [
          {color: 'red', x:0, y:0}, {color: 'red', x:3, y:3},
          {color: 'blue', x:5, y:0}, {color: 'blue', x:2, y:4},
          {color: 'green', x:0, y:3}, {color: 'green', x:4, y:5},
          {color: 'yellow', x:2, y:1}, {color: 'yellow', x:5, y:5},
          {color: 'cyan', x:1, y:5}, {color: 'cyan', x:5, y:2}
      ]
  }
];

const FlowGame: React.FC<FlowGameProps> = ({ onBack }) => {
  const [levelIndex, setLevelIndex] = useState(0);
  const [paths, setPaths] = useState<Record<string, Point[]>>({});
  const [drawingColor, setDrawingColor] = useState<string | null>(null);
  const [isWin, setIsWin] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load Level
  const currentLevel = LEVELS[levelIndex % LEVELS.length];

  useEffect(() => {
    // Reset
    setPaths({});
    setDrawingColor(null);
    setIsWin(false);
  }, [levelIndex]);

  // Check Win Condition
  useEffect(() => {
    const dotsCount = currentLevel.dots.length / 2;
    const completedPaths = Object.keys(paths).filter(color => {
      const path = paths[color];
      if (path.length < 2) return false;
      const head = path[0];
      const tail = path[path.length - 1];
      // Check if head and tail are both dots of same color
      const headDot = currentLevel.dots.find(d => d.x === head.x && d.y === head.y && d.color === color);
      const tailDot = currentLevel.dots.find(d => d.x === tail.x && d.y === tail.y && d.color === color);
      return headDot && tailDot && headDot !== tailDot;
    });

    if (completedPaths.length === dotsCount) {
        setIsWin(true);
        // Sound removed as requested
    }
  }, [paths, currentLevel]);

  const getDotAt = (x: number, y: number) => {
    return currentLevel.dots.find(d => d.x === x && d.y === y);
  };

  const getPathOwner = (x: number, y: number) => {
     for (const [color, points] of Object.entries(paths)) {
        if ((points as Point[]).some(p => p.x === x && p.y === y)) return color;
     }
     return null;
  };

  const handleStart = (x: number, y: number) => {
    if (isWin) return;
    const dot = getDotAt(x, y);
    const pathOwner = getPathOwner(x, y);

    if (dot) {
       // Start drawing from dot
       setDrawingColor(dot.color);
       setPaths(prev => ({
         ...prev,
         [dot.color]: [{x, y}]
       }));
       // Sound removed
    } else if (pathOwner) {
       // Pickup existing path
       setDrawingColor(pathOwner);
       // Truncate path to this point to allow re-drawing
       setPaths(prev => {
         const oldPath = prev[pathOwner];
         const idx = oldPath.findIndex(p => p.x === x && p.y === y);
         return {
           ...prev,
           [pathOwner]: oldPath.slice(0, idx + 1)
         };
       });
       // Sound removed
    }
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!drawingColor || !containerRef.current || isWin) return;
    e.preventDefault(); // Prevent scroll on touch

    // Calculate grid coord
    const rect = containerRef.current.getBoundingClientRect();
    const size = currentLevel.size;
    const cellSize = rect.width / size; // Assume square aspect
    
    const x = Math.floor((e.clientX - rect.left) / cellSize);
    const y = Math.floor((e.clientY - rect.top) / cellSize);

    // Bounds check
    if (x < 0 || x >= size || y < 0 || y >= size) return;

    setPaths(prev => {
       const currentPath = prev[drawingColor] || [];
       const lastPoint = currentPath[currentPath.length - 1];
       
       if (!lastPoint) return prev; // Should not happen

       if (lastPoint.x === x && lastPoint.y === y) return prev; // No move

       // Check adjacency (Manhattan distance must be 1)
       const dist = Math.abs(lastPoint.x - x) + Math.abs(lastPoint.y - y);
       if (dist !== 1) return prev; // Only adjacent moves allowed (prevents skipping)

       // Check validity
       const dot = getDotAt(x, y);
       if (dot && dot.color !== drawingColor) return prev; // Hit wrong dot

       // Check collision with other paths
       const owner = getPathOwner(x, y);
       if (owner && owner !== drawingColor) {
          // Cutting through another path
          const otherPath = prev[owner];
          const idx = otherPath.findIndex(p => p.x === x && p.y === y);
          // Mutate copy of state
          const newPaths = { ...prev };
          newPaths[owner] = otherPath.slice(0, idx); // Cut the other path at intersection
          
          // Add to current path
          newPaths[drawingColor] = [...currentPath, {x, y}];
          return newPaths;
       } 

       // Self-intersection (Backtracking)
       if (owner === drawingColor) {
          const idx = currentPath.findIndex(p => p.x === x && p.y === y);
          // If we touch an earlier part of our own line, cut back to that point
          return {
            ...prev,
            [drawingColor]: currentPath.slice(0, idx + 1)
          };
       }

       // Add new point
       // Stop if we hit target dot
       if (dot && dot.color === drawingColor) {
           // Ensure we don't go past the dot
           return {
               ...prev,
               [drawingColor]: [...currentPath, {x, y}]
           };
       }

       return {
           ...prev,
           [drawingColor]: [...currentPath, {x, y}]
       };
    });
  };

  const handleEnd = () => {
    setDrawingColor(null);
  };

  // Rendering Helpers
  const renderGrid = () => {
     const cells = [];
     const size = currentLevel.size;

     for (let y = 0; y < size; y++) {
         for (let x = 0; x < size; x++) {
             const dot = getDotAt(x, y);
             const pathOwner = getPathOwner(x, y);
             // Determine path connections for styling
             let hasLeft = false, hasRight = false, hasUp = false, hasDown = false;
             
             if (pathOwner) {
                 const p = paths[pathOwner];
                 const idx = p.findIndex(pt => pt.x === x && pt.y === y);
                 // Check neighbors in path
                 if (idx > 0) {
                     const prev = p[idx-1];
                     if (prev.x < x) hasLeft = true;
                     if (prev.x > x) hasRight = true;
                     if (prev.y < y) hasUp = true;
                     if (prev.y > y) hasDown = true;
                 }
                 if (idx < p.length - 1) {
                     const next = p[idx+1];
                     if (next.x < x) hasLeft = true;
                     if (next.x > x) hasRight = true;
                     if (next.y < y) hasUp = true;
                     if (next.y > y) hasDown = true;
                 }
             }

             const colorStyle = pathOwner ? COLORS[pathOwner] : (dot ? COLORS[dot.color] : null);

             cells.push(
                 <div 
                    key={`${x}-${y}`} 
                    // REMOVED inner borders and background for "No Net/Grid" look
                    className="relative pointer-events-none" 
                 >
                     {/* Path Segments (Thick Lines) */}
                     {pathOwner && colorStyle && (
                         <>
                             {/* Center Hub (smooths corners) */}
                             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 ${colorStyle.line} rounded-full ${colorStyle.shadow}`} />
                             {/* Connectors */}
                             {hasUp && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-1/2 ${colorStyle.line} ${colorStyle.shadow}`} />}
                             {hasDown && <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-1/2 ${colorStyle.line} ${colorStyle.shadow}`} />}
                             {hasLeft && <div className={`absolute top-1/2 left-0 -translate-y-1/2 w-1/2 h-1/3 ${colorStyle.line} ${colorStyle.shadow}`} />}
                             {hasRight && <div className={`absolute top-1/2 right-0 -translate-y-1/2 w-1/2 h-1/3 ${colorStyle.line} ${colorStyle.shadow}`} />}
                         </>
                     )}

                     {/* Dot */}
                     {dot && (
                         <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[65%] h-[65%] rounded-full z-10 ${COLORS[dot.color].bg} ${COLORS[dot.color].shadow} ring-4 ring-black/20 transform transition-transform ${drawingColor === dot.color ? 'scale-110' : ''}`} />
                     )}
                 </div>
             );
         }
     }
     return cells;
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
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{levelIndex + 1}</span>
            </div>
         </div>
         
         <button onClick={() => { setPaths({}); setDrawingColor(null); setIsWin(false); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RESET
         </button>
      </div>

      {/* Board */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         <div className="relative aspect-square w-full max-w-[400px] max-h-[400px]">
             
             {/* Grid Container - Outer border only ("Four Corners") */}
             <div 
                ref={containerRef}
                className="w-full h-full bg-[#050505] rounded-xl border border-white/10 shadow-[0_0_40px_rgba(6,182,212,0.1)] overflow-hidden cursor-crosshair grid"
                style={{
                    gridTemplateColumns: `repeat(${currentLevel.size}, 1fr)`,
                    gridTemplateRows: `repeat(${currentLevel.size}, 1fr)`
                }}
                onPointerDown={(e) => {
                    // Start Drawing
                    const rect = containerRef.current!.getBoundingClientRect();
                    const size = currentLevel.size;
                    const cellSize = rect.width / size;
                    const x = Math.floor((e.clientX - rect.left) / cellSize);
                    const y = Math.floor((e.clientY - rect.top) / cellSize);
                    handleStart(x, y);
                    
                    containerRef.current?.setPointerCapture(e.pointerId);
                }}
                onPointerMove={handleMove}
                onPointerUp={(e) => {
                    handleEnd();
                    containerRef.current?.releasePointerCapture(e.pointerId);
                }}
                onPointerLeave={handleEnd}
             >
                 {renderGrid()}
             </div>

             {/* Win Overlay */}
             {isWin && (
               <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-xl animate-[fadeIn_0.5s_ease-out]">
                   <h2 className="text-5xl text-cyan-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] mb-2">Flowing</h2>
                   <div className="w-16 h-1 bg-cyan-500 rounded-full mb-8" />
                   <button 
                      onClick={() => setLevelIndex(prev => prev + 1)}
                      className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95"
                   >
                      NEXT LEVEL
                   </button>
               </div>
            )}
         </div>
      </div>

      {/* Instructions */}
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Connect matching colors</p>
      </div>

    </div>
  );
};

export default FlowGame;