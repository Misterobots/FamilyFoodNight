import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Restaurant } from '../types';
import { Star } from 'lucide-react';

interface RouletteProps {
  options: Restaurant[];
  onComplete: (result: Restaurant) => void;
}

export const Roulette: React.FC<RouletteProps> = ({ options, onComplete }) => {
  const controls = useAnimation();
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<Restaurant | null>(null);

  const spin = async () => {
    if (spinning) return;
    setSpinning(true);

    // Randomize winner
    const randomIndex = Math.floor(Math.random() * options.length);
    const selected = options[randomIndex];
    
    // Calculate rotation: 5 full spins + offset to land on segment
    // 360 / options.length = segment size
    const segmentDeg = 360 / options.length;
    const landOffset = segmentDeg * randomIndex; 
    // We rotate negative to simulate clockwise spin, but land on the item at top?
    // Let's keep it simple: Just spin a lot.
    const rotation = 1800 + (360 - (randomIndex * segmentDeg));

    await controls.start({
      rotate: rotation,
      transition: { duration: 4, type: "spring", damping: 15, stiffness: 20 }
    });

    setWinner(selected);
    setTimeout(() => onComplete(selected), 1000);
  };

  const colors = [
    '#FF7D45', // Orange
    '#6B4C9A', // Purple
    '#40C7B9', // Teal
    '#FCD34D', // Yellow
    '#F87171', // Red
    '#60A5FA', // Blue
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 mb-8">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="w-8 h-8 bg-gray-800 rotate-45 transform origin-center border-4 border-white shadow-lg rounded-sm"></div>
        </div>

        {/* Wheel */}
        <motion.div
          animate={controls}
          className="w-full h-full rounded-full border-8 border-white shadow-2xl relative overflow-hidden bg-white"
          style={{ rotate: 0 }}
        >
          {options.map((opt, idx) => {
            const angle = 360 / options.length;
            const rotate = idx * angle;
            return (
              <div
                key={idx}
                className="absolute w-1/2 h-full top-0 left-1/2 origin-left flex items-center justify-center"
                style={{
                  transform: `rotate(${rotate}deg)`,
                  transformOrigin: '0% 50%',
                }}
              >
                <div 
                    className="absolute inset-0 w-full h-full origin-left"
                    style={{
                        backgroundColor: colors[idx % colors.length],
                        transform: `skewY(-${90 - angle}deg) rotate(${angle/2}deg)`,
                        // This CSS trickery for pie slices is tricky.
                        // Simplified visual: Just lines and text.
                        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' // Not quite right for pie.
                    }}
                />
                
                {/* Text Label */}
                <div 
                    className="absolute text-white font-bold text-xs truncate max-w-[100px] text-right"
                    style={{
                        left: '40px',
                        transform: `rotate(${angle/2}deg)`,
                        width: '100px',
                        textAlign: 'right'
                    }}
                >
                  {opt.name}
                </div>
              </div>
            );
          })}
          
          {/* Better CSS Conic Gradient Implementation for segments */}
          <div className="absolute inset-0 rounded-full" style={{
              background: `conic-gradient(${options.map((_, i) => 
                `${colors[i % colors.length]} ${(i * 100) / options.length}%, ${colors[i % colors.length]} ${((i + 1) * 100) / options.length}%`
              ).join(', ')})`
          }}></div>
          
          {/* Content Overlay */}
           {options.map((opt, idx) => {
            const angle = 360 / options.length;
            const rotate = idx * angle + (angle/2);
            return (
              <div
                key={idx}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ transform: `rotate(${rotate}deg)` }}
              >
                 <div className="absolute top-8 left-1/2 -translate-x-1/2 text-white font-bold text-xs sm:text-sm drop-shadow-md text-center w-24 -rotate-90 origin-center" style={{ marginTop: '20px'}}>
                    {opt.name.substring(0, 12)}{opt.name.length > 12 ? '...' : ''}
                 </div>
              </div>
            );
          })}

        </motion.div>

        {/* Center Button */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
             <button
                onClick={spin}
                disabled={spinning}
                className="w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-gray-100 font-bold text-gray-800 hover:scale-105 active:scale-95 transition-all"
             >
                {spinning ? '...' : 'SPIN'}
             </button>
        </div>
      </div>

      <div className="text-center">
         <h3 className="text-xl font-bold text-gray-800 mb-2">Fate Decides!</h3>
         <p className="text-gray-500 text-sm">Spinning for highly rated spots nearby...</p>
      </div>
    </div>
  );
};