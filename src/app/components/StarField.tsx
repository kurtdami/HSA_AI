import React from 'react';

const StarField: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={`absolute h-0.5 w-0.5 opacity-0 rotate-[35deg]
            before:content-[''] before:absolute before:top-0 before:left-0 
            before:w-[100px] before:h-[1px] before:bg-gradient-to-r 
            before:from-transparent before:via-violet-400/60 before:to-transparent
            after:content-[''] after:absolute after:top-0 after:left-0
            after:w-1 after:h-1 after:bg-violet-300/80 after:rounded-full
            animate-shooting-star
          `}
          style={{
            top: `${Math.random() * 40}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${i * 2 + Math.random() * 2}s`,
            animationDuration: '4s'
          }}
        />
      ))}
    </div>
  );
};

export default StarField; 