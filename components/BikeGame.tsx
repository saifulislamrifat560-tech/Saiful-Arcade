import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface BikeGameProps {
  onBack: () => void;
}

const BikeGame: React.FC<BikeGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [distance, setDistance] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  // Game State
  const gameState = useRef({
    bike: { x: 150, y: 0, vx: 0, vy: 0, rotation: 0, vr: 0 },
    terrain: [] as {x: number, y: number}[],
    cameraX: 0,
    keys: { gas: false, brake: false },
    gravity: 0.3,
    friction: 0.98,
    speed: 0,
    isPlaying: false
  });

  const generateTerrain = () => {
    const points = [];
    let y = 300;
    // Generate long track
    for(let x = 0; x < 50000; x += 10) {
        // Create rolling hills
        y = 300 + Math.sin(x * 0.005) * 80 + Math.cos(x * 0.02) * 20;
        
        // Ensure bounds 
        if (y > 380) y = 380;
        if (y < 150) y = 150;
        
        points.push({x, y});
    }
    return points;
  };

  const initGame = useCallback(() => {
    gameState.current.terrain = generateTerrain();
    // Start bike higher to drop in
    gameState.current.bike = { x: 150, y: 100, vx: 0, vy: 0, rotation: 0, vr: 0 };
    gameState.current.cameraX = 0;
    gameState.current.speed = 0;
    gameState.current.isPlaying = true;
    setDistance(0);
    setGameOver(false);
  }, []);

  const getTerrainHeight = (x: number) => {
      const t = gameState.current.terrain;
      const segIndex = Math.floor(x / 10);
      
      if (segIndex < 0) return 300;
      if (segIndex >= t.length - 1) return 300;

      const p1 = t[segIndex];
      const p2 = t[segIndex+1];
      const ratio = (x - p1.x) / 10;
      
      return p1.y + (p2.y - p1.y) * ratio;
  };

  const update = useCallback(() => {
     const state = gameState.current;
     if (!state.isPlaying) return;

     const b = state.bike;

     // Input Physics
     if (state.keys.gas) b.vx += 0.2;
     if (state.keys.brake) b.vx -= 0.1;

     b.vx *= state.friction;
     b.x += b.vx;
     
     // Gravity
     b.vy += state.gravity;
     b.y += b.vy;

     // Collision with Ground (Simplified Raycast)
     const groundY = getTerrainHeight(b.x);
     const bikeRadius = 15;
     
     // If touching ground (with tolerance)
     if (b.y > groundY - bikeRadius) { 
         b.y = groundY - bikeRadius;
         b.vy = 0;
         
         // Rotation based on slope
         const nextGroundY = getTerrainHeight(b.x + 10);
         const slopeAngle = Math.atan2(nextGroundY - groundY, 10);
         
         // Interpolate rotation to match slope
         b.rotation = b.rotation * 0.8 + slopeAngle * 0.2;
         
         // Speed boost downhill / drag uphill
         b.vx += Math.sin(slopeAngle) * 0.15;
     } else {
         // Air rotation control
         if (state.keys.gas) b.vr -= 0.05; // Lean back/Wheelie
         if (state.keys.brake) b.vr += 0.05; // Lean forward
         
         b.vr *= 0.95;
         b.rotation += b.vr;
     }

     // Camera Follow
     state.cameraX = b.x - 200; // Keep bike on left side

     // Distance Update
     setDistance(Math.max(0, Math.floor(b.x / 10)));

     // Crash Logic (Too much rotation)
     if (Math.abs(b.rotation) > Math.PI / 1.6) { 
        state.isPlaying = false;
        setGameOver(true);
        audioController.playGameOverSound();
     }

     // Fall off map check
     if (b.y > 600) {
        state.isPlaying = false;
        setGameOver(true);
        audioController.playGameOverSound();
     }

  }, []);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     const state = gameState.current;

     ctx.save();
     
     // Background
     ctx.fillStyle = '#0f172a'; // Dark Slate
     ctx.fillRect(0,0, canvas.width, canvas.height);

     // Camera Transform
     ctx.translate(-state.cameraX, 0);

     // Draw Terrain
     ctx.beginPath();
     // Start from camera left
     const startX = state.cameraX;
     const endX = state.cameraX + canvas.width;
     
     // Find start index
     const startIdx = Math.max(0, Math.floor(startX / 10));
     const endIdx = Math.min(state.terrain.length - 1, Math.ceil(endX / 10) + 1);
     
     ctx.moveTo(state.terrain[startIdx].x, 600); // Bottom left corner
     
     for(let i=startIdx; i<=endIdx; i++) {
         ctx.lineTo(state.terrain[i].x, state.terrain[i].y);
     }
     
     ctx.lineTo(state.terrain[endIdx].x, 600); // Bottom right
     
     ctx.fillStyle = '#1e293b'; // Slate 800
     ctx.fill();
     
     // Top Edge
     ctx.lineWidth = 4;
     ctx.strokeStyle = '#f59e0b'; // Amber 500
     ctx.stroke();

     // Draw Bike
     const b = state.bike;
     ctx.save();
     ctx.translate(b.x, b.y);
     ctx.rotate(b.rotation);

     // Wheels
     ctx.fillStyle = '#000';
     ctx.beginPath(); ctx.arc(-15, 10, 8, 0, Math.PI*2); ctx.fill(); // Rear
     ctx.beginPath(); ctx.arc(15, 10, 8, 0, Math.PI*2); ctx.fill(); // Front
     // Rims
     ctx.strokeStyle = '#64748b';
     ctx.lineWidth = 2;
     ctx.beginPath(); ctx.arc(-15, 10, 5, 0, Math.PI*2); ctx.stroke();
     ctx.beginPath(); ctx.arc(15, 10, 5, 0, Math.PI*2); ctx.stroke();
     
     // Chassis
     ctx.strokeStyle = '#ef4444'; // Red Chassis
     ctx.lineWidth = 4;
     ctx.lineCap = 'round';
     ctx.beginPath();
     ctx.moveTo(-15, 10);
     ctx.lineTo(0, 0);
     ctx.lineTo(15, 10);
     ctx.moveTo(0, 0);
     ctx.lineTo(-5, -15); // Seat
     ctx.moveTo(0, 0);
     ctx.lineTo(10, -10); // Handlebars
     ctx.stroke();
     
     // Rider (Head)
     ctx.fillStyle = '#fff';
     ctx.beginPath(); ctx.arc(0, -25, 6, 0, Math.PI*2); ctx.fill(); 

     ctx.restore(); // Undo bike transform
     ctx.restore(); // Undo camera transform

  }, []);

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Init on mount
    initGame();

    let animId: number;
    const render = () => {
        update();
        draw(ctx, canvas);
        animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [draw, update, initGame]);

  // Controls
  const handleTouchStart = (action: 'gas' | 'brake') => {
      if (action === 'gas') gameState.current.keys.gas = true;
      if (action === 'brake') gameState.current.keys.brake = true;
      if (!gameState.current.isPlaying && gameOver) initGame();
  };

  const handleTouchEnd = (action: 'gas' | 'brake') => {
      if (action === 'gas') gameState.current.keys.gas = false;
      if (action === 'brake') gameState.current.keys.brake = false;
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-black touch-none">
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">Menu</button>
         <div className="flex flex-col items-center">
            <span className="text-orange-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Distance</span>
            <span className="text-3xl text-white font-light tracking-tight">{distance}m</span>
         </div>
         <button onClick={initGame} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">RESET</button>
      </div>

      {/* Game Canvas Container */}
      <div className="flex-1 w-full flex items-center justify-center p-0 min-h-0 relative bg-[#0f172a]">
         {/* Removed object-cover to ensure full canvas visibility without cropping */}
         <canvas 
            ref={canvasRef}
            width={800}
            height={400}
            className="w-full h-full" 
         />
         
         {gameOver && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
                 <h2 className="text-5xl text-orange-500 font-bold uppercase tracking-widest drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]">Crashed</h2>
             </div>
         )}
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 w-full h-32 z-30 bg-transparent flex items-center justify-between px-8 pb-4">
         <button 
             onPointerDown={() => handleTouchStart('brake')} 
             onPointerUp={() => handleTouchEnd('brake')}
             onPointerLeave={() => handleTouchEnd('brake')}
             className="w-24 h-24 bg-red-900/40 border-2 border-red-500 rounded-xl flex items-center justify-center active:bg-red-600/60 shadow-lg shadow-red-900/50"
         >
             <span className="text-red-500 font-bold tracking-widest">BRAKE</span>
         </button>
         
         <button 
             onPointerDown={() => handleTouchStart('gas')} 
             onPointerUp={() => handleTouchEnd('gas')}
             onPointerLeave={() => handleTouchEnd('gas')}
             className="w-24 h-24 bg-green-900/40 border-2 border-green-500 rounded-xl flex items-center justify-center active:bg-green-600/60 shadow-lg shadow-green-900/50"
         >
             <span className="text-green-500 font-bold tracking-widest">GAS</span>
         </button>
      </div>
    </div>
  );
};

export default BikeGame;