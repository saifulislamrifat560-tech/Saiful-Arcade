import React, { useEffect, useState } from 'react';

interface MainMenuProps {
  onSelectGame: (game: 'snake' | 'space' | 'pong' | 'numberpuzzle' | 'tower') => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectGame }) => {
  const [snakeScore, setSnakeScore] = useState(0);
  const [shooterScore, setShooterScore] = useState(0);
  const [pongScore, setPongScore] = useState(0);
  const [puzzleLevel, setPuzzleLevel] = useState(1);
  const [towerScore, setTowerScore] = useState(0);

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

    const tScore = localStorage.getItem('tower-best');
    if (tScore) setTowerScore(parseInt(tScore, 10));
  }, []);

  return (
    <div className="w-full h-full flex flex-col items-center justify-between overflow-y-auto custom-scrollbar relative">
      
      <div className="w-full flex flex-col items-center">
        {/* Title Section */}
        <div className="flex-shrink-0 mt-32 md:mt-40 mb-16 text-center w-full px-2">
            <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl font-normal text-white tracking-widest drop-shadow-[0_0_40px_rgba(6,182,212,0.4)] mb-8 uppercase flex flex-row items-center justify-center gap-4 whitespace-nowrap">
            Saiful <span className="font-bold text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]">Arcade</span>
            </h1>
            <p className="text-cyan-500/50 text-xs md:text-base uppercase tracking-[0.6em] md:tracking-[0.8em]">Select Protocol</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl px-6 pb-12">
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

            {/* Ping Pong Card */}
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

            {/* Tower Game Card */}
            <button 
            onClick={() => onSelectGame('tower')}
            className="group relative h-32 md:h-48 bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-rose-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center gap-2"
            >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/0 via-transparent to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 text-center">
                <h2 className="text-2xl md:text-4xl text-white font-light tracking-[0.2em] uppercase group-hover:text-rose-400 transition-colors">Neon Stack</h2>
                <div className="flex flex-col items-center mt-3">
                <span className="text-[10px] text-white/40 tracking-wider">BEST SCORE</span>
                <span className="text-lg font-mono text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]">{towerScore}</span>
                </div>
            </div>
            </button>
        </div>
      </div>

      {/* Developer Footer */}
      <div className="pb-8 w-full flex justify-center">
        <a 
            href="https://rifat-hassan-premium-link-in-bio-wy.vercel.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-cyan-500/30 transition-all duration-300 backdrop-blur-sm"
        >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 p-[1px] shadow-lg group-hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                   <svg className="w-4 h-4 text-cyan-400 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                   </svg>
                </div>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase group-hover:text-white/60 transition-colors">Developed by</span>
                <span className="text-xs text-white/80 font-bold tracking-widest uppercase group-hover:text-cyan-400 transition-colors">Rifat Hassan</span>
            </div>
        </a>
      </div>

    </div>
  );
};