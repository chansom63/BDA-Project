import React, { useEffect, useState } from 'react';

export default function SplashLoader({ onComplete }) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Start fading out at 4.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 4500);

    // Completely unmount at 5.0 seconds
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        opacity: isFading ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out',
        pointerEvents: isFading ? 'none' : 'auto'
      }}
    >
      <img
        src="/src/assets/gaganlogo.png"
        alt="Project Logo"
        style={{
          width: '200px',
          height: '200px',
          objectFit: 'contain',
          marginBottom: '28px',
        }}
      />

      <h1
        style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '600',
          letterSpacing: '2px',
          textAlign: 'center',
        }}
      >
        Gagan <span style={{ color: 'green' }}>live</span>
      </h1>

      <div
        style={{
          width: '45px',
          height: '1px',
          background: '#fff',
          margin: '22px 0 32px',
        }}
      />

      <div
        style={{
          width: '600px',
          maxWidth: '85%',
          borderTop: '1px solid #292929',
          borderBottom: '1px solid #292929',
          padding: '20px 0',
        }}
      >
        {[
          ['Suryanarayana Reddy', 'bcs_2023044@iiitm.ac.in'],
          ['Somesh Chandra', 'bcs_2023063@iiitm.ac.in'],
          ['Sumit Sahu', 'bcs_2023064@iiitm.ac.in'],
          ['Pranta Roy Joy', 'bcs_2023081@iiitm.ac.in'],
        ].map(([name, email]) => (
          <div
            key={email}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              fontSize: '13px',
            }}
          >
            <span style={{ color: '#e5e5e5' }}>{name}</span>

            <span
              style={{
                color: '#777',
                fontFamily: 'monospace',
                fontSize: '11px',
              }}
            >
              {email}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: '38px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            border: '2px solid #333',
            borderTop: '2px solid #fff',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }}
        />

        <div
          style={{
            color: '#666',
            fontSize: '10px',
            letterSpacing: '2px',
          }}
        >
          INITIALIZING KAFKA STREAMS...
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '25px',
          color: '#333',
          fontSize: '9px',
          letterSpacing: '1.5px',
        }}
      >
        IIITM GWALIOR
      </div>

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}