import React from 'react';

export default function AvalancheLogo({ 
  size = 48, 
  showText = true, 
  textColor = '#0F172A',
  textSize = 24,
  badgeText = 'FUJI',
  className = '' 
}) {
  const icon = (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 256 256" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {/* Official Avalanche Red Circular Background */}
      <circle cx="128" cy="128" r="128" fill="#E84142" />
      
      {/* Avalanche Stylized 'A' Mountain Mark */}
      <path 
        d="M172.58 190.5H196.42C200.7 190.5 203.4 185.8 201.26 182.1L141.6 78.4C139.46 74.7 134.1 74.7 131.96 78.4L114.7 108.4L137.9 148.6C140.04 152.3 145.4 152.3 147.54 148.6L158.8 129.1L172.58 190.5Z" 
        fill="#FFFFFF" 
      />
      <path 
        d="M117.8 132.8L93.7 91.1C91.56 87.4 86.2 87.4 84.06 91.1L54.74 182.1C52.6 185.8 55.3 190.5 59.58 190.5H102.5C106.78 190.5 109.48 185.8 107.34 182.1L88.9 150.2L106.66 119.4L117.8 132.8Z" 
        fill="#FFFFFF" 
      />
      <path 
        d="M128 190.5H150.3C154.58 190.5 157.28 185.8 155.14 182.1L138.8 153.8C136.66 150.1 131.3 150.1 129.16 153.8L112.82 182.1C110.68 185.8 113.38 190.5 117.66 190.5H128Z" 
        fill="#FFFFFF" 
      />
    </svg>
  );

  if (!showText) {
    return (
      <span 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: size, 
          height: size, 
          flexShrink: 0,
          overflow: 'hidden' 
        }}
        className={className}
      >
        {icon}
      </span>
    );
  }

  return (
    <div 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: 12 
      }} 
      className={className}
    >
      {icon}
      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ 
            fontSize: textSize, 
            fontWeight: 900, 
            color: textColor,
            letterSpacing: '-0.5px',
            fontFamily: 'var(--font-sans)'
          }}>
            avalanche
          </span>
          {badgeText && (
            <span style={{
              fontSize: 10,
              fontWeight: 900,
              background: 'rgba(232, 65, 66, 0.12)',
              color: '#E84142',
              padding: '2px 7px',
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              border: '1px solid rgba(232, 65, 66, 0.25)'
            }}>
              {badgeText}
            </span>
          )}
        </div>
        <span style={{ 
          fontSize: Math.max(11, Math.floor(textSize * 0.45)), 
          fontWeight: 700, 
          color: '#E84142', 
          letterSpacing: '0.12em',
          textTransform: 'uppercase'
        }}>
          Offline P2P Pay
        </span>
      </div>
    </div>
  );
}
