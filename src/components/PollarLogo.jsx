import React from 'react';
import pollarIcon from '../assets/pollar.webp';

export default function PollarLogo({ 
  size = 48, 
  showText = true, 
  textColor = '#0F172A',
  textSize = 24,
  className = '' 
}) {
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
        <img 
          src={pollarIcon} 
          alt="Pollar" 
          style={{ 
            width: size, 
            height: size, 
            maxWidth: size, 
            maxHeight: size, 
            objectFit: 'contain',
            display: 'block'
          }} 
        />
      </span>
    );
  }

  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 8 
      }} 
      className={className}
    >
      <img 
        src={pollarIcon} 
        alt="Pollar" 
        style={{ 
          width: size, 
          height: size, 
          maxWidth: size, 
          maxHeight: size, 
          objectFit: 'contain',
          display: 'block'
        }} 
      />
      <span style={{ 
        fontWeight: 900, 
        letterSpacing: '-0.5px', 
        fontSize: textSize, 
        color: textColor, 
        textTransform: 'lowercase',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1
      }}>
        pollar
      </span>
    </div>
  );
}
