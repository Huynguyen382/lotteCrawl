import React from 'react';

function MobileCards({ game, filteredResults, calculateDeltas }) {
  const [copiedId, setCopiedId] = React.useState(null);

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

  return (
    <div className="mobile-only mobile-cards-container">
      {filteredResults.slice().reverse().map((draw) => {
        const { currentSum, sumDiff, numDeltas } = calculateDeltas(draw);
        if (game === '645') {
          const jackpot = draw.prizes.find(p => p.name.toLowerCase().includes('jackpot')) || { valueStr: '0', count: 0 };
          return (
            <div key={draw.drawId} className="mobile-draw-card glass-panel">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="draw-id">#{draw.drawIdStr}</span>
                  <span className="draw-date">{draw.dateStr}</span>
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
                    height: '24px',
                    width: '24px'
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
              
              <div className="card-body">
                <div className="balls-container">
                  {draw.numbers.map((n, i) => (
                    <div key={i} className="ball-wrapper">
                      <span className="ball">{n}</span>
                      <span className="ball-absence">
                        {draw.individualAbsences ? draw.individualAbsences[i] : 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
                {numDeltas.length > 0 && (
                  <div className="deltas-container">
                    {numDeltas.map((diff, i) => {
                      const color = diff > 0 ? '#2a9d8f' : diff < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)';
                      const sign = diff > 0 ? `+${diff}` : diff;
                      return (
                        <span key={i} style={{ color: color }}>
                          {sign}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="card-footer-grid">
                <div className="footer-item">
                  <span className="item-label">Tổng (Lệch)</span>
                  <span className="item-value">
                    {currentSum} 
                    {sumDiff !== null && (
                      <span style={{ 
                        marginLeft: '4px',
                        fontSize: '0.75rem', 
                        color: sumDiff > 0 ? '#2ec4b6' : sumDiff < 0 ? '#e63946' : 'var(--text-muted)' 
                      }}>
                        ({sumDiff > 0 ? `+${sumDiff}` : sumDiff})
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="footer-item">
                  <span className="item-label">Tổng Vắng</span>
                  <span className="item-value highlight">{draw.totalAbsence !== undefined ? draw.totalAbsence : '-'}</span>
                </div>
                
                <div className="footer-item" style={{ gridColumn: 'span 2' }}>
                  <span className="item-label">Jackpot</span>
                  <span className="item-value">{jackpot.valueStr} đ ({jackpot.count} người trúng)</span>
                </div>
              </div>
            </div>
          );
        } else if (game === '655') {
          const jp1 = draw.prizes.find(p => p.name.includes('Jackpot 1')) || { valueStr: '0', count: 0 };
          const jp2 = draw.prizes.find(p => p.name.includes('Jackpot 2')) || { valueStr: '0', count: 0 };
          return (
            <div key={draw.drawId} className="mobile-draw-card glass-panel">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="draw-id">#{draw.drawIdStr}</span>
                  <span className="draw-date">{draw.dateStr}</span>
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
                    height: '24px',
                    width: '24px'
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
              
              <div className="card-body">
                <div className="balls-container">
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
                {numDeltas.length > 0 && (
                  <div className="deltas-container">
                    {numDeltas.slice(0, 6).map((diff, i) => {
                      const color = diff > 0 ? '#2a9d8f' : diff < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)';
                      const sign = diff > 0 ? `+${diff}` : diff;
                      return (
                        <span key={i} style={{ color: color }}>
                          {sign}
                        </span>
                      );
                    })}
                    <span style={{ width: '8px' }}></span>
                    <span style={{ 
                      color: numDeltas[6] > 0 ? '#2a9d8f' : numDeltas[6] < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)' 
                    }}>
                      {numDeltas[6] > 0 ? `+${numDeltas[6]}` : numDeltas[6]}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="card-footer-grid">
                <div className="footer-item">
                  <span className="item-label">Tổng (Lệch)</span>
                  <span className="item-value">
                    {currentSum} 
                    {sumDiff !== null && (
                      <span style={{ 
                        marginLeft: '4px',
                        fontSize: '0.75rem', 
                        color: sumDiff > 0 ? '#2ec4b6' : sumDiff < 0 ? '#e63946' : 'var(--text-muted)' 
                      }}>
                        ({sumDiff > 0 ? `+${sumDiff}` : sumDiff})
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="footer-item">
                  <span className="item-label">Tổng Vắng</span>
                  <span className="item-value highlight">{draw.totalAbsence !== undefined ? draw.totalAbsence : '-'}</span>
                </div>
                
                <div className="footer-item" style={{ gridColumn: 'span 2' }}>
                  <span className="item-label">Jackpot 1 / 2</span>
                  <div className="jackpot-row" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>JP1: {jp1.valueStr} đ ({jp1.count})</span>
                    <span style={{ color: 'var(--warning)', fontWeight: '600', fontSize: '0.85rem' }}>JP2: {jp2.valueStr} đ ({jp2.count})</span>
                  </div>
                </div>
              </div>
            </div>
          );
        } else {
          // game === '535'
          const jackpot = draw.prizes.find(p => p.name.includes('Độc Đắc')) || { valueStr: '0', count: 0 };
          return (
            <div key={draw.drawId} className="mobile-draw-card glass-panel">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="draw-id">#{draw.drawIdStr}</span>
                  <span className="draw-date">{draw.dateStr}</span>
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
                    height: '24px',
                    width: '24px'
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
              
              <div className="card-body">
                <div className="balls-container">
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
                {numDeltas.length > 0 && (
                  <div className="deltas-container">
                    {numDeltas.slice(0, 5).map((diff, i) => {
                      const color = diff > 0 ? '#2a9d8f' : diff < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)';
                      const sign = diff > 0 ? `+${diff}` : diff;
                      return (
                        <span key={i} style={{ color: color }}>
                          {sign}
                        </span>
                      );
                    })}
                    <span style={{ width: '8px' }}></span>
                    <span style={{ 
                      color: numDeltas[5] > 0 ? '#2a9d8f' : numDeltas[5] < 0 ? '#e63946' : 'var(--text-muted, #8d99ae)' 
                    }}>
                      {numDeltas[5] > 0 ? `+${numDeltas[5]}` : numDeltas[5]}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="card-footer-grid">
                <div className="footer-item">
                  <span className="item-label">Tổng (Lệch)</span>
                  <span className="item-value">
                    {currentSum} 
                    {sumDiff !== null && (
                      <span style={{ 
                        marginLeft: '4px',
                        fontSize: '0.75rem', 
                        color: sumDiff > 0 ? '#2ec4b6' : sumDiff < 0 ? '#e63946' : 'var(--text-muted)' 
                      }}>
                        ({sumDiff > 0 ? `+${sumDiff}` : sumDiff})
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="footer-item">
                  <span className="item-label">Tổng Vắng</span>
                  <span className="item-value highlight">{draw.totalAbsence !== undefined ? draw.totalAbsence : '-'}</span>
                </div>
                
                <div className="footer-item" style={{ gridColumn: 'span 2' }}>
                  <span className="item-label">Jackpot (Độc Đắc)</span>
                  <span className="item-value">{jackpot.valueStr} đ ({jackpot.count} người trúng)</span>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}

export default MobileCards;
