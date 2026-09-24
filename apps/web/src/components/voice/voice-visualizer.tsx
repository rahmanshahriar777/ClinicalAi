'use client';

import clsx from 'clsx';

interface VoiceVisualizerProps {
  isActive: boolean;
  audioLevel?: number; // 0 - 100
  barsCount?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VoiceVisualizer({
  isActive,
  audioLevel = 0,
  barsCount = 16,
  className,
  size = 'md',
}: VoiceVisualizerProps) {
  const heights = [
    0.3, 0.5, 0.8, 0.4, 0.9, 0.6, 0.7, 1.0, 0.8, 0.5, 0.9, 0.4, 0.7, 0.6, 0.4, 0.2,
  ];

  const heightsSm = [0.4, 0.8, 0.5, 1.0, 0.6, 0.9, 0.4, 0.7];

  const heightsArray = size === 'sm' ? heightsSm : heights;

  const barHeightClass = {
    sm: 'h-6 w-1',
    md: 'h-10 w-1.5',
    lg: 'h-16 w-2',
  }[size];

  return (
    <div
      aria-label={isActive ? 'Active audio recording visualizer' : 'Inactive audio visualizer'}
      className={clsx('flex items-center justify-center gap-1 py-2', className)}
    >
      {heightsArray.map((baseScale, i) => {
        // Compute dynamic scale based on audioLevel when active
        const dynamicScale = isActive
          ? Math.max(0.15, Math.min(1.0, baseScale * (0.3 + (audioLevel / 100) * 1.2)))
          : 0.15;

        return (
          <span
            key={i}
            className={clsx(
              'rounded-full transition-all duration-75',
              barHeightClass,
              isActive
                ? 'bg-gradient-to-t from-cyan-600 via-sky-500 to-teal-400 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-300 dark:bg-slate-700 opacity-40'
            )}
            style={{
              transform: `scaleY(${dynamicScale})`,
              transformOrigin: 'bottom',
              transition: 'transform 80ms ease-out',
            }}
          />
        );
      })}
    </div>
  );
}
