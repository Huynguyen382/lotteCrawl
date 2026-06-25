import React, { useState, useEffect } from 'react';

function StatsPanel({ game, visibleResults }) {
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [statsViewMode, setStatsViewMode] = useState('table'); // 'table' or 'chart'
  const [statsType, setStatsType] = useState('main'); // 'main' or 'special'
  const [sortBy, setSortBy] = useState('number');
  const [calculationMode, setCalculationMode] = useState('common'); // 'common' or 'separate'

  // Reset stats configurations when game type changes
  useEffect(() => {
    setStatsType('main');
    setStatsSearchQuery('');
    setCalculationMode('common');
  }, [game]);

  // Compute absent draws for main numbers (1-45 Mega, 1-55 Power, 1-35 Lotto)
  const getAbsenceStatistics = () => {
    if (visibleResults.length === 0) return [];
    
    const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
    const mainLength = game === '535' ? 5 : 6;
    const reversedResults = [...visibleResults].sort((a, b) => b.drawId - a.drawId);
    const stats = [];
    
    for (let i = 1; i <= maxNum; i++) {
      const numStr = String(i).padStart(2, '0');
      
      const firstSeenIndex = reversedResults.findIndex(draw => {
        if (!draw.numbers) return false;
        const checkNumbers = (game !== '645' && calculationMode === 'common')
          ? draw.numbers
          : draw.numbers.slice(0, mainLength);
        return checkNumbers.some(num => parseInt(num, 10) === i);
      });
      
      if (firstSeenIndex !== -1) {
        stats.push({
          number: numStr,
          absentDraws: firstSeenIndex,
          lastSeenDrawId: reversedResults[firstSeenIndex].drawIdStr,
          lastSeenDate: reversedResults[firstSeenIndex].dateStr
        });
      } else {
        stats.push({
          number: numStr,
          absentDraws: visibleResults.length,
          lastSeenDrawId: 'N/A',
          lastSeenDate: 'Chưa về'
        });
      }
    }
    
    return stats;
  };

  // Compute absent draws for Special/Bonus numbers (Power 6/55: 1-55, Lotto 5/35: 1-12)
  const getSpecialAbsenceStatistics = () => {
    if (visibleResults.length === 0 || game === '645') return [];
    
    const maxNum = game === '655' ? 55 : 12;
    const specialIdx = game === '655' ? 6 : 5;
    const reversedResults = [...visibleResults].sort((a, b) => b.drawId - a.drawId);
    const stats = [];
    
    for (let i = 1; i <= maxNum; i++) {
      const numStr = String(i).padStart(2, '0');
      
      const firstSeenIndex = reversedResults.findIndex(draw => {
        if (!draw.numbers) return false;
        if (calculationMode === 'common') {
          return draw.numbers.some(num => parseInt(num, 10) === i);
        } else {
          if (draw.numbers.length <= specialIdx) return false;
          return parseInt(draw.numbers[specialIdx], 10) === i;
        }
      });
      
      if (firstSeenIndex !== -1) {
        stats.push({
          number: numStr,
          absentDraws: firstSeenIndex,
          lastSeenDrawId: reversedResults[firstSeenIndex].drawIdStr,
          lastSeenDate: reversedResults[firstSeenIndex].dateStr
        });
      } else {
        stats.push({
          number: numStr,
          absentDraws: visibleResults.length,
          lastSeenDrawId: 'N/A',
          lastSeenDate: 'Chưa về'
        });
      }
    }
    
    return stats;
  };

  // Sort stats based on sortBy condition
  const getSortedStats = () => {
    const stats = statsType === 'special' ? getSpecialAbsenceStatistics() : getAbsenceStatistics();
    if (sortBy === 'number') {
      return stats.sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));
    } else if (sortBy === 'absent-desc') {
      return stats.sort((a, b) => b.absentDraws - a.absentDraws);
    } else if (sortBy === 'absent-asc') {
      return stats.sort((a, b) => a.absentDraws - b.absentDraws);
    }
    return stats;
  };

  // Filter stats by search query
  const getFilteredSortedStats = () => {
    const stats = getSortedStats();
    if (!statsSearchQuery.trim()) return stats;

    const queryParts = statsSearchQuery.split(/[\s,.-]+/).filter(Boolean);
    return stats.filter(item => {
      return queryParts.some(part => {
        const partInt = parseInt(part, 10);
        if (!isNaN(partInt)) {
          return parseInt(item.number, 10) === partInt;
        }
        return false;
      });
    });
  };

  const filteredSortedStats = getFilteredSortedStats();

  return (
    <div className="stats-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Tính toán vắng mặt dựa trên **{visibleResults.length}** kỳ quay ({game !== '645' ? `Chế độ ${calculationMode === 'common' ? 'Chung' : 'Riêng'}` : 'Số chính'}).
        </span>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Stats Search Box */}
          <div className="input-group" style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              placeholder="Tìm số (ví dụ: 05, 12)..."
              className="input-field"
              value={statsSearchQuery}
              onChange={(e) => setStatsSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', paddingRight: '28px', height: '32px', fontSize: '0.8rem' }}
            />
            <svg 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            {statsSearchQuery && (
              <button 
                onClick={() => setStatsSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
            <button
              className={`toggle-btn ${statsViewMode === 'table' ? 'active' : ''}`}
              onClick={() => setStatsViewMode('table')}
              style={{
                background: statsViewMode === 'table' ? 'var(--primary)' : 'none',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              Bảng
            </button>
            <button
              className={`toggle-btn ${statsViewMode === 'chart' ? 'active' : ''}`}
              onClick={() => setStatsViewMode('chart')}
              style={{
                background: statsViewMode === 'chart' ? 'var(--primary)' : 'none',
                border: 'none',
                color: '#fff',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              Biểu đồ
            </button>
          </div>

          {/* Stats Type Toggle (Only for games with special numbers: Power 6/55 and Lotto 5/35) */}
          {game !== '645' && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
              <button
                className={`toggle-btn ${statsType === 'main' ? 'active' : ''}`}
                onClick={() => setStatsType('main')}
                style={{
                  background: statsType === 'main' ? 'var(--primary)' : 'none',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Số chính
              </button>
              <button
                className={`toggle-btn ${statsType === 'special' ? 'active' : ''}`}
                onClick={() => setStatsType('special')}
                style={{
                  background: statsType === 'special' ? 'var(--warning)' : 'none',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Số ĐB
              </button>
            </div>
          )}

          {/* Calculation Mode Toggle (Only for games with special numbers: Power 6/55 and Lotto 5/35) */}
          {game !== '645' && (
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-color)' }}>
              <button
                className={`toggle-btn ${calculationMode === 'separate' ? 'active' : ''}`}
                onClick={() => setCalculationMode('separate')}
                style={{
                  background: calculationMode === 'separate' ? 'var(--primary)' : 'none',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Chế độ riêng
              </button>
              <button
                className={`toggle-btn ${calculationMode === 'common' ? 'active' : ''}`}
                onClick={() => setCalculationMode('common')}
                style={{
                  background: calculationMode === 'common' ? 'var(--primary)' : 'none',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Chế độ chung
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sắp xếp:</span>
            <select
              className="select-field"
              style={{ padding: '4px 8px', fontSize: '0.85rem', width: 'auto', display: 'inline-block', height: '32px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="number">Số thứ tự (Tăng dần)</option>
              <option value="absent-desc">Kỳ vắng mặt (Nhiều nhất)</option>
              <option value="absent-asc">Kỳ vắng mặt (Ít nhất)</option>
            </select>
          </div>
        </div>
      </div>

      {statsViewMode === 'table' ? (
        <div className="table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '80px' }}>Số</th>
                <th style={{ textAlign: 'center', width: '180px' }}>Số kỳ vắng mặt</th>
                <th>Kỳ về gần nhất</th>
                <th>Ngày về gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {filteredSortedStats.map((item) => {
                let alertColor = 'var(--text-color)';
                let badgeBg = 'rgba(255,255,255,0.05)';
                if (item.absentDraws >= 20) {
                  alertColor = '#e63946';
                  badgeBg = 'rgba(230, 57, 70, 0.15)';
                } else if (item.absentDraws >= 10) {
                  alertColor = '#f4a261';
                  badgeBg = 'rgba(244, 162, 97, 0.15)';
                } else if (item.absentDraws === 0) {
                  alertColor = '#2a9d8f';
                  badgeBg = 'rgba(42, 157, 143, 0.15)';
                }

                return (
                  <tr key={item.number}>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`ball ${statsType === 'special' ? 'power-bonus' : ''}`} style={{ margin: '0 auto' }}>{item.number}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: alertColor }}>
                      <span style={{ 
                        padding: '4px 10px', 
                        borderRadius: '12px', 
                        backgroundColor: badgeBg
                      }}>
                        {item.absentDraws} kỳ
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {item.lastSeenDrawId !== 'N/A' ? `#${item.lastSeenDrawId}` : 'N/A'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {item.lastSeenDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-view" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px', 
          padding: '20px', 
          background: 'rgba(10, 15, 29, 0.3)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px'
        }}>
          {filteredSortedStats.map((item) => {
            const maxAbsent = Math.max(...filteredSortedStats.map(s => s.absentDraws), 1);
            const percent = Math.min(100, (item.absentDraws / maxAbsent) * 100);
            
            let barColor = 'var(--text-dimmed, #6c7a89)';
            let glowColor = 'rgba(108, 122, 137, 0.2)';
            
            if (item.absentDraws >= 20) {
              barColor = '#e63946'; // Vietlott Red
              glowColor = 'rgba(230, 57, 70, 0.3)';
            } else if (item.absentDraws >= 10) {
              barColor = '#f4a261'; // Warning Orange
              glowColor = 'rgba(244, 162, 97, 0.3)';
            } else if (item.absentDraws === 0) {
              barColor = '#2a9d8f'; // Success Green
              glowColor = 'rgba(42, 157, 143, 0.3)';
            }

            return (
              <div key={item.number} style={{ display: 'flex', alignItems: 'center', gap: '16px' }} title={`Số ${item.number} vắng mặt ${item.absentDraws} kỳ. Lần cuối về ở Kỳ #${item.lastSeenDrawId} ngày ${item.lastSeenDate}.`}>
                <span className={`ball ${statsType === 'special' ? 'power-bonus' : ''}`} style={{ 
                  width: '32px', 
                  height: '32px', 
                  fontSize: '0.85rem', 
                  flexShrink: 0, 
                  background: item.absentDraws === 0 ? 'radial-gradient(circle at 30% 30%, #2a9d8f, #1a6d61)' : undefined 
                }}>
                  {item.number}
                </span>
                
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Lần về gần nhất: <strong>{item.lastSeenDrawId !== 'N/A' ? `#${item.lastSeenDrawId}` : 'N/A'}</strong> ({item.lastSeenDate})</span>
                    <span style={{ fontWeight: 'bold', color: barColor }}>{item.absentDraws} kỳ vắng</span>
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '12px', 
                    background: 'rgba(0,0,0,0.3)', 
                    borderRadius: '6px', 
                    overflow: 'hidden', 
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    position: 'relative'
                  }}>
                    <div style={{ 
                      width: `${percent}%`, 
                      height: '100%', 
                      background: `linear-gradient(90deg, ${barColor}aa, ${barColor})`, 
                      borderRadius: '6px', 
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: `0 0 8px ${glowColor}`
                    }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StatsPanel;
