import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Coordinate, Direction, GameStatus, SpeedLevel } from '../types';
import { GRID_SIZE, INITIAL_SNAKE, LEVEL_UP_SCORE_THRESHOLD, SPEED_DECREMENT_PER_LEVEL, MIN_SPEED_MS } from '../constants';
import { audioController } from '../utils/audio';
import { Dpad } from './Dpad';

interface SnakeGameProps {
  onBack: () => void;
}

const SnakeGame: React.FC<SnakeGameProps> = ({ onBack }) => {
  // --- State ---
  const [snake, setSnake] = useState<Coordinate[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Coordinate>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>(Direction.UP);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [baseSpeed, setBaseSpeed] = useState<number>(SpeedLevel.MEDIUM);
  const [currentSpeed, setCurrentSpeed] = useState<number>(SpeedLevel.MEDIUM);
  const [level, setLevel] = useState(1);

  // --- Refs ---
  const snakeRef = useRef(snake);
  const directionRef = useRef(direction);
  const lastProcessedDirectionRef = useRef(direction);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('snake-highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake-highscore', score.toString());
    }
  }, [score, highScore]);

  // --- Helpers ---
  const generateFood = (currentSnake: Coordinate[]): Coordinate => {
    let newFood: Coordinate;
    let isCollision;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      isCollision = currentSnake.some(seg => seg.x === newFood.x && seg.y === newFood.y);
    } while (isCollision);
    return newFood;
  };

  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    snakeRef.current = INITIAL_SNAKE;
    setDirection(Direction.UP);
    directionRef.current = Direction.UP;
    lastProcessedDirectionRef.current = Direction.UP;
    setScore(0);
    setLevel(1);
    setCurrentSpeed(baseSpeed);
    setFood(generateFood(INITIAL_SNAKE));
    setStatus(GameStatus.PLAYING);
    gameContainerRef.current?.focus();
  };

  const gameOver = () => {
    setStatus(GameStatus.GAME_OVER);
    audioController.playGameOverSound();
  };

  // --- Input Handling ---
  const handleDirectionChange = useCallback((newDir: Direction) => {
    // FIX: If game is IDLE or GAME_OVER, pressing a direction starts the game
    if (status !== GameStatus.PLAYING) {
       if (status === GameStatus.IDLE) {
         startGame();
         // Don't apply direction immediately to avoid instant death if it's opposite
         return; 
       }
       return;
    }

    const currentDir = lastProcessedDirectionRef.current;
    
    if (newDir === Direction.UP && currentDir === Direction.DOWN) return;
    if (newDir === Direction.DOWN && currentDir === Direction.UP) return;
    if (newDir === Direction.LEFT && currentDir === Direction.RIGHT) return;
    if (newDir === Direction.RIGHT && currentDir === Direction.LEFT) return;

    directionRef.current = newDir;
    setDirection(newDir);
  }, [status]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
      e.preventDefault();
    }

    switch (e.key) {
      case 'ArrowUp': handleDirectionChange(Direction.UP); break;
      case 'ArrowDown': handleDirectionChange(Direction.DOWN); break;
      case 'ArrowLeft': handleDirectionChange(Direction.LEFT); break;
      case 'ArrowRight': handleDirectionChange(Direction.RIGHT); break;
      case ' ': 
        if (status === GameStatus.IDLE || status === GameStatus.GAME_OVER) {
          startGame();
        } 
        break;
    }
  }, [status, handleDirectionChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);


  // --- Game Loop ---
  const moveSnake = useCallback(() => {
    if (status !== GameStatus.PLAYING) return;

    const head = { ...snakeRef.current[0] };
    const currentDir = directionRef.current;
    lastProcessedDirectionRef.current = currentDir;

    switch (currentDir) {
      case Direction.UP: head.y -= 1; break;
      case Direction.DOWN: head.y += 1; break;
      case Direction.LEFT: head.x -= 1; break;
      case Direction.RIGHT: head.x += 1; break;
    }

    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      gameOver();
      return;
    }

    for (let i = 0; i < snakeRef.current.length - 1; i++) {
      if (head.x === snakeRef.current[i].x && head.y === snakeRef.current[i].y) {
        gameOver();
        return;
      }
    }

    const newSnake = [head, ...snakeRef.current];

    if (head.x === food.x && head.y === food.y) {
      audioController.playEatSound();
      const newScore = score + 1;
      setScore(newScore);
      
      if (newScore > 0 && newScore % LEVEL_UP_SCORE_THRESHOLD === 0) {
        setLevel(prev => prev + 1);
        setCurrentSpeed(prev => Math.max(MIN_SPEED_MS, prev - SPEED_DECREMENT_PER_LEVEL));
      }

      setFood(generateFood(newSnake));
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
    setSnake(newSnake);
  }, [food, score, status]);

  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;
    const intervalId = setInterval(moveSnake, currentSpeed);
    return () => clearInterval(intervalId);
  }, [status, currentSpeed, moveSnake]);


  // --- Rendering ---
  const renderGrid = () => {
    const cells = [];
    const snakeSet = new Set(snake.map(s => `${s.x},${s.y}`));
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const isSnake = snakeSet.has(`${x},${y}`);
        const isFood = food.x === x && food.y === y;
        const isHead = snake[0].x === x && snake[0].y === y;
        
        let cellClass = "w-full h-full relative "; 
        
        if (isHead) {
           cellClass += "bg-cyan-300 rounded-sm shadow-[0_0_20px_2px_rgba(103,232,249,0.8)] z-20 scale-105";
        } else if (isSnake) {
           cellClass += "bg-gradient-to-br from-cyan-600 to-blue-700 rounded-[1px] shadow-[0_0_8px_rgba(8,145,178,0.4)] opacity-95";
        } else if (isFood) {
           cellClass += "bg-gradient-to-tr from-rose-500 to-amber-500 rounded-full scale-[0.65] shadow-[0_0_15px_2px_rgba(244,63,94,0.6)] animate-[soft-pulse_1.5s_ease-in-out_infinite]";
        } else {
           cellClass += "bg-transparent";
        }

        cells.push(
          <div key={`${x}-${y}`} className={cellClass}>
             {!isSnake && !isFood && (
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-[2px] bg-white/[0.03] rounded-full" />
             )}
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none outline-none overflow-hidden bg-transparent" ref={gameContainerRef} tabIndex={0}>
      
      {/* 1. Header (Fixed Height) */}
      <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>

         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Score</span>
                <span className="text-3xl text-white font-light tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">{score}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-cyan-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Best</span>
                <span className="text-3xl text-cyan-50 font-light tracking-tight opacity-80">{highScore}</span>
            </div>
         </div>
         
         <div className="w-12"></div>
      </div>

      {/* 2. Game Board Container */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         {/* CONSTRAINT ADDED: max-w-[400px] makes it look like mobile even on desktop */}
         <div className="relative aspect-square h-full max-h-[400px] w-full max-w-[400px]">
            <div className="w-full h-full rounded-2xl bg-[#050505] border border-white/5 shadow-2xl overflow-hidden relative">
                
                {/* Board Background */}
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

                {/* The Grid */}
                <div 
                    className="grid gap-px w-full h-full relative z-10"
                    style={{
                        gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                    }}
                >
                    {renderGrid()}
                </div>
            </div>

            {/* Overlay: Start / Game Over */}
            {(status === GameStatus.IDLE || status === GameStatus.GAME_OVER) && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 animate-[fadeIn_0.3s_ease-out]">
                    
                    <div className="relative z-10 flex flex-col items-center w-full px-6 text-center">
                        
                        {status === GameStatus.GAME_OVER && (
                            <div className="flex flex-col items-center mb-6">
                                <h2 className="text-5xl text-rose-500 font-thin tracking-widest uppercase drop-shadow-[0_0_25px_rgba(225,29,72,0.5)]">Wasted</h2>
                                <span className="text-white/60 font-mono mt-2">SCORE: {score}</span>
                            </div>
                        )}
                        
                        {status === GameStatus.IDLE && (
                            <div className="mb-8">
                                <h1 className="text-5xl font-extralight text-white tracking-tighter drop-shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                                    NEON<span className="font-bold text-cyan-400">SNAKE</span>
                                </h1>
                            </div>
                        )}

                        {/* Difficulty */}
                        <div className="w-full max-w-[260px] p-1 bg-white/5 rounded-full border border-white/10 flex mb-8">
                            {[
                                { label: 'SLOW', value: SpeedLevel.SLOW },
                                { label: 'MED', value: SpeedLevel.MEDIUM },
                                { label: 'FAST', value: SpeedLevel.HARD }
                            ].map((opt) => (
                                <button
                                    key={opt.label}
                                    onClick={() => {
                                        setBaseSpeed(opt.value);
                                        setCurrentSpeed(opt.value);
                                    }}
                                    className={`flex-1 py-2 rounded-full text-[10px] font-bold tracking-widest transition-all ${
                                        baseSpeed === opt.value
                                        ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' 
                                        : 'text-white/30 hover:text-white'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* START Button */}
                        <button 
                            onClick={startGame}
                            className="group relative w-full max-w-[200px] h-14 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm tracking-[0.3em] uppercase rounded-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] active:scale-95 flex items-center justify-center overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                START
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                            </span>
                            <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent transform -skew-x-12 group-hover:animate-[shimmer_1s_infinite]" />
                        </button>
                        
                    </div>
                </div>
            )}
         </div>
      </div>

      {/* 3. Controls (Visible on mobile) */}
      <div className="flex-shrink-0 w-full z-30 md:hidden bg-transparent pt-2 pb-6">
         <Dpad onDirectionChange={handleDirectionChange} />
      </div>

    </div>
  );
};

export default SnakeGame;