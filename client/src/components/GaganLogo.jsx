import React from 'react';
import gaganLogoImg from '../assets/gaganlogo.png';

export default function GaganLogo({ size = 38, className = '', style = {} }) {
  return (
    <img
      src={gaganLogoImg}
      alt="GAGAN Logo"
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'block',
        borderRadius: '6px',
        ...style
      }}
    />
  );
}

