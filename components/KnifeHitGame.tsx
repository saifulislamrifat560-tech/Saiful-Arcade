import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface KnifeHitGameProps {
  onBack: () => void;
}

const TARGET_RADIUS = 70;
const KNIFE_LENGTH = 80;
const KNIFE_WIDTH = 12;
const THROW_SPEED = 28;
const ROTATION_SPEED_BASE = 0.035;

interface Knife {
  angle: number; // Angle on the target (radians)
  id: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const KnifeHitGame: React.FC<KnifeHitGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [knivesLeft, setKnivesLeft] = useState(7);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER' | 'WIN'>('IDLE');

  // Game State Refs
  const gameState = useRef({
    targetRotation: 0,
    rotationSpeed: ROTATION_SPEED_BASE,
    stuckKnives: [] as Knife[],
    activeKnifeY: 0,
    particles: [] as Particle[],
    isThrowing: false,
    shake: 0,
    flash: 0,
    rotationPattern: 'CONSTANT' as 'CONSTANT' | 'VARIABLE' | 'REVERSE',
    patternTimer: 0,
    knivesToThrowTotal: 7
  });

  useEffect(() => {
    const saved = localStorage.getItem('knife-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const initLevel = useCallback((lvl: number) => {
    const totalKnives = Math.min(6 + Math.ceil(lvl / 2), 12);
    setKnivesLeft(totalKnives);
    setGameStatus('PLAYING');

    gameState.current = {
      targetRotation: 0,
      rotationSpeed: ROTATION_SPEED_BASE + (lvl * 0.003),
      stuckKnives: [],
      activeKnifeY: 0, // Reset in render
      particles: [],
      isThrowing: false,
      shake: 0,
      flash: 0,
      rotationPattern: lvl % 3 === 0 ? 'VARIABLE' : (lvl % 2 === 0 ? 'REVERSE' : 'CONSTANT'),
      patternTimer: 0,
      knivesToThrowTotal: totalKnives
    };

    // Pre-stuck knives for challenge
    if (lvl > 2) {
        const preStuckCount = Math.min(Math.floor(lvl / 2.5), 4);
        for(let i=0; i<preStuckCount; i++) {
            gameState.current.stuckKnives.push({
                id: -i,
                angle: (Math.PI * 2 * i) / preStuckCount + Math.random()
            });
        }
    }
  }, []);

  const handleThrow = () => {
    const state = gameState.current;
    if (state.isThrowing || gameStatus !== 'PLAYING' || knivesLeft <= 0) {
        if (gameStatus === 'GAME_OVER') {
            initLevel(1);
            setScore(0);
        } else if (gameStatus === 'IDLE') {
            initLevel(1);
        }
        return;
    }
    state.isThrowing = true;
  };

  const spawnParticles = (x: number, y: number, color: string) => {
      for(let i=0; i<12; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6 + 2;
          gameState.current.particles.push({
              x, y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 25,
              color
          });
      }
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    if (gameStatus !== 'PLAYING') return;

    // 1. Rotation Logic
    state.patternTimer++;
    if (state.rotationPattern === 'VARIABLE') {
        state.rotationSpeed = (Math.sin(state.patternTimer * 0.04) * 0.07);
    } else if (state.rotationPattern === 'REVERSE') {
        if (state.patternTimer % 140 === 0) state.rotationSpeed *= -1;
    }
    state.targetRotation += state.rotationSpeed;

    // 2. Throwing Logic
    if (state.isThrowing) {
        state.activeKnifeY -= THROW_SPEED;
        const targetCenterY = canvas.height * 0.35;
        const hitLimit = targetCenterY + TARGET_RADIUS;

        if (state.activeKnifeY <= hitLimit) {
            // Impact!
            let impactAngle = (Math.PI / 2) - state.targetRotation;
            impactAngle = impactAngle % (Math.PI * 2);
            if (impactAngle < 0) impactAngle += Math.PI * 2;

            const safeZone = 0.28; // Radian tolerance
            let collision = false;

            for (const k of state.stuckKnives) {
                let diff = Math.abs(k.angle - impactAngle);
                if (diff > Math.PI) diff = (Math.PI * 2) - diff;
                if (diff < safeZone) { collision = true; break; }
            }

            if (collision) {
                setGameStatus('GAME_OVER');
                state.shake = 20;
                audioController.playGameOverSound();
                spawnParticles(canvas.width/2, hitLimit, '#ef4444');
                if (score > highScore) {
                    setHighScore(score);
                    localStorage.setItem('knife-highscore', score.toString());
                }
            } else {
                state.stuckKnives.push({ id: Date.now(), angle: impactAngle });
                state.isThrowing = false;
                state.activeKnifeY = canvas.height - 120;
                state.shake = 6;
                spawnParticles(canvas.width/2, hitLimit, '#22d3ee');
                audioController.playEatSound();

                const newScore = score + 1;
                setScore(newScore);
                setKnivesLeft(prev => {
                    const next = prev - 1;
                    if (next <= 0) {
                        setTimeout(() => setLevel(l => l + 1), 600);
                    }
                    return next;
                });
            }
        }
    } else {
        state.activeKnifeY = canvas.height - 120;
    }

    // 3. Particles & Effects
    state.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; });
    state.particles = state.particles.filter(p => p.life > 0);
    if (state.shake > 0) state.shake *= 0.9;

  }, [gameStatus, highScore, score]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const state = gameState.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.35;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (state.shake > 0.5) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }

    // Draw Target
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(state.targetRotation);

    ctx.beginPath();
    ctx.arc(0, 0, TARGET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#f472b6';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Stuck Knives
    state.stuckKnives.forEach(knife => {
        ctx.save();
        ctx.rotate(knife.angle);
        ctx.translate(TARGET_RADIUS, 0);
        ctx.fillStyle = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#22d3ee';
        ctx.fillRect(0, -KNIFE_WIDTH/2, KNIFE_LENGTH, KNIFE_WIDTH);
        ctx.fillStyle = '#fff';
        ctx.fillRect(15, -KNIFE_WIDTH/2 + 3, KNIFE_LENGTH - 20, KNIFE_WIDTH - 6);
        ctx.restore();
    });
    ctx.restore();

    // Active Knife
    if (gameStatus === 'PLAYING' && knivesLeft > 0) {
        ctx.save();
        ctx.translate(centerX, state.activeKnifeY);
        ctx.fillStyle = '#22d3ee';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(KNIFE_WIDTH, 20);
        ctx.lineTo(KNIFE_WIDTH, 70);
        ctx.lineTo(-KNIFE_WIDTH, 70);
        ctx.lineTo(-KNIFE_WIDTH, 20);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-KNIFE_WIDTH + 4, 30, KNIFE_WIDTH * 2 - 8, 35);
        ctx.restore();
    }

    // Particles
    state.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 25;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    ctx.restore();

  }, [gameStatus, knivesLeft]);

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
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent touch-none" onPointerDown={handleThrow}>
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20 pointer-events-none">
         <button onClick={(e) => { e.stopPropagation(); onBack(); }} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1 pointer-events-auto">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>
         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-pink-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Level</span>
                <span className="text-3xl text-white font-light tracking-tight">{level}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-pink-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight">{score}</span>
            </div>
         </div>
         <div className="w-12"></div>
      </div>

      <div ref={containerRef} className="flex-1 w-full max-w-lg p-4 relative min-h-0">
          <canvas ref={canvasRef} className="w-full h-full bg-[#050505] rounded-xl border border-white/10 shadow-[0_0_30px_rgba(244,114,182,0.1)] cursor-pointer" />
          
          <div className="absolute left-8 bottom-12 flex flex-col-reverse gap-2 pointer-events-none">
             {[...Array(gameState.current.knivesToThrowTotal)].map((_, i) => (
                 <div key={i} className={`w-2 h-8 rounded-full transition-all duration-300 ${i < knivesLeft ? 'bg-cyan-400 shadow-[0_0_8px_cyan]' : 'bg-gray-800 opacity-30'}`} />
             ))}
          </div>

          {(gameStatus === 'IDLE' || gameStatus === 'GAME_OVER') && (
              <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="bg-black/80 backdrop-blur-md p-8 rounded-2xl border border-white/10 flex flex-col items-center pointer-events-auto shadow-2xl animate-[fadeIn_0.5s_ease-out]">
                      <h2 className="text-4xl text-pink-500 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(244,114,182,0.6)] mb-2">
                          {gameStatus === 'GAME_OVER' ? 'Systems Failed' : 'Neon Knife'}
                      </h2>
                      {gameStatus === 'GAME_OVER' && <p className="text-white/50 text-sm tracking-[0.3em] mb-6">BEST: {highScore}</p>}
                      <button onClick={(e) => { e.stopPropagation(); initLevel(1); setScore(0); }} className="px-10 py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold tracking-[0.2em] rounded-full shadow-[0_0_20px_rgba(244,114,182,0.4)] transition-all active:scale-95 w-full">
                          {gameStatus === 'GAME_OVER' ? 'REBOOT' : 'START'}
                      </button>
                  </div>
              </div>
          )}
      </div>

      <div className="flex-shrink-0 w-full z-30 bg-transparent pt-2 pb-8 flex flex-col items-center gap-4 pointer-events-none">
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Tap to Throw Knife</p>
      </div>
    </div>
  );
};

export default KnifeHitGame;