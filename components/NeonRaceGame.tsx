import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface NeonRaceGameProps {
  onBack: () => void;
}

const CAR_WIDTH = 40;
const CAR_HEIGHT = 70;
const LANE_WIDTH = 80;
const NUM_LANES = 3;
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 0.001;

interface EnemyCar {
  id: number;
  lane: number;
  y: number;
  speed: number;
  color: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#a855f7', '#ec4899'];

const NeonRaceGame: React.FC<NeonRaceGameProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<'IDLE' | 'PLAYING' | 'GAME_OVER'>('IDLE');

  const gameState = useRef({
    playerLane: 1,
    enemies: [] as EnemyCar[],
    speed: INITIAL_SPEED,
    roadOffset: 0,
    frame: 0,
    score: 0,
    isPlaying: false
  });

  useEffect(() => {
    const saved = localStorage.getItem('race-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const initGame = useCallback(() => {
    gameState.current = {
      playerLane: 1,
      enemies: [],
      speed: INITIAL_SPEED,
      roadOffset: 0,
      frame: 0,
      score: 0,
      isPlaying: true
    };
    setScore(0);
    setGameStatus('PLAYING');
  }, []);

  const spawnEnemy = (canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      const lane = Math.floor(Math.random() * NUM_LANES);
      const carsInLane = state.enemies.filter(e => e.lane === lane);
      if (carsInLane.length > 0 && carsInLane[carsInLane.length-1].y < 200) return;

      state.enemies.push({
          id: Date.now() + Math.random(),
          lane,
          y: -CAR_HEIGHT - 100,
          speed: state.speed * 0.5 + Math.random() * 2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
  };

  const update = useCallback((canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      if (gameStatus !== 'PLAYING') return;

      state.frame++;
      state.speed += SPEED_INCREMENT;
      state.roadOffset = (state.roadOffset + state.speed) % 100;
      state.score += 0.1;
      setScore(Math.floor(state.score));

      if (state.frame % Math.max(20, Math.floor(60 / (state.speed/5))) === 0) {
          spawnEnemy(canvas);
      }

      const boardX = (canvas.width / 2 - (NUM_LANES * LANE_WIDTH) / 2);

      for (let i = state.enemies.length - 1; i >= 0; i--) {
          const enemy = state.enemies[i];
          enemy.y += state.speed - enemy.speed + 2;

          const playerX = boardX + state.playerLane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
          const playerY = canvas.height - 120;
          const enemyX = boardX + enemy.lane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;

          if (
              playerX < enemyX + CAR_WIDTH - 5 &&
              playerX + CAR_WIDTH - 5 > enemyX &&
              playerY < enemy.y + CAR_HEIGHT - 5 &&
              playerY + CAR_HEIGHT - 5 > enemy.y
          ) {
              setGameStatus('GAME_OVER');
              audioController.playGameOverSound();
              if (state.score > highScore) {
                  setHighScore(Math.floor(state.score));
                  localStorage.setItem('race-highscore', Math.floor(state.score).toString());
              }
          }

          if (enemy.y > canvas.height + 100) {
              state.enemies.splice(i, 1);
          }
      }
  }, [gameStatus, highScore]);

  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const state = gameState.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const boardX = (canvas.width / 2 - (NUM_LANES * LANE_WIDTH) / 2);
      const boardW = NUM_LANES * LANE_WIDTH;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(boardX, 0, boardW, canvas.height);

      ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
      ctx.setLineDash([20, 30]);
      ctx.lineDashOffset = -state.roadOffset;
      ctx.lineWidth = 2;
      for (let i = 1; i < NUM_LANES; i++) {
          ctx.beginPath();
          ctx.moveTo(boardX + i * LANE_WIDTH, 0);
          ctx.lineTo(boardX + i * LANE_WIDTH, canvas.height);
          ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(boardX, 0); ctx.lineTo(boardX, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(boardX + boardW, 0); ctx.lineTo(boardX + boardW, canvas.height);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const px = boardX + state.playerLane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
      const py = canvas.height - 120;
      
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#06b6d4';
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.roundRect(px, py, CAR_WIDTH, CAR_HEIGHT, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(px + 5, py + 10, CAR_WIDTH - 10, 15);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(px + 5, py + CAR_HEIGHT - 5, 8, 3);
      ctx.fillRect(px + CAR_WIDTH - 13, py + CAR_HEIGHT - 5, 8, 3);
      ctx.restore();

      state.enemies.forEach(enemy => {
          const ex = boardX + enemy.lane * LANE_WIDTH + (LANE_WIDTH - CAR_WIDTH) / 2;
          ctx.save();
          ctx.shadowBlur = 10;
          ctx.shadowColor = enemy.color;
          ctx.fillStyle = enemy.color;
          ctx.beginPath();
          ctx.roundRect(ex, enemy.y, CAR_WIDTH, CAR_HEIGHT, 8);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(ex + 5, enemy.y + CAR_HEIGHT - 2, 8, 2);
          ctx.fillRect(ex + CAR_WIDTH - 13, enemy.y + CAR_HEIGHT - 2, 8, 2);
          ctx.restore();
      });
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

  const handleLaneChange = (e: React.PointerEvent) => {
      if (gameStatus !== 'PLAYING') return;
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const boardX = (canvasRef.current!.width / 2 - (NUM_LANES * LANE_WIDTH) / 2);
      const boardW = NUM_LANES * LANE_WIDTH;
      
      if (x < boardX + boardW/2) {
          gameState.current.playerLane = Math.max(0, gameState.current.playerLane - 1);
      } else {
          gameState.current.playerLane = Math.min(NUM_LANES - 1, gameState.current.playerLane + 1);
      }
      audioController.playEatSound();
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent touch-none" onPointerDown={handleLaneChange}>
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
                          {gameStatus === 'GAME_OVER' ? 'Crashed' : 'Neon Race'}
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
         <p className="text-white/30 text-[10px] uppercase tracking-widest">Tap Left/Right to Switch Lanes</p>
      </div>
    </div>
  );
};

export default NeonRaceGame;