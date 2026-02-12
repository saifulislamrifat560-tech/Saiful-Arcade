import React, { useState, useEffect, useCallback } from 'react';
import { audioController } from '../utils/audio';

interface MemoryGameProps {
  onBack: () => void;
}

interface Card {
  id: number;
  iconId: number; // 0-7 for 8 pairs
  isFlipped: boolean;
  isMatched: boolean;
}

const ICONS = [
  // Simple SVG paths for the 8 icons
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", // Star
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z", // Heart
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z", // Circle
  "M3 3h18v18H3z", // Square
  "M1 21h22L12 2 1 21z", // Triangle
  "M12 2L2 12l10 10 10-10L12 2z", // Diamond
  "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z", // Cross
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" // Play/Arrow
];

const COLORS = [
  "text-yellow-400", "text-rose-500", "text-cyan-400", "text-emerald-400", 
  "text-purple-500", "text-orange-400", "text-blue-500", "text-fuchsia-400"
];

const MemoryGame: React.FC<MemoryGameProps> = ({ onBack }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [moves, setMoves] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWin, setIsWin] = useState(false);

  // Load best score
  useEffect(() => {
    const saved = localStorage.getItem('memory-best');
    if (saved) setBestScore(parseInt(saved, 10));
  }, []);

  const initGame = useCallback(() => {
    // Generate 8 pairs
    const pairs = [...Array(8).keys()].map(i => [i, i]).flat();
    
    // Shuffle
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    const newCards: Card[] = pairs.map((iconId, index) => ({
      id: index,
      iconId,
      isFlipped: false,
      isMatched: false
    }));

    setCards(newCards);
    setFlippedIndices([]);
    setMoves(0);
    setIsWin(false);
    setIsProcessing(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleCardClick = (index: number) => {
    // Guard clauses: processing match, card already flipped, card already matched
    if (isProcessing || cards[index].isFlipped || cards[index].isMatched) return;

    // Flip the card
    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);
    audioController.playEatSound(); // Click sound

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    // If 2 cards flipped, check match
    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      setIsProcessing(true);

      const [idx1, idx2] = newFlipped;
      
      if (newCards[idx1].iconId === newCards[idx2].iconId) {
        // Match found
        setTimeout(() => {
          const matchedCards = [...newCards];
          matchedCards[idx1].isMatched = true;
          matchedCards[idx2].isMatched = true;
          matchedCards[idx1].isFlipped = true; // Ensure they stay visible
          matchedCards[idx2].isFlipped = true;
          setCards(matchedCards);
          setFlippedIndices([]);
          setIsProcessing(false);
          audioController.playEatSound(); // Success sound (could use a different pitch)

          // Check Win
          if (matchedCards.every(c => c.isMatched)) {
             setIsWin(true);
             audioController.playGameOverSound();
             
             // Update best score (lower is better)
             const currentBest = parseInt(localStorage.getItem('memory-best') || '0', 10);
             const currentMoves = moves + 1; // +1 because state update hasn't painted yet fully? actually 'moves' state is updated above but closure might capture old value. Let's use functional update or rely on next render. Actually moves updated above.
             // But simpler: just use moves + 1 for logic here
             
             if (currentBest === 0 || (moves + 1) < currentBest) {
               setBestScore(moves + 1);
               localStorage.setItem('memory-best', (moves + 1).toString());
             }
          }
        }, 300);
      } else {
        // No match
        setTimeout(() => {
          const resetCards = [...newCards];
          resetCards[idx1].isFlipped = false;
          resetCards[idx2].isFlipped = false;
          setCards(resetCards);
          setFlippedIndices([]);
          setIsProcessing(false);
        }, 800);
      }
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center select-none bg-transparent">
      
       {/* Header */}
       <div className="w-full h-20 px-6 flex justify-between items-center pb-2 flex-shrink-0 z-20">
         <button onClick={onBack} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
            Menu
         </button>

         <div className="flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-emerald-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Moves</span>
                <span className="text-3xl text-white font-light tracking-tight">{moves}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-emerald-500/60 text-[10px] uppercase font-bold tracking-[0.3em]">Best</span>
                <span className="text-3xl text-emerald-50 font-light tracking-tight opacity-80">{bestScore === 0 ? '-' : bestScore}</span>
            </div>
         </div>
         
         <button onClick={initGame} className="text-white/40 hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-colors">
            RESET
         </button>
      </div>

      {/* Game Board */}
      <div className="flex-1 w-full flex items-center justify-center p-4 min-h-0">
         <div className="relative aspect-square w-full max-w-[500px] max-h-[500px]">
            
            <div className="w-full h-full grid grid-cols-4 gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 shadow-[0_0_30px_rgba(16,185,129,0.1)] backdrop-blur-sm">
              {cards.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => handleCardClick(index)}
                  disabled={card.isFlipped || card.isMatched}
                  className={`
                    relative w-full h-full rounded-lg transition-all duration-300 transform perspective-1000
                    ${card.isMatched ? 'opacity-50' : 'hover:scale-105 active:scale-95'}
                  `}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Card Inner */}
                  <div className={`
                    absolute inset-0 w-full h-full transition-transform duration-500
                    ${card.isFlipped ? 'rotate-y-180' : ''}
                  `}
                  style={{ transform: card.isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transformStyle: 'preserve-3d' }}
                  >
                    {/* Front (Hidden state) */}
                    <div className="absolute inset-0 w-full h-full bg-slate-800 border border-white/10 rounded-lg flex items-center justify-center backface-hidden shadow-lg group">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/40 transition-colors" />
                    </div>

                    {/* Back (Revealed state) */}
                    <div className="absolute inset-0 w-full h-full bg-slate-900 border border-emerald-500/30 rounded-lg flex items-center justify-center backface-hidden shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                         style={{ transform: 'rotateY(180deg)' }}
                    >
                       <svg className={`w-3/5 h-3/5 drop-shadow-[0_0_8px_currentColor] ${COLORS[card.iconId]}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d={ICONS[card.iconId]} />
                       </svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Win Overlay */}
             {isWin && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md rounded-2xl animate-[fadeIn_0.5s_ease-out]">
                    <h2 className="text-5xl text-emerald-400 font-thin tracking-widest uppercase drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] mb-2">Matched</h2>
                    <p className="text-white/50 text-sm tracking-[0.3em] mb-8">{moves} MOVES</p>
                    <button 
                       onClick={initGame}
                       className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-[0.2em] rounded shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all active:scale-95"
                    >
                       PLAY AGAIN
                    </button>
                </div>
             )}

         </div>
      </div>
    </div>
  );
};

export default MemoryGame;
