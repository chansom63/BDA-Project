import React from 'react';

export default function GaganLogo({ size = 38 }) {
  return (
    <div style={{
      position: 'relative',
      width: `${size}px`,
      height: `${size}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle, rgba(250, 204, 21, 0.15) 0%, rgba(11, 15, 23, 0.9) 100%)',
      borderRadius: '12px',
      padding: '4px',
      border: '1px solid rgba(250, 204, 21, 0.4)',
      boxShadow: '0 0 16px rgba(250, 204, 21, 0.35), inset 0 0 12px rgba(56, 189, 248, 0.2)'
    }}>
      <svg
        width={size * 0.8}
        height={size * 0.8}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradient for Jet */}
          <linearGradient id="gaganGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe066" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>

          {/* Gradient for Radar Ring */}
          <linearGradient id="gaganCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
          </linearGradient>

          {/* Glow Filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Radar Target Rings */}
        <circle cx="50" cy="50" r="44" stroke="url(#gaganCyan)" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.7" />
        <circle cx="50" cy="50" r="32" stroke="#facc15" strokeWidth="1.5" strokeOpacity="0.4" />
        <circle cx="50" cy="50" r="20" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.3" />

        {/* Compass Crosshairs */}
        <line x1="50" y1="6" x2="50" y2="16" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="84" x2="50" y2="94" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="50" x2="16" y2="50" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        <line x1="84" y1="50" x2="94" y2="50" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />

        {/* Satellite Orbital Arc */}
        <path
          d="M 18 50 A 32 32 0 0 1 82 50"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />

        {/* Supersonic Aircraft Geometry */}
        <g filter="url(#glow)">
          <path
            d="M 50 18 
               L 55 36 
               L 82 58 
               L 82 66 
               L 55 56 
               L 54 78 
               L 64 86 
               L 64 90 
               L 50 85 
               L 36 90 
               L 36 86 
               L 46 78 
               L 45 56 
               L 18 66 
               L 18 58 
               L 45 36 
               Z"
            fill="url(#gaganGold)"
            stroke="#ffffff"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <path
            d="M 50 24 L 53 36 L 47 36 Z"
            fill="#0b0f17"
            opacity="0.85"
          />
        </g>
      </svg>
    </div>
  );
}
