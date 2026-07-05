import React, { useState, useEffect } from 'react';
import './KeryxLoader.css';

export default function KeryxLoader({ userName, connected, onFinish }) {
  const [stage, setStage] = useState('preparing'); // 'preparing' | 'flying' | 'circling' | 'landed'
  const [fadeOut, setFadeOut] = useState(false);

  // Transition through story stages while waiting for backend
  useEffect(() => {
    if (connected) return;

    const flyTimer = setTimeout(() => {
      setStage((curr) => (curr === 'preparing' ? 'flying' : curr));
    }, 450);

    // If server takes longer than 3.5 seconds, Mom calmly circles around the sky near nest
    const circleTimer = setTimeout(() => {
      setStage((curr) => (curr !== 'landed' ? 'circling' : curr));
    }, 3500);

    return () => {
      clearTimeout(flyTimer);
      clearTimeout(circleTimer);
    };
  }, [connected]);

  // Event-driven finish: exact millisecond connected becomes true, complete the story!
  useEffect(() => {
    if (connected) {
      setStage('landed');
      
      // Let family celebrate for 850ms, then smoothly fade out into Keryx app
      const landTimer = setTimeout(() => {
        setFadeOut(true);
        
        const finishTimer = setTimeout(() => {
          if (onFinish) onFinish();
        }, 450);
        
        return () => clearTimeout(finishTimer);
      }, 850);

      return () => clearTimeout(landTimer);
    }
  }, [connected, onFinish]);

  const isMom = userName === 'Mom';

  // Story text based on character viewpoint and current stage
  const getSubtitle = () => {
    if (isMom) {
      if (stage === 'preparing') return "Warming up home nest...";
      if (stage === 'flying') return "Flying home to Brother's nest...";
      if (stage === 'circling') return "Circling above the nest... Waiting for secure family channel to open 🕊️";
      if (stage === 'landed') return "Landed! Reconnected with Brother inside the nest 💕";
    } else {
      if (stage === 'preparing') return "Calling for Mom...";
      if (stage === 'flying') return "Chirping from the branch... Mom is on her way! 🕊️";
      if (stage === 'circling') return "Mom is flying across the sky... Almost here! ⏳";
      if (stage === 'landed') return "Mom arrived! Safe together in the nest 💕";
    }
    return "Connecting family channel...";
  };

  return (
    <div className={`keryx-loader-container ${fadeOut ? 'fade-out' : ''}`}>
      {/* Soft warm morning sky glow */}
      <div className="morning-glow" />

      {/* Floating minimal background clouds */}
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
        {/* Mom Bird (Flying Messenger) */}
        <div className={`bird-container ${stage}`}>
          <svg viewBox="0 0 72 58" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Body */}
            <path d="M14 32 C21 27 34 25 52 30 C58 32 65 27 68 25 C63 34 54 43 40 43 C27 43 18 38 14 32 Z" fill="#ffb347" />
            <path d="M52 30 C54 26 58 25 63 27 C60 29 55 31 52 30 Z" fill="#ffcc00" />
            {/* Eye */}
            <circle cx="56" cy="28" r="1.8" fill="#101217" />
            {/* Beak */}
            <polygon points="65,27 71,29 65,31" fill="#ff3b30" />
            {/* Left Wing (flapping) */}
            <g className="bird-wing-left">
              <path d="M30 30 C32 16 41 9 50 14 C43 21 36 27 30 30 Z" fill="#ff9500" />
            </g>
            {/* Right Wing */}
            <g className="bird-wing-right">
              <path d="M28 31 C26 20 32 14 41 16 C36 23 32 28 28 31 Z" fill="#e67e22" opacity="0.85" />
            </g>
            {/* Tail */}
            <path d="M14 32 C7 30 2 32 0 37 C5 34 9 37 14 32 Z" fill="#ff9500" />
          </svg>
        </div>

        {/* The Nest & Tree Branch */}
        <div className="nest-container">
          {/* Tree branch */}
          <svg className="branch-svg" viewBox="0 0 170 75" fill="none">
            <path d="M0 65 Q60 70 115 48 Q150 38 170 22" stroke="#5a4a42" strokeWidth="7" strokeLinecap="round" />
            <path d="M80 56 Q105 38 125 41" stroke="#5a4a42" strokeWidth="4" strokeLinecap="round" />
            {/* Green Leaves */}
            <path d="M120 38 Q130 27 136 38 Q125 43 120 38 Z" fill="#4cd964" opacity="0.85" />
            <path d="M152 27 Q164 16 170 27 Q158 32 152 27 Z" fill="#34c759" opacity="0.95" />
            <path d="M88 52 Q96 42 102 52 Q92 57 88 52 Z" fill="#2ecc71" opacity="0.75" />
          </svg>

          {/* Brother Chick: position depends on who logged in and stage */}
          <div className={`chick-container ${
            stage === 'landed' 
              ? 'reunited-nest' 
              : (isMom ? 'in-nest' : 'on-branch')
          }`}>
            <svg viewBox="0 0 44 44" fill="none">
              {/* Little Chick Body */}
              <circle cx="22" cy="27" r="12" fill="#ffcc00" />
              <circle cx="22" cy="16" r="9.5" fill="#ffcc00" />
              {/* Eye */}
              <circle cx="26" cy="14" r="1.6" fill="#101217" />
              {/* Beak */}
              <polygon points="31,15 37,17 31,19" fill="#ff3b30" />
              {/* Wing */}
              <path d="M16 25 C14 29 18 33 22 31" fill="#ffb347" />
            </svg>

            {/* When Brother opens & waiting, show animated musical chirp notes! */}
            {!isMom && stage !== 'landed' && (
              <div className="chirp-notes">
                <span className="note note-1">🎵</span>
                <span className="note note-2">🎶</span>
              </div>
            )}
          </div>

          {/* Woven Home Nest */}
          <svg className="nest-svg" viewBox="0 0 86 40" fill="none">
            <path d="M5 20 C5 36 81 36 81 20 C70 27 16 27 5 20 Z" fill="#8c6b58" />
            <path d="M11 25 Q43 36 75 25" stroke="#6b4f3f" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M16 29 Q43 39 70 29" stroke="#a07d68" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M9 20 Q22 13 38 20 Q54 27 77 20" stroke="#7a5c48" strokeWidth="3" fill="none" />
          </svg>

          {/* Joyful particles when Family is Reunited */}
          {stage === 'landed' && (
            <div className="reaction-particles">
              <span className="particle particle-1">💕</span>
              <span className="particle particle-2">✨</span>
              <span className="particle particle-3">💖</span>
              <span className="particle particle-4">🎵</span>
            </div>
          )}
        </div>
      </div>

      {/* Story Text & Status */}
      <div className="loader-content">
        <h2 className="loader-title">
          {stage === 'preparing' && 'Preparing Keryx...'}
          {(stage === 'flying' || stage === 'circling') && 'Connecting Family Channel...'}
          {stage === 'landed' && 'Family Reunited!'}
        </h2>
        <p className="loader-subtitle">{getSubtitle()}</p>

        <div className={`status-badge ${stage === 'landed' ? 'connected' : 'connecting'}`}>
          {stage === 'landed' ? (
            <>
              <span>✓</span> Family Connected
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
