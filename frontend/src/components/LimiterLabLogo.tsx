import React from 'react';

interface LimiterLabLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LimiterLabLogo: React.FC<LimiterLabLogoProps> = ({
  size = 36,
  className = '',
  style = {},
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        borderRadius: size * 0.22,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 10px rgba(249, 115, 22, 0.15)',
        ...style,
      }}
    >
      <defs>
        {/* Dark Squircle Gradient Background */}
        <linearGradient id="limiterBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#121722" />
          <stop offset="50%" stopColor="#0D1118" />
          <stop offset="100%" stopColor="#080A0F" />
        </linearGradient>

        {/* Outer Glow / Rim Gradient */}
        <linearGradient id="limiterRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E394D" />
          <stop offset="50%" stopColor="#1C2433" />
          <stop offset="100%" stopColor="#141924" />
        </linearGradient>

        {/* Vibrant Speed Gauge Arc Gradient */}
        <linearGradient id="limiterArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF4500" />
          <stop offset="45%" stopColor="#FF7A00" />
          <stop offset="85%" stopColor="#FFAA00" />
          <stop offset="100%" stopColor="#FFBE1A" />
        </linearGradient>

        {/* Lightning Bolt Golden Gradient */}
        <linearGradient id="limiterBoltGrad" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="#FFB300" />
          <stop offset="50%" stopColor="#FFA000" />
          <stop offset="100%" stopColor="#FFC837" />
        </linearGradient>

        {/* Arc Glow Filter */}
        <filter id="limiterArcGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#FF6B00" floodOpacity="0.4" />
        </filter>

        {/* Bolt Glow Filter */}
        <filter id="limiterBoltGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#FFB800" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Rounded Rect / Squircle Outer Badge */}
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="22"
        ry="22"
        fill="url(#limiterBgGrad)"
        stroke="url(#limiterRimGrad)"
        strokeWidth="2.5"
      />

      {/* Subtle Inner Highlight Border */}
      <rect
        x="6.5"
        y="6.5"
        width="87"
        height="87"
        rx="19.5"
        ry="19.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.04)"
        strokeWidth="1"
      />

      {/* Gauge Background Track Arc (Dark Slate Blue) */}
      <path
        d="M 25 72 A 34 34 0 1 1 75 72"
        stroke="#222B3D"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      {/* Active High-Performance Gauge Arc (Vibrant Orange to Gold) */}
      <path
        d="M 25 72 A 34 34 0 1 1 68 29"
        stroke="url(#limiterArcGrad)"
        strokeWidth="7.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#limiterArcGlow)"
      />

      {/* Central High-Voltage Lightning Bolt */}
      <path
        d="M 53.5 25.5 L 38 48.5 L 48.5 48.5 L 45 74.5 L 63 43.5 L 52.5 43.5 Z"
        fill="url(#limiterBoltGrad)"
        filter="url(#limiterBoltGlow)"
      />
    </svg>
  );
};
