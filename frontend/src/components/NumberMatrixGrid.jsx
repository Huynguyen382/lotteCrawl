import React from 'react';

/**
 * NumberMatrixGrid
 * Displays lottery numbers in an 8-column grid (8 numbers per row):
 * - 1 to 45 for MEGA 6/45
 * - 1 to 55 for POWER 6/55
 * - 1 to 35 for Lotto 5/35
 * 
 * Supports two lighting modes:
 * 1. Single Draw Mode (default): Only numbers present in the winning draw are lit up.
 * 2. Coverage Mode (Lấp số theo khoảng ngày): Numbers that appeared at least once in the date range are lit up,
 *    and numbers that haven't appeared remain dimmed.
 * Supports showing absent counts or appearance frequency underneath each number.
 */
function NumberMatrixGrid({ 
  game, 
  numbers = [], 
  compact = false, 
  absenceMap = null, 
  showAbsence = false,
  coverageMode = false,
  freqMap = null,
  showFrequency = false
}) {
  const maxNumber = game === '645' ? 45 : (game === '655' ? 55 : 35);
  const isPower = game === '655';
  const isLotto535 = game === '535';

  const parsedNumbers = numbers.map(n => parseInt(n, 10));
  const mainLength = isLotto535 ? 5 : (isPower ? 6 : parsedNumbers.length);
  const mainNumbersSet = new Set(parsedNumbers.slice(0, mainLength));
  const bonusNumber = (isPower && parsedNumbers.length > 6)
    ? parsedNumbers[6]
    : ((isLotto535 && parsedNumbers.length > 5) ? parsedNumbers[5] : null);

  const allNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);

  const ballSize = compact ? 28 : 34;
  const fontSize = compact ? '0.75rem' : '0.85rem';

  const hasSubText = showAbsence || showFrequency;

  return (
    <div className="number-matrix-wrapper" style={{ width: '100%', maxWidth: compact ? '360px' : '440px', margin: '0 auto' }}>
      <div 
        className="number-matrix-grid" 
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${ballSize}px)`,
          gap: compact ? (hasSubText ? '8px 6px' : '6px 6px') : (hasSubText ? '10px 8px' : '8px 8px'),
          justifyContent: 'center',
          alignItems: 'start',
          margin: '0 auto'
        }}
      >
        {allNumbers.map((num) => {
          const numStr = String(num).padStart(2, '0');
          const absence = absenceMap ? absenceMap[num] : undefined;
          const frequency = freqMap ? (freqMap[num] || 0) : 0;

          // Determine lighting
          let isLit = false;
          let isBonus = false;
          let isMain = false;

          if (coverageMode) {
            // In Coverage Mode: lit if appeared in the date range
            isLit = frequency > 0;
            isMain = isLit;
          } else {
            // In Single Draw Mode: lit if in draw numbers
            isMain = mainNumbersSet.has(num);
            isBonus = bonusNumber === num;
            isLit = isMain || isBonus;
          }

          return (
            <div 
              key={num} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <div
                className={`matrix-ball ${isBonus ? 'bonus-lit' : isMain ? 'main-lit' : 'unlit'}`}
                title={
                  coverageMode
                    ? `Số ${numStr}: đã về ${frequency} lần trong khoảng ngày${absence !== undefined ? `, vắng ${absence} kỳ` : ''}`
                    : isBonus 
                    ? `Số đặc biệt: ${numStr}${absence !== undefined ? ` (Vắng ${absence} kỳ)` : ''}` 
                    : isMain 
                    ? `Số trúng thưởng: ${numStr}${absence !== undefined ? ` (Vắng ${absence} kỳ)` : ''}` 
                    : `Số ${numStr}${absence !== undefined ? ` (Vắng ${absence} kỳ)` : ''}`
                }
                style={{
                  width: `${ballSize}px`,
                  height: `${ballSize}px`,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: fontSize,
                  fontWeight: isLit ? '800' : '500',
                  userSelect: 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  ...(isBonus ? {
                    background: 'radial-gradient(circle at 30% 30%, #ffd166, #f3a712)',
                    color: '#1a1a1a',
                    boxShadow: '0 0 12px rgba(255, 183, 3, 0.75), 0 2px 6px rgba(0, 0, 0, 0.4)',
                    border: '1.5px solid #ffe49e',
                    zIndex: 2,
                    transform: 'scale(1.05)'
                  } : isMain ? {
                    background: 'radial-gradient(circle at 30% 30%, #e63946, #c1121f)',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(230, 57, 70, 0.75), 0 2px 6px rgba(0, 0, 0, 0.4)',
                    border: '1.5px solid rgba(255, 143, 163, 0.7)',
                    zIndex: 2,
                    transform: 'scale(1.05)'
                  } : {
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'rgba(255, 255, 255, 0.22)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    zIndex: 1
                  })
                }}
              >
                {numStr}
                {isBonus && !coverageMode && (
                  <span 
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      fontSize: '0.55rem',
                      background: '#ffb703',
                      color: '#000',
                      borderRadius: '50%',
                      width: '12px',
                      height: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '900',
                      lineHeight: '1',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
                    }}
                    title="Số Bonus Jackpot 2"
                  >
                    ★
                  </span>
                )}
              </div>

              {/* Frequency in Date Range when enabled */}
              {showFrequency && freqMap && (
                <span 
                  style={{
                    fontSize: compact ? '0.6rem' : '0.66rem',
                    fontWeight: '700',
                    color: frequency > 0 ? '#2ec4b6' : '#e63946',
                    background: frequency === 0 ? 'rgba(230, 57, 70, 0.15)' : 'rgba(46, 196, 182, 0.1)',
                    padding: '1px 3px',
                    borderRadius: '4px',
                    lineHeight: '1.1',
                    whiteSpace: 'nowrap'
                  }}
                  title={`Số ${numStr}: đã về ${frequency} lần trong khoảng ngày`}
                >
                  {frequency > 0 ? `${frequency} lần` : '0'}
                </span>
              )}

              {/* Absent count indicator when enabled and frequency not shown */}
              {showAbsence && !showFrequency && absence !== undefined && (
                <span 
                  style={{
                    fontSize: compact ? '0.62rem' : '0.68rem',
                    fontWeight: '700',
                    color: absence === 0 ? '#2ec4b6' : absence >= 20 ? '#e63946' : absence >= 10 ? '#f4a261' : 'var(--text-muted)',
                    background: absence >= 20 ? 'rgba(230, 57, 70, 0.15)' : absence >= 10 ? 'rgba(244, 162, 97, 0.15)' : 'transparent',
                    padding: absence >= 10 ? '1px 3px' : '0',
                    borderRadius: '4px',
                    lineHeight: '1.1',
                    whiteSpace: 'nowrap'
                  }}
                  title={`Số ${numStr}: vắng ${absence} kỳ`}
                >
                  {absence === 0 ? '0' : `${absence}k`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NumberMatrixGrid;
