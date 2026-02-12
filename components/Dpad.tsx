import React from 'react';
import { Direction } from '../types';

interface DpadProps {
  onDirectionChange: (dir: Direction) => void;
}

export const Dpad: React.FC<DpadProps> = ({ onDirectionChange }) => {
  // Premium Cyber-Button Styles
  const btnBase = "relative w-20 h-16 sm:w-24 sm:h-20 flex items-center justify-center rounded-xl backdrop-blur-md transition-all duration-150 touch-manipulation border border-white/10 shadow-lg active:scale-95 active:border-cyan-500/50 group overflow-hidden";
  const btnIdle = "bg-white/5 text-cyan-500/80 hover:bg-white/10";
  
  // Inner glow effect
  const glow = "absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-transparent to-cyan-500/5 opacity-0 group-active:opacity-100 transition-opacity";

  const renderButton = (dir: Direction, path: string, label: string) => (
    <button 
      className={`${btnBase} ${btnIdle}`}
      onPointerDown={(e) => { 
        e.preventDefault(); 
        // Add vibration feedback if supported
        if (navigator.vibrate) navigator.vibrate(10); 
        onDirectionChange(dir); 
      }}
      aria-label={label}
    >
      <div className={glow} />
      {/* Icon */}
      <svg className="w-8 h-8 relative z-10 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" viewBox="0 0 24 24" fill="currentColor">
        <path d={path}/>
      </svg>
      {/* Tech decoration lines */}
      <div className="absolute bottom-1 w-8 h-[2px] bg-white/10 rounded-full group-active:bg-cyan-500/50 transition-colors" />
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-sm mx-auto pb-4 px-4 select-none">
      
      {/* Top Row: UP */}
      <div className="flex justify-center w-full">
        {renderButton(Direction.UP, "M12 4l-8 8h16l-8-8z", "Up")}
      </div>
      
      {/* Bottom Row: LEFT, DOWN, RIGHT */}
      <div className="grid grid-cols-3 gap-3 w-full">
        <div className="flex justify-end">
             {renderButton(Direction.LEFT, "M4 12l8 8V4l-8 8z", "Left")}
        </div>
        <div className="flex justify-center">
             {renderButton(Direction.DOWN, "M12 20l8-8H4l8 8z", "Down")}
        </div>
        <div className="flex justify-start">
             {renderButton(Direction.RIGHT, "M20 12l-8-8v16l8-8z", "Right")}
        </div>
      </div>

    </div>
  );
};