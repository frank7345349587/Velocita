import React from 'react';

interface SpeedSignProps {
  speedLimit: number | null;
  unit: 'mph' | 'kmh';
  style?: 'us' | 'eu';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOverLimit?: boolean;
}

export const SpeedSign: React.FC<SpeedSignProps> = ({
  speedLimit,
  unit,
  style = 'us',
  size = 'md',
  isOverLimit = false,
}) => {
  if (speedLimit === null) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/60 text-slate-500 font-mono ${
          size === 'sm' ? 'w-12 h-14 text-[10px]' : size === 'lg' ? 'w-24 h-32 text-xs' : size === 'xl' ? 'w-32 h-44 text-sm' : 'w-16 h-22 text-xs'
        }`}
      >
        <span>NO</span>
        <span>LIMIT</span>
        <span>DATA</span>
      </div>
    );
  }

  // European Vienna Convention Style: Circular with Bold Red Border
  if (style === 'eu') {
    const sizeClasses = {
      sm: 'w-14 h-14 border-[4px] text-base',
      md: 'w-20 h-20 border-[6px] text-2xl',
      lg: 'w-28 h-28 border-[8px] text-4xl',
      xl: 'w-40 h-40 border-[12px] text-6xl',
    }[size];

    return (
      <div
        className={`relative flex items-center justify-center rounded-full bg-white font-bold font-mono tracking-tight text-slate-950 shadow-md ${
          isOverLimit ? 'border-red-600 ring-4 ring-red-500/40 animate-pulse' : 'border-red-600'
        } ${sizeClasses}`}
      >
        <span className="tabular-nums leading-none select-none">{speedLimit}</span>
      </div>
    );
  }

  // US MUTCD Style: White Rectangle with Black Border and "SPEED LIMIT" Header
  const sizeClasses = {
    sm: 'w-14 h-18 p-1',
    md: 'w-20 h-26 p-1.5',
    lg: 'w-28 h-36 p-2',
    xl: 'w-40 h-52 p-3',
  }[size];

  const headerTextClasses = {
    sm: 'text-[7px]',
    md: 'text-[9px]',
    lg: 'text-xs',
    xl: 'text-sm',
  }[size];

  const numberTextClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-5xl',
    xl: 'text-7xl',
  }[size];

  return (
    <div
      className={`flex flex-col items-center justify-between rounded-md border-2 border-slate-900 bg-white text-slate-950 shadow-md ${
        isOverLimit ? 'ring-4 ring-red-500/50 animate-pulse' : ''
      } ${sizeClasses}`}
    >
      <div className={`flex flex-col items-center font-bold font-sans tracking-tight text-slate-950 leading-tight uppercase ${headerTextClasses}`}>
        <span>SPEED</span>
        <span>LIMIT</span>
      </div>
      <div className={`font-mono font-extrabold tracking-tight tabular-nums text-slate-950 leading-none ${numberTextClasses}`}>
        {speedLimit}
      </div>
      <div className="w-full text-center">
        <span className={`text-[8px] font-mono text-slate-500 uppercase ${size === 'sm' ? 'hidden' : 'block'}`}>
          {unit}
        </span>
      </div>
    </div>
  );
};
