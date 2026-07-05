import React, { useState, useEffect } from 'react';
import './KeryxLoader.css';

export default function KeryxLoader({ userName, connected, onFinish }) {
  const [stage, setStage] = useState('preparing'); // 'preparing' | 'flying' | 'landed'
  const [fadeOut, setFadeOut] = useState(false);

  // Transition from preparing to flying after a brief moment
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!connected) {
        setStage('flying');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [connected]);

  // Event-driven finish: as soon as connected becomes true, immediately land and finish!
  useEffect(() => {
    if (connected) {
      setStage('landed');
      
      // Let the bird land gracefully for 800ms, then smoothly fade out
      const landTimer = setTimeout(() => {
        setFadeOut(true);
        
        // Remove from DOM after CSS fade transition completes
        const finishTimer = setTimeout(() => {
          if (onFinish) onFinish();
        }, 450);
        
        return () => clearTimeout(finishTimer);
      }, 800);

      return () => clearTimeout(landTimer);
    }
  }, [connected, onFinish]);

  const isMom = userName === 'Mom';
  const flyingLabel = isMom 
    ? "Flying home to Brother's nest..." 
    : "Mom is flying home to your nest...";
  const landedLabel = isMom
    ? "Landed! Brother is waiting in the nest."
    : "Mom has arrived home safely!";

  return (
    <div className={`keryx-loader-container ${fadeOut ? 'fade-out' : ''}`}>
      {/* Soft warm morning sky glow */}
      <div className="morning-glow" />

      {/* Floating minimal clouds */}
      <div className="cloud-layer">
        <svg className="cloud cloud-1" viewBox="0 0 100 40" fill="currentColor">
          <path d="M20 30 Q10 30 10 20 Q10 10 25 10 Q35 0 50 10 Q65 5 75 15 Q90 15 90 25 Q90 35 75 35 Z" />
        </svg>
        <svg className="cloud cloud-2" viewBox="0 0 100 40" fill="currentColor">
          <path d="M15 32 Q5 32 5 22 Q5 12 20 12 Q30 2 45 12 Q60 7 70 17 Q85 17 85 27 Q85 37 70 37 Z" />
        </svg>
        <svg className="cloud cloud-3" viewBox="0 0 100 40" fill="currentColor">
          <path d="M25 28 Q15 28 15 18 Q15 8 30 8 Q40 -2 55 8 Q70 3 80 13 Q95 13 95 23 Q95 33 80 33 Z" />
        </svg>
      </div>

      {/* Story Illustration Stage */}
      <div className="illustration-stage">
        {/* Flying Messenger Bird */}
        <div className={`bird-container ${stage === 'landed' ? 'landing' : (stage === 'flying' ? 'flying' : '')}`}>
          <svg viewBox="0 0 64 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Bird Body */}
            <path d="M12 28 C18 24 30 22 46 26 C52 28 58 24 60 22 C56 30 48 38 36 38 C24 38 16 34 12 28 Z" fill="#ffb347" />
            <path d="M46 26 C48 23 52 22 56 24 C53 26 49 27 46 26 Z" fill="#ffcc00" />
            {/* Eye */}
            <circle cx="50" cy="25" r="1.5" fill="#121318" />
            {/* Left Wing (flapping) */}
            <g className="bird-wing-left">
              <path d="M26 26 C28 14 36 8 44 12 C38 18 32 24 26 26 Z" fill="#ff9500" />
            </g>
            {/* Right Wing */}
            <g className="bird-wing-right">
              <path d="M24 27 C22 18 28 12 36 14 C32 20 28 25 24 27 Z" fill="#e67e22" opacity="0.8" />
            </g>
            {/* Tail */}
            <path d="M12 28 C6 26 2 28 0 32 C4 30 8 32 12 28 Z" fill="#ff9500" />
          </svg>
        </div>

        {/* The Nest & Waiting Chick */}
        <div className="nest-container">
          {/* Tree branch */}
          <svg className="branch-svg" viewBox="0 0 150 70" fill="none">
            <path d="M0 60 Q50 65 100 45 Q130 35 150 20" stroke="#5a4a42" strokeWidth="6" strokeLinecap="round" />
            <path d="M70 52 Q90 35 110 38" stroke="#5a4a42" strokeWidth="4" strokeLinecap="round" />
            {/* Leaves */}
            <path d="M105 35 Q115 25 120 35 Q110 40 105 35 Z" fill="#4cd964" opacity="0.8" />
            <path d="M135 25 Q145 15 150 25 Q140 30 135 25 Z" fill="#34c759" opacity="0.9" />
          </svg>

          {/* Chick in nest */}
          <div className={`chick-svg ${stage === 'landed' ? 'happy' : 'waiting'}`}>
            <svg viewBox="0 0 44 44" fill="none">
              {/* Little body */}
              <circle cx="22" cy="26" r="12" fill="#ffcc00" />
              <circle cx="22" cy="16" r="9" fill="#ffcc00" />
              {/* Eye */}
              <circle cx="25" cy="14" r="1.5" fill="#121318" />
              {/* Beak */}
              <polygon points="30,15 36,17 30,19" fill="#ff3b30" />
              {/* Wing */}
              <path d="M16 24 C14 28 18 32 22 30" fill="#ffb347" />
            </svg>
          </div>

          {/* Woven Nest */}
          <svg style={{ position: 'absolute', bottom: '10px', right: '15px', width: '80px', height: '36px', zIndex: 3 }} viewBox="0 0 80 36" fill="none">
            <path d="M5 18 C5 32 75 32 75 18 C65 24 15 24 5 18 Z" fill="#8c6b58" />
            <path d="M10 22 Q40 32 70 22" stroke="#6b4f3f" strokeWidth="3" strokeLinecap="round" />
            <path d="M15 26 Q40 35 65 26" stroke="#a07d68" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 18 Q20 12 35 18 Q50 24 72 18" stroke="#7a5c48" strokeWidth="3" fill="none" />
          </svg>

          {/* Joyful hearts when landed */}
          {stage === 'landed' && (
            <div className="reaction-particles">
              <span className="particle particle-1">💕</span>
              <span className="particle particle-2">✨</span>
              <span className="particle particle-3">🎵</span>
            </div>
          )}
        </div>
      </div>

      {/* Story Text & Status */}
      <div className="loader-content">
        <h2 className="loader-title">
          {stage === 'preparing' && 'Preparing Keryx...'}
          {stage === 'flying' && 'Waking family channel...'}
          {stage === 'landed' && 'Connected!'}
        </h2>
        <p className="loader-subtitle">
          {stage === 'preparing' && 'Setting up your secure family bridge.'}
          {stage === 'flying' && flyingLabel}
          {stage === 'landed' && landedLabel}
        </p>

        <div className={`status-badge ${stage === 'landed' ? 'connected' : 'connecting'}`}>
          {stage === 'landed' ? (
            <>
              <span>✓</span> Connected to Family Channel
            </>
          ) : (
            <>
              <span className="pulse-dot" /> Connecting...
            </>
          )}
        </div>
      </div>
    </div>
  );
}
