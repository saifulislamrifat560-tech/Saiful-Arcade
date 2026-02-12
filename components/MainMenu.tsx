import React, { useEffect, useState } from 'react';

interface MainMenuProps {
  onSelectGame: (game: 'snake' | 'space' | 'pong' | 'numberpuzzle') => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectGame }) => {
  const [snakeScore, setSnakeScore] = useState(0);
  const [shooterScore, setShooterScore] = useState(0);
  const [pongScore, setPongScore] = useState(0);
  const [puzzleLevel, setPuzzleLevel] = useState(1);

  useEffect(() => {
    // Load persisted scores/levels
    const sScore = localStorage.getItem('snake-highscore');
    if (sScore) setSnakeScore(parseInt(sScore, 10));

    const shScore = localStorage.getItem('shooter-highscore');
    if (shScore) setShooterScore(parseInt(shScore, 10));

    const pScore = localStorage.getItem('pong-highscore');
    if (pScore) setPongScore(parseInt(pScore, 10));

    const puzLvl = localStorage.getItem('puzzle-level');
    if (puzLvl) setPuzzleLevel(parseInt(puzLvl, 10));
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-start overflow-y-auto custom-scrollbar">
      
      {/* Title Section - Single Line Enforced with whitespace-nowrap */}
      <div className="flex-shrink-0 mt-32 md:mt-40 mb-16 text-center w-full px-2">
        <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-thin text-white tracking-widest drop-shadow-[0_0_30px_rgba(6,182,212,0.3)] mb-6 uppercase flex flex-row items-center justify-center gap-3 whitespace-nowrap">
          Saiful <span className="font-bold text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">Arcade</span>
        </h1>
        <p className="text-cyan-500/50 text-[10px] md:text-sm uppercase tracking-[0.6em] md:tracking-[0.8em]">Select Protocol</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl px-6 pb-20">
        {/* Snake Card */}
        <button 
          onClick={() => onSelectGame('snake')}
          className="group relative h-32 md:h-48 bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-cyan-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-transparent to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10 text-center">
            <h2 className="text-2xl md:text-4xl text-white font-light tracking-[0.2em] uppercase group-hover:text-cyan-300 transition-colors">Snake</h2>
            <div className="flex flex-col items-center mt-3">
               <span className="text-[10px] text-white/40 tracking-wider">BEST SCORE</span>
               <span className="text-lg font-mono text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">{snakeScore}</span>
            </div>
          </div>
        </button>

        {/* Space Shooter Card */}
        <button 
          onClick={() => onSelectGame('space')}
          className="group relative h-32 md:h-48 bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-pink-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 via-transparent to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10 text-center">
            <h2 className="text-2xl md:text-4xl text-white font-light tracking-[0.2em] uppercase group-hover:text-pink-300 transition-colors">Galaxy Raid</h2>
             <div className="flex flex-col items-center mt-3">
               <span className="text-[10px] text-white/40 tracking-wider">BEST SCORE</span>
               <span className="text-lg font-mono text-pink-400 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">{shooterScore}</span>
            </div>
          </div>
        </button>

        {/* Ping Pong Card (Replaced Memory/Merge) */}
        <button 
          onClick={() => onSelectGame('pong')}
          className="group relative h-32 md:h-48 bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10 text-center">
            <h2 className="text-2xl md:text-4xl text-white font-light tracking-[0.2em] uppercase group-hover:text-emerald-300 transition-colors">Neon Pong</h2>
             <div className="flex flex-col items-center mt-3">
               <span className="text-[10px] text-white/40 tracking-wider">BEST SCORE</span>
               <span className="text-lg font-mono text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">{pongScore}</span>
            </div>
          </div>
        </button>

        {/* Number Puzzle Card */}
        <button 
          onClick={() => onSelectGame('numberpuzzle')}
          className="group relative h-32 md:h-48 bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-fuchsia-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 via-transparent to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative z-10 text-center">
            <h2 className="text-2xl md:text-4xl text-white font-light tracking-[0.2em] uppercase group-hover:text-fuchsia-300 transition-colors">Neon Slide</h2>
             <div className="flex flex-col items-center mt-3">
               <span className="text-[10px] text-white/40 tracking-wider">LEVEL REACHED</span>
               <span className="text-lg font-mono text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.5)]">{puzzleLevel}</span>
            </div>
          </div>
        </button>

      </div>

    </div>
  );
};