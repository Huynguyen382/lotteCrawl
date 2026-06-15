import React from 'react';

function MobileCards({ game, filteredResults, calculateDeltas }) {
  return (
    <div className="mobile-only mobile-cards-container">
      {filteredResults.slice().reverse().map((draw) => {
        const { currentSum, sumDiff, numDeltas } = calculateDeltas(draw);
        if (game === '645') {
          const jackpot = draw.prizes.find(p => p.name.toLowerCase().includes('jackpot')) || { valueStr: '0', count: 0 };
          return (
            <div key={draw.drawId} className="mobile-draw-card glass-panel">
              <div className="card-header">
                <span className="draw-id">#{draw.drawIdStr}</span>
                <span className="draw-date">{draw.dateStr}</span>
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
              <div className="card-header">
                <span className="draw-id">#{draw.drawIdStr}</span>
                <span className="draw-date">{draw.dateStr}</span>
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
              <div className="card-header">
                <span className="draw-id">#{draw.drawIdStr}</span>
                <span className="draw-date">{draw.dateStr}</span>
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
