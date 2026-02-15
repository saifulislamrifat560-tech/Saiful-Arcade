import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface PoolGameProps {
  onBack: () => void;
}

const TABLE_WIDTH = 300;
const TABLE_HEIGHT = 600;
const BALL_RADIUS = 8;
const POCKET_RADIUS = 16;
const FRICTION = 0.985;
const VELOCITY_THRESHOLD = 0.05;

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  isCue: boolean;
  active: boolean;
}

const PoolGame: React.FC<PoolGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x: number, y: number} | null>(null);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');

  const gameState = useRef({
    balls: [] as Ball[],
    moving: false
  });

  const initGame = useCallback(() => {
    const balls: Ball[] = [];
    
    // Cue Ball
    balls.push({
      id: 0, x: TABLE_WIDTH / 2, y: TABLE_HEIGHT * 0.75,
      vx: 0, vy: 0, color: '#fff', isCue: true, active: true
    });

    // Rack of balls (Pyramid)
    const startY = TABLE_HEIGHT * 0.25;
    const startX = TABLE_WIDTH / 2;
    const colors = ['#facc15', '#2563eb', '#dc2626', '#7e22ce', '#f97316', '#16a34a', '#881337', '#000', '#facc15', '#2563eb', '#dc2626', '#7e22ce', '#f97316', '#16a34a', '#881337'];
    
    let k = 0;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col <= row; col++) {
        const x = startX - (row * BALL_RADIUS) + (col * BALL_RADIUS * 2) + (Math.random() - 0.5); // Slight jitter
        const y = startY - (row * BALL_RADIUS * 1.732);
        if (k < colors.length) {
            balls.push({
                id: k + 1, x, y, vx: 0, vy: 0, 
                color: colors[k], isCue: false, active: true
            });
            k++;
        }
      }
    }
    
    gameState.current.balls = balls;
    gameState.current.moving = false;
    setScore(0);
    setGameStatus('PLAYING');
  }, []);

  const resolveCollision = (b1: Ball, b2: Ball) => {
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < BALL_RADIUS * 2) {
      // Collision normal
      const nx = dx / distance;
      const ny = dy / distance;

      // Relative velocity
      const dvx = b2.vx - b1.vx;
      const dvy = b2.vy - b1.vy;

      // Velocity along normal
      const velAlongNormal = dvx * nx + dvy * ny;

      // Do not resolve if velocities are separating
      if (velAlongNormal > 0) return;

      // Elastic collision
      const j = -(1 + 0.9) * velAlongNormal; // 0.9 restitution
      const impulse = j / 2; // Equal mass

      b1.vx -= impulse * nx;
      b1.vy -= impulse * ny;
      b2.vx += impulse * nx;
      b2.vy += impulse * ny;

      // Overlap correction
      const overlap = (BALL_RADIUS * 2 - distance) / 2;
      b1.x -= overlap * nx;
      b1.y -= overlap * ny;
      b2.x += overlap * nx;
      b2.y += overlap * ny;
      
      // Sound
      if (Math.abs(impulse) > 1) audioController.playEatSound();
    }
  };

  const update = useCallback(() => {
    if (gameStatus !== 'PLAYING') return;
    const state = gameState.current;
    let isMoving = false;

    // Update Physics
    for (let i = 0; i < state.balls.length; i++) {
      const b = state.balls[i];
      if (!b.active) continue;

      // Move
      b.x += b.vx;
      b.y += b.vy;

      // Friction
      b.vx *= FRICTION;
      b.vy *= FRICTION;

      if (Math.abs(b.vx) < VELOCITY_THRESHOLD) b.vx = 0;
      if (Math.abs(b.vy) < VELOCITY_THRESHOLD) b.vy = 0;

      if (b.vx !== 0 || b.vy !== 0) isMoving = true;

      // Walls
      if (b.x - BALL_RADIUS < 0) { b.x = BALL_RADIUS; b.vx *= -0.8; }
      if (b.x + BALL_RADIUS > TABLE_WIDTH) { b.x = TABLE_WIDTH - BALL_RADIUS; b.vx *= -0.8; }
      if (b.y - BALL_RADIUS < 0) { b.y = BALL_RADIUS; b.vy *= -0.8; }
      if (b.y + BALL_RADIUS > TABLE_HEIGHT) { b.y = TABLE_HEIGHT - BALL_RADIUS; b.vy *= -0.8; }

      // Pockets
      const pockets = [
        {x: 0, y: 0}, {x: TABLE_WIDTH, y: 0},
        {x: 0, y: TABLE_HEIGHT/2}, {x: TABLE_WIDTH, y: TABLE_HEIGHT/2},
        {x: 0, y: TABLE_HEIGHT}, {x: TABLE_WIDTH, y: TABLE_HEIGHT}
      ];

      for (const p of pockets) {
        const pdx = b.x - p.x;
        const pdy = b.y - p.y;
        if (Math.sqrt(pdx*pdx + pdy*pdy) < POCKET_RADIUS) {
            if (b.isCue) {
                // Scratch
                b.x = TABLE_WIDTH / 2;
                b.y = TABLE_HEIGHT * 0.75;
                b.vx = 0; b.vy = 0;
                audioController.playGameOverSound();
            } else {
                b.active = false;
                setScore(s => s + 100);
                audioController.playEatSound();
            }
        }
      }
    }

    // Ball-Ball Collisions
    for (let i = 0; i < state.balls.length; i++) {
        for (let j = i + 1; j < state.balls.length; j++) {
            if (state.balls[i].active && state.balls[j].active) {
                resolveCollision(state.balls[i], state.balls[j]);
            }
        }
    }

    state.moving = isMoving;

    // Win check
    if (state.balls.filter(b => !b.isCue && b.active).length === 0) {
        setGameStatus('GAME_OVER'); // Actually Win
    }

  }, [gameStatus]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    
    // Table Felt
    ctx.fillStyle = '#15803d'; // Green-700
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    
    // Pockets
    ctx.fillStyle = '#000';
    [
        {x: 0, y: 0}, {x: TABLE_WIDTH, y: 0},
        {x: 0, y: TABLE_HEIGHT/2}, {x: TABLE_WIDTH, y: TABLE_HEIGHT/2},
        {x: 0, y: TABLE_HEIGHT}, {x: TABLE_WIDTH, y: TABLE_HEIGHT}
    ].forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    });

    // Balls
    gameState.current.balls.forEach(b => {
        if (!b.active) return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        // Shine
        ctx.beginPath();
        ctx.arc(b.x - 2, b.y - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();
    });

    // Cue Stick (if dragging)
    if (isDragging && dragStart && dragCurrent) {
        const cueBall = gameState.current.balls.find(b => b.isCue);
        if (cueBall) {
            ctx.beginPath();
            ctx.moveTo(cueBall.x, cueBall.y);
            ctx.lineTo(
                cueBall.x + (dragStart.x - dragCurrent.x) * 2, 
                cueBall.y + (dragStart.y - dragCurrent.y) * 2
            );
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

  }, [isDragging, dragStart, dragCurrent]);

  // Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const render = () => {
        update();
        draw(ctx);
        animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [draw, update]);

  // Input Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
      if (gameState.current.moving) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (TABLE_WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (TABLE_HEIGHT / rect.height);
      
      const cueBall = gameState.current.balls.find(b => b.isCue);
      if (cueBall && Math.hypot(x - cueBall.x, y - cueBall.y) < BALL_RADIUS * 4) {
          setIsDragging(true);
          setDragStart({x, y});
          setDragCurrent({x, y});
          canvasRef.current?.setPointerCapture(e.pointerId);
      }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging) return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (TABLE_WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (TABLE_HEIGHT / rect.height);
      setDragCurrent({x, y});
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (!isDragging || !dragStart || !dragCurrent) return;
      const dx = dragStart.x - dragCurrent.x;
      const dy = dragStart.y - dragCurrent.y;
      
      // Shoot
      const cueBall = gameState.current.balls.find(b => b.isCue);
      if (cueBall) {
          const power = Math.min(20, Math.sqrt(dx*dx + dy*dy) * 0.15);
          const angle = Math.atan2(dy, dx);
          cueBall.vx = Math.cos(angle) * power;
          cueBall.vy = Math.sin(angle) * power;
          audioController.playEatSound();
      }

      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      canvasRef.current?.releasePointerCapture(e.pointerId);
  };

  // Resize
  useEffect(() => {
      if (gameStatus === 'IDLE') initGame();
  }, [gameStatus, initGame]);

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent touch-none">
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">
            Menu
         </button>
         <div className="flex flex-col items-center">
            <span className="text-emerald-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
            <span className="text-3xl text-white font-light tracking-tight">{score}</span>
         </div>
         <button onClick={initGame} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RESET
         </button>
      </div>

      {/* Table */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         <div className="relative h-full max-h-[600px] aspect-[1/2] rounded-xl border-4 border-amber-900 bg-amber-900 shadow-2xl overflow-hidden">
             <canvas 
                ref={canvasRef}
                width={TABLE_WIDTH}
                height={TABLE_HEIGHT}
                className="w-full h-full cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
             />
         </div>
      </div>
      
      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-6 flex flex-col items-center gap-4">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Drag on Cue Ball to Shoot</p>
      </div>
    </div>
  );
};

export default PoolGame;
