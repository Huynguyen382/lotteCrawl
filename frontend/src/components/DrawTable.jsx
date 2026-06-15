import React from 'react';

function DrawTable({ game, filteredResults, calculateDeltas }) {
  return (
    <div className="table-wrapper desktop-only">
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
                  <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>#{draw.drawIdStr}</td>
                  <td>{draw.dateStr}</td>
                  <td>
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
                  <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>#{draw.drawIdStr}</td>
                  <td>{draw.dateStr}</td>
                  <td>
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
                  <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>#{draw.drawIdStr}</td>
                  <td>{draw.dateStr}</td>
                  <td>
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
