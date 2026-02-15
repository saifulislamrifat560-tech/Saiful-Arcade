import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface CarromGameProps {
  onBack: () => void;
}

const BOARD_SIZE = 600;
const POCKET_RADIUS = 25;
const COIN_RADIUS = 12;
const STRIKER_RADIUS = 18;
const BASELINE_Y = 500;
const FRICTION = 0.98;

interface Disc {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type: 'striker' | 'white' | 'black' | 'queen';
  active: boolean;
}

const CarromGame: React.FC<CarromGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x: number, y: number} | null>(null);
  const [canStrike, setCanStrike] = useState(true);

  const gameState = useRef({
    discs: [] as Disc[],
  });

  const initGame = useCallback(() => {
    const discs: Disc[] = [];

    // Striker
    discs.push({
        id: 0, x: BOARD_SIZE/2, y: BASELINE_Y, vx: 0, vy: 0, 
        radius: STRIKER_RADIUS, color: '#fef3c7', type: 'striker', active: true
    });

    // Queen
    discs.push({
        id: 1, x: BOARD_SIZE/2, y: BOARD_SIZE/2, vx: 0, vy: 0,
        radius: COIN_RADIUS, color: '#dc2626', type: 'queen', active: true
    });

    // Coins Setup (Hexagon)
    const centerX = BOARD_SIZE/2;
    const centerY = BOARD_SIZE/2;
    const gap = 2; // small gap
    
    // Inner Circle (6)
    for(let i=0; i<6; i++) {
        const angle = (i * 60) * Math.PI / 180;
        discs.push({
            id: discs.length + 1,
            x: centerX + Math.cos(angle) * (COIN_RADIUS*2 + gap),
            y: centerY + Math.sin(angle) * (COIN_RADIUS*2 + gap),
            vx: 0, vy: 0, radius: COIN_RADIUS,
            color: i % 2 === 0 ? '#fff' : '#1f2937', // Alternate white/black
            type: i % 2 === 0 ? 'white' : 'black',
            active: true
        });
    }

    // Outer Circle (12)
    for(let i=0; i<12; i++) {
        const angle = (i * 30) * Math.PI / 180;
        const dist = (COIN_RADIUS*4 + gap*2); // Rough approximation
        discs.push({
            id: discs.length + 1,
            x: centerX + Math.cos(angle) * dist,
            y: centerY + Math.sin(angle) * dist,
            vx: 0, vy: 0, radius: COIN_RADIUS,
            color: '#fff', // Simplified color logic for outer ring
            type: 'white',
            active: true
        });
        // Fix colors manually for proper pattern? Keeping simple for now.
        // Let's just alternate for visual effect
        discs[discs.length-1].color = (i%2!==0) ? '#fff' : '#1f2937';
        discs[discs.length-1].type = (i%2!==0) ? 'white' : 'black';
    }

    gameState.current.discs = discs;
    setScore(0);
    setCanStrike(true);
  }, []);

  const resolveCollision = (d1: Disc, d2: Disc) => {
      const dx = d2.x - d1.x;
      const dy = d2.y - d1.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minDist = d1.radius + d2.radius;

      if (dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dvx = d2.vx - d1.vx;
          const dvy = d2.vy - d1.vy;
          const vn = dvx * nx + dvy * ny;
          if (vn > 0) return;

          // Simple mass-based collision (Striker heavier)
          const m1 = d1.type === 'striker' ? 2 : 1;
          const m2 = d2.type === 'striker' ? 2 : 1;

          const impulse = (-(1 + 0.8) * vn) / (1/m1 + 1/m2);
          
          d1.vx -= (impulse / m1) * nx;
          d1.vy -= (impulse / m1) * ny;
          d2.vx += (impulse / m2) * nx;
          d2.vy += (impulse / m2) * ny;

          // Unstuck
          const overlap = (minDist - dist) / 2;
          d1.x -= overlap * nx;
          d1.y -= overlap * ny;
          d2.x += overlap * nx;
          d2.y += overlap * ny;
          
          if (Math.abs(impulse) > 0.5) audioController.playEatSound();
      }
  };

  const update = useCallback(() => {
    const state = gameState.current;
    let moving = false;

    // Physics
    state.discs.forEach(d => {
        if (!d.active) return;
        
        d.x += d.vx;
        d.y += d.vy;
        d.vx *= FRICTION;
        d.vy *= FRICTION;

        if (Math.abs(d.vx) < 0.05) d.vx = 0;
        if (Math.abs(d.vy) < 0.05) d.vy = 0;
        if (d.vx !== 0 || d.vy !== 0) moving = true;

        // Walls
        if (d.x - d.radius < 0) { d.x = d.radius; d.vx *= -0.7; }
        if (d.x + d.radius > BOARD_SIZE) { d.x = BOARD_SIZE - d.radius; d.vx *= -0.7; }
        if (d.y - d.radius < 0) { d.y = d.radius; d.vy *= -0.7; }
        if (d.y + d.radius > BOARD_SIZE) { d.y = BOARD_SIZE - d.radius; d.vy *= -0.7; }

        // Pockets
        const pockets = [
            {x: 0, y: 0}, {x: BOARD_SIZE, y: 0},
            {x: 0, y: BOARD_SIZE}, {x: BOARD_SIZE, y: BOARD_SIZE}
        ];
        
        pockets.forEach(p => {
            if (Math.hypot(d.x - p.x, d.y - p.y) < POCKET_RADIUS) {
                if (d.type === 'striker') {
                    // Foul
                    d.x = BOARD_SIZE/2; d.y = BASELINE_Y; d.vx=0; d.vy=0;
                    audioController.playGameOverSound();
                } else {
                    d.active = false;
                    setScore(s => s + (d.type === 'queen' ? 50 : 10));
                    audioController.playEatSound();
                }
            }
        });
    });

    // Collisions
    for (let i=0; i<state.discs.length; i++) {
        for (let j=i+1; j<state.discs.length; j++) {
            if (state.discs[i].active && state.discs[j].active) {
                resolveCollision(state.discs[i], state.discs[j]);
            }
        }
    }

    if (!moving && !canStrike) {
        // Turn ended
        setCanStrike(true);
        // Reset striker to baseline if active
        const striker = state.discs[0];
        if (striker) {
            striker.vx = 0;
            striker.vy = 0;
            striker.y = BASELINE_Y; // Reset to baseline
            // Ensure within bounds
            if (striker.x < STRIKER_RADIUS) striker.x = STRIKER_RADIUS;
            if (striker.x > BOARD_SIZE-STRIKER_RADIUS) striker.x = BOARD_SIZE-STRIKER_RADIUS;
        }
    } else if (moving) {
        setCanStrike(false);
    }

  }, [canStrike]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);

      // Board
      ctx.fillStyle = '#fde68a'; // Beige/Wood
      ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);
      
      // Design Lines
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, BOARD_SIZE-80, BOARD_SIZE-80);
      
      // Pockets
      ctx.fillStyle = '#000';
      [
        {x: 0, y: 0}, {x: BOARD_SIZE, y: 0},
        {x: 0, y: BOARD_SIZE}, {x: BOARD_SIZE, y: BOARD_SIZE}
      ].forEach(p => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI*2);
          ctx.fill();
      });

      // Baseline
      ctx.beginPath();
      ctx.moveTo(40, BASELINE_Y);
      ctx.lineTo(BOARD_SIZE-40, BASELINE_Y);
      ctx.strokeStyle = '#000';
      ctx.stroke();

      // Discs
      gameState.current.discs.forEach(d => {
          if (!d.active) return;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.radius, 0, Math.PI*2);
          ctx.fillStyle = d.color;
          ctx.fill();
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Pattern for striker
          if (d.type === 'striker') {
              ctx.beginPath();
              ctx.arc(d.x, d.y, d.radius * 0.7, 0, Math.PI*2);
              ctx.strokeStyle = '#d97706';
              ctx.stroke();
          }
      });

      // Drag Line
      if (isAiming && dragStart && dragCurrent && canStrike) {
          const striker = gameState.current.discs[0];
          ctx.beginPath();
          ctx.moveTo(striker.x, striker.y);
          ctx.lineTo(
              striker.x + (dragStart.x - dragCurrent.x) * 1.5,
              striker.y + (dragStart.y - dragCurrent.y) * 1.5
          );
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
      }

  }, [isAiming, dragStart, dragCurrent, canStrike]);

  // Loop
  useEffect(() => {
    if (score === 0 && canStrike) initGame();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let id: number;
    const render = () => {
        update();
        draw(ctx);
        id = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(id);
  }, [update, draw, initGame, score, canStrike]);

  // Input
  const handlePointerDown = (e: React.PointerEvent) => {
      if (!canStrike) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (BOARD_SIZE/rect.width);
      const y = (e.clientY - rect.top) * (BOARD_SIZE/rect.height);
      
      const striker = gameState.current.discs[0];
      
      // If clicking on striker, prepare aim
      if (Math.hypot(x - striker.x, y - striker.y) < STRIKER_RADIUS * 2) {
          setIsAiming(true);
          setDragStart({x, y});
          setDragCurrent({x, y});
          canvasRef.current?.setPointerCapture(e.pointerId);
      } else if (Math.abs(y - BASELINE_Y) < 30) {
          // Move striker along baseline before aiming
          striker.x = Math.max(STRIKER_RADIUS, Math.min(BOARD_SIZE-STRIKER_RADIUS, x));
          striker.vx = 0; striker.vy = 0;
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!canStrike) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (BOARD_SIZE/rect.width);
      const y = (e.clientY - rect.top) * (BOARD_SIZE/rect.height);

      if (isAiming) {
          setDragCurrent({x, y});
      } else if (Math.abs(y - BASELINE_Y) < 30 && (e.buttons === 1)) {
          // Sliding mode
          const striker = gameState.current.discs[0];
          striker.x = Math.max(STRIKER_RADIUS, Math.min(BOARD_SIZE-STRIKER_RADIUS, x));
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (isAiming && dragStart && dragCurrent) {
          const dx = dragStart.x - dragCurrent.x;
          const dy = dragStart.y - dragCurrent.y;
          const power = Math.min(25, Math.hypot(dx, dy) * 0.2);
          const angle = Math.atan2(dy, dx);
          
          const striker = gameState.current.discs[0];
          striker.vx = Math.cos(angle) * power;
          striker.vy = Math.sin(angle) * power;
          
          audioController.playEatSound();
      }
      setIsAiming(false);
      setDragStart(null);
      setDragCurrent(null);
      canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent touch-none">
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">Menu</button>
         <div className="flex flex-col items-center">
            <span className="text-amber-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
            <span className="text-3xl text-white font-light tracking-tight">{score}</span>
         </div>
         <button onClick={initGame} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">RESET</button>
      </div>

      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         <div className="relative aspect-square h-full max-h-[600px] w-full max-w-[600px] bg-[#3f1d0b] p-4 rounded-xl shadow-2xl">
             <canvas 
                ref={canvasRef}
                width={BOARD_SIZE}
                height={BOARD_SIZE}
                className="w-full h-full bg-[#fde68a] rounded shadow-inner cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
             />
         </div>
      </div>
      
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-6 flex flex-col items-center gap-4">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">
             {canStrike ? "Place Striker & Drag to Shoot" : "Wait..."}
         </p>
      </div>
    </div>
  );
};

export default CarromGame;
