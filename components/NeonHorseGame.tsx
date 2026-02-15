import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface NeonHorseGameProps {
  onBack: () => void;
}

const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const HORSE_WIDTH = 80;
const HORSE_HEIGHT = 60;
const INITIAL_SPEED = 7;
const SPEED_INCREMENT = 0.0005;

interface Obstacle {
  id: number;
  x: number;
  w: number;
  h: number;
  color: string;
}

const NeonHorseGame: React.FC<NeonHorseGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');

  const gameState = useRef({
    horseY: 0,
    horseVY: 0,
    isGrounded: true,
    obstacles: [] as Obstacle[],
    speed: INITIAL_SPEED,
    frame: 0,
    distance: 0,
    bgOffset: 0,
    animFrame: 0
  });

  useEffect(() => {
    const saved = localStorage.getItem('horse-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    gameState.current = {
      horseY: canvas.height - 100 - HORSE_HEIGHT,
      horseVY: 0,
      isGrounded: true,
      obstacles: [],
      speed: INITIAL_SPEED,
      frame: 0,
      distance: 0,
      bgOffset: 0,
      animFrame: 0
    };
    setScore(0);
    setGameStatus('PLAYING');
  }, []);

  const jump = useCallback(() => {
    const state = gameState.current;
    if (gameStatus === 'PLAYING' && state.isGrounded) {
        state.horseVY = JUMP_FORCE;
        state.isGrounded = false;
        audioController.playEatSound();
    } else if (gameStatus !== 'PLAYING') {
        initGame();
    }
  }, [gameStatus, initGame]);

  const spawnObstacle = (canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    const height = 40 + Math.random() * 30;
    const width = 25 + Math.random() * 15;
    state.obstacles.push({
        id: Date.now(),
        x: canvas.width + 100,
        w: width,
        h: height,
        color: Math.random() > 0.5 ? '#f472b6' : '#a855f7'
    });
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    if (gameStatus !== 'PLAYING') return;

    state.frame++;
    state.animFrame += state.speed * 0.02; // Faster leg animation as speed increases
    state.speed += SPEED_INCREMENT;
    state.distance += state.speed;
    state.bgOffset = (state.bgOffset + state.speed * 0.5) % canvas.width;
    setScore(Math.floor(state.distance / 100));

    // Horse Physics
    state.horseVY += GRAVITY;
    state.horseY += state.horseVY;

    const groundY = canvas.height - 100;
    if (state.horseY > groundY - HORSE_HEIGHT) {
        state.horseY = groundY - HORSE_HEIGHT;
        state.horseVY = 0;
        state.isGrounded = true;
    }

    // Obstacles
    if (state.frame % Math.max(45, Math.floor(110 / (state.speed / 7))) === 0) {
        spawnObstacle(canvas);
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
        const obs = state.obstacles[i];
        obs.x -= state.speed;

        // Optimized Collision Rect
        const hRect = { x: 90, y: state.horseY + 10, w: HORSE_WIDTH - 20, h: HORSE_HEIGHT - 10 };
        const oRect = { x: obs.x, y: groundY - obs.h, w: obs.w, h: obs.h };

        if (
            hRect.x < oRect.x + oRect.w &&
            hRect.x + hRect.w > oRect.x &&
            hRect.y < oRect.y + oRect.h &&
            hRect.y + hRect.h > oRect.y
        ) {
            setGameStatus('GAME_OVER');
            audioController.playGameOverSound();
            const finalScore = Math.floor(state.distance / 100);
            if (finalScore > highScore) {
                setHighScore(finalScore);
                localStorage.setItem('horse-highscore', finalScore.toString());
            }
        }

        if (obs.x < -100) state.obstacles.splice(i, 1);
    }
  }, [gameStatus, highScore]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const groundY = canvas.height - 100;

    // Distant City (Faded grid)
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const bx = ((i * 250) - state.bgOffset * 0.1) % (canvas.width + 250);
        ctx.strokeRect(bx, groundY - 200, 80, 200);
    }

    // Grid Floor with perspective lines
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    for (let i = 0; i < 25; i++) {
        const gx = ((i * 60) - state.bgOffset) % (canvas.width + 60);
        ctx.beginPath();
        ctx.moveTo(gx, groundY);
        ctx.lineTo(gx - 80, canvas.height);
        ctx.stroke();
    }

    // Obstacles
    state.obstacles.forEach(obs => {
        ctx.shadowBlur = 20;
        ctx.shadowColor = obs.color;
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, groundY - obs.h, obs.w, obs.h);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(obs.x, groundY - obs.h, obs.w, 3);
        ctx.shadowBlur = 0;
    });

    // Draw Professional Horse
    ctx.save();
    ctx.translate(80, state.horseY);
    
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#22d3ee';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const t = state.animFrame;
    // Gallop physics math
    const frontLegAngle = Math.sin(t) * 0.8;
    const backLegAngle = Math.sin(t + 0.5) * 0.8;
    const torsoBounce = state.isGrounded ? Math.abs(Math.sin(t * 2)) * 4 : 0;
    
    ctx.translate(0, -torsoBounce);

    // 1. Torso
    ctx.beginPath();
    ctx.ellipse(40, 25, 25, 12, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Neck
    ctx.beginPath();
    ctx.moveTo(58, 20);
    ctx.lineTo(65, 5);
    ctx.stroke();

    // 3. Head
    ctx.beginPath();
    ctx.moveTo(65, 5);
    ctx.lineTo(78, 8); // Muzzle
    ctx.lineTo(75, 15); 
    ctx.lineTo(62, 12);
    ctx.closePath();
    ctx.stroke();
    
    // Ears
    ctx.beginPath();
    ctx.moveTo(68, 4); ctx.lineTo(70, -2); ctx.lineTo(72, 4);
    ctx.stroke();

    // 4. Legs (Articulated)
    const drawLeg = (startX: number, startY: number, angle: number, isBack: boolean) => {
        ctx.save();
        ctx.translate(startX, startY);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(isBack ? -5 : 5, 15); // Upper leg
        ctx.lineTo(isBack ? -2 : 8, 32); // Lower leg
        ctx.stroke();
        
        // Hoof
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(isBack ? -4 : 6, 32, 6, 4);
        ctx.restore();
    };

    if (state.isGrounded) {
        // Back legs
        drawLeg(25, 30, backLegAngle, true);
        drawLeg(20, 30, backLegAngle * 0.8, true);
        // Front legs
        drawLeg(55, 30, frontLegAngle, false);
        drawLeg(50, 30, frontLegAngle * 0.9, false);
    } else {
        // Jump pose: legs tucked or extended
        drawLeg(25, 30, 0.5, true);
        drawLeg(55, 30, -0.5, false);
    }

    // 5. Tail
    ctx.beginPath();
    ctx.moveTo(15, 22);
    ctx.bezierCurveTo(0, 22, -10, 35, -5, 45);
    ctx.stroke();

    // 6. Mane (Dotted line for glow)
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(60, 18);
    ctx.quadraticCurveTo(55, 0, 68, 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 7. Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(70, 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.shadowBlur = 0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth;
            canvas.height = containerRef.current.clientHeight;
        }
    };
    resize();
    window.addEventListener('resize', resize);

    let animId: number;
    const render = () => {
        update(canvas);
        draw(ctx, canvas);
        animId = requestAnimationFrame(render);
    };
    render();
    return () => {
        window.removeEventListener('resize', resize);
        cancelAnimationFrame(animId);
    };
  }, [draw, update]);

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent touch-none" onPointerDown={jump}>
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20 pointer-events-none">
         <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1 pointer-events-auto">
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
                <span className="text-3xl text-white font-light tracking-tight opacity-50">{highScore}</span>
            </div>
         </div>
         <div className="w-12"></div>
      </div>

      <div ref={containerRef} className="flex-1 w-full max-w-lg p-4 relative min-h-0">
          <canvas ref={canvasRef} className="w-full h-full bg-[#050505] rounded-xl border border-white/10 shadow-[0_0_30px_rgba(34,211,238,0.1)]" />

          {(gameStatus === 'IDLE' || gameStatus === 'GAME_OVER') && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-md p-8 rounded-2xl border border-white/10 flex flex-col items-center pointer-events-auto shadow-2xl animate-[fadeIn_0.5s_ease-out]">
                      <h2 className="text-4xl text-cyan-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(34,211,238,0.6)] mb-2">
                          {gameStatus === 'GAME_OVER' ? 'Fallen' : 'Neon Horse'}
                      </h2>
                      {gameStatus === 'GAME_OVER' && <p className="text-white/50 text-sm tracking-[0.3em] mb-6">DISTANCE: {score}m</p>}
                      <button onClick={(e) => { e.stopPropagation(); initGame(); }} className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all active:scale-95 w-full">
                          {gameStatus === 'GAME_OVER' ? 'REBOOT' : 'START'}
                      </button>
                  </div>
              </div>
          )}
      </div>

      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4 pointer-events-none">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Tap to Jump Over Hurdles</p>
      </div>
    </div>
  );
};

export default NeonHorseGame;