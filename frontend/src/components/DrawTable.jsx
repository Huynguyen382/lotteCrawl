import React from 'react';
import { API_BASE } from '../config';

function DrawTable({ game, filteredResults, calculateDeltas, statsConfig }) {
  const [copiedId, setCopiedId] = React.useState(null);

  const scoreTicket = (ticketNums, config) => {
    if (!config || !config.sums || !config.topPairs || !config.hot || !config.cold) {
      return { score: 0, reasons: [] };
    }
    let score = 0;
    const reasons = [];

    // 1. Sum Rule (Bell Curve)
    const sum = ticketNums.reduce((a, b) => a + b, 0);
    const mean = config.sums.mean || (game === '645' ? 138 : (game === '655' ? 168 : 90));
    if (sum >= mean - 15 && sum <= mean + 15) {
      score += 3;
      reasons.push({ type: 'success', text: `Tổng điểm vàng (${sum})` });
    } else if (sum < mean - 30 || sum > mean + 30) {
      score -= 2;
    } else {
      reasons.push({ type: 'neutral', text: `Tổng ổn định (${sum})` });
    }

    // 2. Consecutive Rule
    let consecutiveCount = 0;
    for (let i = 0; i < ticketNums.length - 1; i++) {
      if (ticketNums[i + 1] - ticketNums[i] === 1) consecutiveCount++;
    }
    if (consecutiveCount === 1) {
      score += 2;
      reasons.push({ type: 'accent', text: 'Cặp số liền kề' });
    } else if (consecutiveCount === 2) {
      score += 1;
    } else if (consecutiveCount >= 3) {
      score -= 3;
    }

    // 3. Association Rule (Pairs)
    const top15Pairs = config.topPairs ? config.topPairs.slice(0, 15) : [];
    for (let i = 0; i < ticketNums.length; i++) {
      for (let j = i + 1; j < ticketNums.length; j++) {
        const p1 = `${ticketNums[i]}-${ticketNums[j]}`;
        if (top15Pairs.includes(p1)) {
          score += 2;
          reasons.push({ type: 'primary', text: `Cặp tỷ lệ cao [${ticketNums[i]}, ${ticketNums[j]}]` });
        }
      }
    }

    // 4. Hot/Cold frequencies
    let hotCount = 0;
    let coldCount = 0;
    const hotList = config.hot || [];
    const coldList = config.cold || [];
    ticketNums.forEach(n => {
      const nStr = String(n).padStart(2, '0');
      if (hotList.slice(0, 8).includes(nStr)) hotCount++;
      if (coldList.slice(0, 5).includes(nStr)) coldCount++;
    });
    
    if (hotCount >= 1 && hotCount <= 3) {
      score += 1;
    }
    if (coldCount === 1) {
      score += 1;
      reasons.push({ type: 'warning', text: 'Đón lỏng số lạnh' });
    }

    // 5. Odd/Even ratio
    const oddCount = ticketNums.filter(n => n % 2 !== 0).length;
    const mainLength = game === '535' ? 5 : 6;
    const isBalanced = (mainLength === 6 && oddCount >= 2 && oddCount <= 4) || (mainLength === 5 && oddCount >= 2 && oddCount <= 3);
    if (isBalanced) {
      score += 1;
    } else {
      score -= 2;
    }

    // 6. Low/High Balance Rule
    const midPoint = game === '645' ? 23 : (game === '655' ? 28 : 18);
    const lowCount = ticketNums.filter(n => n < midPoint).length;
    const highCount = ticketNums.length - lowCount;
    const isLowHighBalanced = (mainLength === 6 && lowCount >= 2 && lowCount <= 4) || (mainLength === 5 && lowCount >= 2 && lowCount <= 3);
    if (isLowHighBalanced) {
      score += 1;
    } else if (lowCount === 0 || highCount === 0) {
      score -= 2;
    }

    // 7. Prime Number Rule
    const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53]);
    const primeCount = ticketNums.filter(n => primes.has(n)).length;
    if (primeCount >= 1 && primeCount <= 3) {
      score += 1;
    } else if (primeCount === 0) {
      score -= 1;
    }

    // 8. Tail Digit Repetition Rule
    const tails = ticketNums.map(n => n % 10);
    const tailCounts = {};
    tails.forEach(t => { tailCounts[t] = (tailCounts[t] || 0) + 1; });
    const maxTailRep = Math.max.apply(null, Object.values(tailCounts));
    if (maxTailRep === 2) {
      score += 1;
      reasons.push({ type: 'success', text: 'Nhịp đuôi đối xứng' });
    } else if (maxTailRep >= 4) {
      score -= 3;
    }

    // 9. Spread Spread Range Check
    const minVal = ticketNums[0];
    const maxVal = ticketNums[ticketNums.length - 1];
    const spread = maxVal - minVal;
    const minSpread = game === '645' ? 20 : (game === '655' ? 25 : 15);
    if (spread >= minSpread) {
      score += 1;
    } else {
      score -= 3;
    }

    return { score, reasons };
  };

  const handleCopyNumbers = (drawId, numbers, gameType) => {
    let textToCopy = '';
    if (gameType === '645') {
      textToCopy = numbers.join(' ');
    } else if (gameType === '655') {
      const main = numbers.slice(0, 6).join(' ');
      const bonus = numbers[6];
      textToCopy = `${main} | ${bonus}`;
    } else if (gameType === '535') {
      const main = numbers.slice(0, 5).join(' ');
      const bonus = numbers[5];
      textToCopy = `${main} | ${bonus}`;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(drawId);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(err => {
      console.error('Lỗi sao chép:', err);
    });
  };

  const renderDrawIdCell = (draw) => {
    const mainLength = game === '535' ? 5 : 6;
    const mainNums = draw.numbers ? draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10)) : [];
    
    let scoreObj = { score: 0, reasons: [] };
    if (statsConfig && mainNums.length === mainLength) {
      scoreObj = scoreTicket(mainNums, statsConfig);
    }
    
    const uniqueReasons = [];
    const seenReasonTexts = new Set();
    scoreObj.reasons.forEach(r => {
      if (!seenReasonTexts.has(r.text)) {
        seenReasonTexts.add(r.text);
        uniqueReasons.push(r);
      }
    });

    return (
      <td className="draw-id-cell" style={{ fontWeight: 'bold', color: 'var(--accent)', position: 'relative' }}>
        #{draw.drawIdStr}
        <div className="ai-score-popup">
          {!statsConfig ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              🧠 Đang chấm điểm AI...
            </div>
          ) : (
            <>
              <div className="popup-header">
                <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  🧠 Điểm AI V2
                </span>
                <span className={`v2-score-badge ${scoreObj.score >= 10 ? 'super-high' : scoreObj.score >= 8 ? 'high' : 'medium'}`}>
                  {scoreObj.score}/13
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                {uniqueReasons.length > 0 ? uniqueReasons.map((r, idx) => (
                  <span key={idx} className={`v2-reason-pill ${r.type}`}>
                    {r.type === 'success' && '✓ '}
                    {r.type === 'accent' && '✦ '}
                    {r.type === 'primary' && '🔥 '}
                    {r.type === 'warning' && '❄ '}
                    {r.type === 'neutral' && '• '}
                    {r.text}
                  </span>
                )) : (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)' }}>Kết quả bình thường</span>
                )}
              </div>
            </>
          )}
        </div>
      </td>
    );
  };

  return (
    <div className="table-wrapper desktop-only">
      <style>{`
        .draw-id-cell {
          position: relative;
          cursor: help;
        }
        .draw-id-cell:hover .ai-score-popup {
          display: block;
        }
        .ai-score-popup {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          z-index: 1000;
          width: 250px;
          background: rgba(15, 23, 42, 0.98);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
          border-radius: 10px;
          padding: 12px;
          text-align: left;
          font-weight: normal;
          color: #fff;
          margin-top: 6px;
        }
        .ai-score-popup::after {
          content: '';
          position: absolute;
          bottom: 100%;
          left: 20px;
          border-width: 6px;
          border-style: solid;
          border-color: transparent transparent rgba(15, 23, 42, 0.98) transparent;
        }
        .ai-score-popup .popup-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 6px;
        }
        .ai-score-popup .v2-score-badge {
          display: inline-block;
          font-weight: 700;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 6px;
        }
        .ai-score-popup .v2-score-badge.super-high {
          background: rgba(46, 196, 182, 0.15);
          color: #2ec4b6;
          border: 1px solid rgba(46, 196, 182, 0.3);
        }
        .ai-score-popup .v2-score-badge.high {
          background: rgba(168, 218, 220, 0.15);
          color: #a8dadc;
          border: 1px solid rgba(168, 218, 220, 0.3);
        }
        .ai-score-popup .v2-score-badge.medium {
          background: rgba(255, 183, 3, 0.15);
          color: #ffb703;
          border: 1px solid rgba(255, 183, 3, 0.3);
        }
        .ai-score-popup .v2-reason-pill {
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255,255,255,0.05);
          color: #a8b2c1;
          border: 1px solid rgba(255,255,255,0.05);
          display: inline-block;
          margin: 2px;
        }
        .ai-score-popup .v2-reason-pill.success { color: #2ec4b6; background: rgba(46, 196, 182, 0.08); border-color: rgba(46, 196, 182, 0.15); }
        .ai-score-popup .v2-reason-pill.accent { color: #a8dadc; background: rgba(168, 218, 220, 0.08); border-color: rgba(168, 218, 220, 0.15); }
        .ai-score-popup .v2-reason-pill.primary { color: #ff8fa3; background: rgba(230, 57, 70, 0.08); border-color: rgba(230, 57, 70, 0.15); }
        .ai-score-popup .v2-reason-pill.warning { color: #ffb703; background: rgba(255, 183, 3, 0.08); border-color: rgba(255, 183, 3, 0.15); }
        .ai-score-popup .v2-reason-pill.neutral { color: #6c7a89; }
      `}</style>
      <table className="preview-table">
        <thead>
          {game === '645' ? (
            <tr>
              <th>Kỳ Quay</th>
              <th>Ngày Quay</th>
              <th>Bộ Số Trúng Thưởng (Chênh lệch)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Tổng (Lệch)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Tổng Vắng</th>
              <th style={{ textAlign: 'right' }}>Giá trị Jackpot</th>
              <th style={{ textAlign: 'right' }}>Số người trúng</th>
            </tr>
          ) : game === '655' ? (
            <tr>
              <th>Kỳ Quay</th>
              <th>Ngày Quay</th>
              <th>Bộ Số Trúng Thưởng (1-6 | Bonus)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Tổng (Lệch)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Tổng Vắng</th>
              <th style={{ textAlign: 'right' }}>Jackpot 1</th>
              <th style={{ textAlign: 'right' }}>Jackpot 2</th>
            </tr>
          ) : (
            <tr>
              <th>Kỳ Quay</th>
              <th>Ngày Quay</th>
              <th>Bộ Số Trúng Thưởng (1-5 | Bonus)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Tổng (Lệch)</th>
              <th style={{ textAlign: 'center', width: '110px' }}>Tổng Vắng</th>
              <th style={{ textAlign: 'right' }}>Giá trị Jackpot</th>
              <th style={{ textAlign: 'right' }}>Số người trúng</th>
            </tr>
          )}
        </thead>
        <tbody>
          {filteredResults.slice().reverse().map((draw) => {
            const { currentSum, sumDiff, numDeltas } = calculateDeltas(draw);
            if (game === '645') {
              const jackpot = draw.prizes.find(p => p.name.toLowerCase().includes('jackpot')) || { valueStr: '0', count: 0 };
              return (
                <tr key={draw.drawId}>
                  {renderDrawIdCell(draw)}
                  <td>{draw.dateStr}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="balls-container" style={{ margin: 0 }}>
                        {draw.numbers.map((n, i) => (
                          <div key={i} className="ball-wrapper">
                            <span className="ball">{n}</span>
                            <span className="ball-absence">
                              {draw.individualAbsences ? draw.individualAbsences[i] : 'N/A'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <button
                        title="Copy bộ số"
                        onClick={() => handleCopyNumbers(draw.drawId, draw.numbers, game)}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '4px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          height: '28px',
                          width: '28px',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        {copiedId === draw.drawId ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2ec4b6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                    {numDeltas.length > 0 && (
                      <div className="deltas-container" style={{ display: 'flex', gap: '8px', marginTop: '4px', paddingLeft: '2px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {numDeltas.map((diff, i) => {
                          const color = diff > 0 ? '#2a9d8f' : diff < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)';
                          const sign = diff > 0 ? `+${diff}` : diff;
                          return (
                            <span key={i} style={{ width: '28px', textAlign: 'center', color: color }}>
                              {sign}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    <div style={{ color: 'var(--text-main)' }}>{currentSum}</div>
                    {sumDiff !== null && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: sumDiff > 0 ? '#2ec4b6' : sumDiff < 0 ? '#e63946' : 'var(--text-muted)' 
                      }}>
                        {sumDiff > 0 ? `+${sumDiff}` : sumDiff}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    {draw.totalAbsence !== undefined ? draw.totalAbsence : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{jackpot.valueStr} đ</td>
                  <td style={{ textAlign: 'right' }}>{jackpot.count}</td>
                </tr>
              );
            } else if (game === '655') {
              const jp1 = draw.prizes.find(p => p.name.includes('Jackpot 1')) || { valueStr: '0', count: 0 };
              const jp2 = draw.prizes.find(p => p.name.includes('Jackpot 2')) || { valueStr: '0', count: 0 };
              return (
                <tr key={draw.drawId}>
                  {renderDrawIdCell(draw)}
                  <td>{draw.dateStr}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="balls-container" style={{ margin: 0 }}>
                        {draw.numbers.slice(0, 6).map((n, i) => (
                          <div key={i} className="ball-wrapper">
                            <span className="ball">{n}</span>
                            <span className="ball-absence">
                              {draw.individualAbsences ? draw.individualAbsences[i] : 'N/A'}
                            </span>
                          </div>
                        ))}
                        <span style={{ color: 'var(--border-color)', alignSelf: 'flex-start', marginTop: '4px', fontSize: '1.2rem' }}>|</span>
                        <div className="ball-wrapper">
                          <span className="ball power-bonus">{draw.numbers[6]}</span>
                          <span className="ball-absence" style={{ color: 'var(--warning)' }}>
                            {draw.individualAbsences ? draw.individualAbsences[6] : 'N/A'}
                          </span>
                        </div>
                      </div>
                      <button
                        title="Copy bộ số"
                        onClick={() => handleCopyNumbers(draw.drawId, draw.numbers, game)}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '4px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          height: '28px',
                          width: '28px',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        {copiedId === draw.drawId ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2ec4b6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                    {numDeltas.length > 0 && (
                      <div className="deltas-container" style={{ display: 'flex', gap: '8px', marginTop: '4px', paddingLeft: '2px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {numDeltas.slice(0, 6).map((diff, i) => {
                          const color = diff > 0 ? '#2a9d8f' : diff < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)';
                          const sign = diff > 0 ? `+${diff}` : diff;
                          return (
                            <span key={i} style={{ width: '28px', textAlign: 'center', color: color }}>
                              {sign}
                            </span>
                          );
                        })}
                        <span style={{ width: '8px' }}></span>
                        <span style={{ 
                          width: '28px', 
                          textAlign: 'center', 
                          color: numDeltas[6] > 0 ? '#2a9d8f' : numDeltas[6] < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)' 
                        }}>
                          {numDeltas[6] > 0 ? `+${numDeltas[6]}` : numDeltas[6]}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    <div style={{ color: 'var(--text-main)' }}>{currentSum}</div>
                    {sumDiff !== null && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: sumDiff > 0 ? '#2ec4b6' : sumDiff < 0 ? '#e63946' : 'var(--text-muted)' 
                      }}>
                        {sumDiff > 0 ? `+${sumDiff}` : sumDiff}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    {draw.totalAbsence !== undefined ? draw.totalAbsence : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{jp1.valueStr} đ ({jp1.count})</td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--warning)' }}>{jp2.valueStr} đ ({jp2.count})</td>
                </tr>
              );
            } else {
              // game === '535'
              const jackpot = draw.prizes.find(p => p.name.includes('Độc Đắc')) || { valueStr: '0', count: 0 };
              return (
                <tr key={draw.drawId}>
                  {renderDrawIdCell(draw)}
                  <td>{draw.dateStr}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="balls-container" style={{ margin: 0 }}>
                        {draw.numbers.slice(0, 5).map((n, i) => (
                          <div key={i} className="ball-wrapper">
                            <span className="ball">{n}</span>
                            <span className="ball-absence">
                              {draw.individualAbsences ? draw.individualAbsences[i] : 'N/A'}
                            </span>
                          </div>
                        ))}
                        <span style={{ color: 'var(--border-color)', alignSelf: 'flex-start', marginTop: '4px', fontSize: '1.2rem' }}>|</span>
                        <div className="ball-wrapper">
                          <span className="ball power-bonus">{draw.numbers[5]}</span>
                          <span className="ball-absence" style={{ color: 'var(--warning)' }}>
                            {draw.individualAbsences ? draw.individualAbsences[5] : 'N/A'}
                          </span>
                        </div>
                      </div>
                      <button
                        title="Copy bộ số"
                        onClick={() => handleCopyNumbers(draw.drawId, draw.numbers, game)}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '4px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          height: '28px',
                          width: '28px',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        {copiedId === draw.drawId ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2ec4b6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                    {numDeltas.length > 0 && (
                      <div className="deltas-container" style={{ display: 'flex', gap: '8px', marginTop: '4px', paddingLeft: '2px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {numDeltas.slice(0, 5).map((diff, i) => {
                          const color = diff > 0 ? '#2a9d8f' : diff < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)';
                          const sign = diff > 0 ? `+${diff}` : diff;
                          return (
                            <span key={i} style={{ width: '28px', textAlign: 'center', color: color }}>
                              {sign}
                            </span>
                          );
                        })}
                        <span style={{ width: '8px' }}></span>
                        <span style={{ 
                          width: '28px', 
                          textAlign: 'center', 
                          color: numDeltas[5] > 0 ? '#2a9d8f' : numDeltas[5] < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)' 
                        }}>
                          {numDeltas[5] > 0 ? `+${numDeltas[5]}` : numDeltas[5]}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    <div style={{ color: 'var(--text-main)' }}>{currentSum}</div>
                    {sumDiff !== null && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: sumDiff > 0 ? '#2ec4b6' : sumDiff < 0 ? '#e63946' : 'var(--text-muted)' 
                      }}>
                        {sumDiff > 0 ? `+${sumDiff}` : sumDiff}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    {draw.totalAbsence !== undefined ? draw.totalAbsence : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{jackpot.valueStr} đ</td>
                  <td style={{ textAlign: 'right' }}>{jackpot.count}</td>
                </tr>
              );
            }
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DrawTable;
