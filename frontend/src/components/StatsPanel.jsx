import React, { useState, useEffect } from 'react';

function StatsPanel({ game, visibleResults }) {
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [statsViewMode, setStatsViewMode] = useState('table'); // 'table' or 'chart'
  const [statsType, setStatsType] = useState('main'); // 'main' or 'special'
  const [sortBy, setSortBy] = useState('number');
  const [calculationMode, setCalculationMode] = useState('common'); // 'common' or 'separate'
  const [currentReport, setCurrentReport] = useState('absences'); // 'absences', 'pairs', or 'transitions'

  // Reset stats configurations when game type changes
  useEffect(() => {
    setStatsType('main');
    setStatsSearchQuery('');
    setCalculationMode('common');
    setCurrentReport('absences');
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

  // --- 2. CẶP SỐ HAY ĐI CÙNG NHAU ---
  const getPairsFrequency = () => {
    if (visibleResults.length === 0) return [];
    const mainLength = game === '535' ? 5 : 6;
    const pairs = {};

    visibleResults.forEach(draw => {
      if (!draw.numbers || draw.numbers.length < mainLength) return;
      const nums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10));
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const n1 = Math.min(nums[i], nums[j]);
          const n2 = Math.max(nums[i], nums[j]);
          const key = `${String(n1).padStart(2, '0')}-${String(n2).padStart(2, '0')}`;
          pairs[key] = (pairs[key] || 0) + 1;
        }
      }
    });

    const list = Object.entries(pairs).map(([pair, count]) => {
      const [num1, num2] = pair.split('-');
      return { num1, num2, count };
    });

    list.sort((a, b) => b.count - a.count);
    return list;
  };

  const getFilteredPairs = () => {
    const allPairs = getPairsFrequency();
    if (!statsSearchQuery.trim()) return allPairs;

    const queryParts = statsSearchQuery.split(/[\s,.-]+/).filter(Boolean);
    return allPairs.filter(item => {
      return queryParts.some(part => {
        const query = String(parseInt(part, 10)).padStart(2, '0');
        return item.num1 === query || item.num2 === query;
      });
    });
  };

  const filteredPairs = getFilteredPairs();

  // --- 3. BẠC NHỚ (KỲ TRƯỚC -> KỲ SAU) ---
  const getTransitions = () => {
    if (visibleResults.length < 2) return [];
    const mainLength = game === '535' ? 5 : 6;
    const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
    
    // Đảm bảo sắp xếp tăng dần theo drawId để bảo toàn thời gian
    const chronological = [...visibleResults].sort((a, b) => a.drawId - b.drawId);
    
    const transitions = {};
    for (let i = 1; i <= maxNum; i++) {
      transitions[i] = {};
    }

    for (let t = 0; t < chronological.length - 1; t++) {
      const prev = chronological[t];
      const next = chronological[t + 1];
      if (!prev.numbers || !next.numbers || prev.numbers.length < mainLength || next.numbers.length < mainLength) continue;

      const prevNums = prev.numbers.slice(0, mainLength).map(Number);
      const nextNums = next.numbers.slice(0, mainLength).map(Number);

      prevNums.forEach(x => {
        nextNums.forEach(y => {
          if (transitions[x]) {
            transitions[x][y] = (transitions[x][y] || 0) + 1;
          }
        });
      });
    }

    const result = [];
    for (let i = 1; i <= maxNum; i++) {
      const nextMap = transitions[i] || {};
      const nextArray = Object.entries(nextMap).map(([num, count]) => ({
        num: String(num).padStart(2, '0'),
        count
      })).sort((a, b) => b.count - a.count);

      result.push({
        number: String(i).padStart(2, '0'),
        topNext: nextArray.slice(0, 8) // Top 8 số hay xuất hiện nhất
      });
    }

    return result;
  };

  const getFilteredTransitions = () => {
    const allTransitions = getTransitions();
    if (!statsSearchQuery.trim()) return allTransitions;

    const queryParts = statsSearchQuery.split(/[\s,.-]+/).filter(Boolean);
    return allTransitions.filter(item => {
      return queryParts.some(part => {
        const query = String(parseInt(part, 10)).padStart(2, '0');
        return item.number === query;
      });
    });
  };

  const filteredTransitions = getFilteredTransitions();

  return (
    <div className="stats-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Thống kê Sub-Tabs */}
      <div className="stats-sub-tabs" style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '4px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '8px',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'absences', label: 'Chu kỳ vắng' },
          { id: 'pairs', label: 'Cặp số hay đi cùng nhau' },
          { id: 'transitions', label: 'Bạc nhớ (Kỳ trước ➔ Kỳ sau)' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${currentReport === tab.id ? 'active' : ''}`}
            onClick={() => setCurrentReport(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              color: currentReport === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: currentReport === tab.id ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '0 4px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {currentReport === 'absences' && `Chu kỳ vắng dựa trên ${visibleResults.length} kỳ quay (${game !== '645' ? `Chế độ ${calculationMode === 'common' ? 'Chung' : 'Riêng'}` : 'Số chính'}).`}
          {currentReport === 'pairs' && `Tần suất đi cặp trong 1 kỳ (Dựa trên ${visibleResults.length} kỳ quay).`}
          {currentReport === 'transitions' && `Xu hướng xuất hiện ở kỳ sau (Dựa trên ${visibleResults.length} kỳ quay).`}
        </span>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="input-group" style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              placeholder="Lọc số (ví dụ: 15)..."
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
              strokeWidth="2.5" 
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
                  fontSize: '1.1rem',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Absence controls */}
          {currentReport === 'absences' && (
            <>
              {/* View mode toggle */}
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

              {/* Special number toggle */}
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

              {/* Common/Separate toggle */}
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

              {/* Sorting */}
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
            </>
          )}
        </div>
      </div>

      {/* RENDER CHOSEN REPORT */}
      {currentReport === 'absences' ? (
        statsViewMode === 'table' ? (
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
                barColor = '#e63946';
                glowColor = 'rgba(230, 57, 70, 0.3)';
              } else if (item.absentDraws >= 10) {
                barColor = '#f4a261';
                glowColor = 'rgba(244, 162, 97, 0.3)';
              } else if (item.absentDraws === 0) {
                barColor = '#2a9d8f';
                glowColor = 'rgba(42, 157, 143, 0.3)';
              }

              return (
                <div key={item.number} style={{ display: 'flex', alignItems: 'center', gap: '16px' }} title={`Số ${item.number} vắng mặt ${item.absentDraws} kỳ.`}>
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
        )
      ) : currentReport === 'pairs' ? (
        /* REPORT: CO-OCCURRING PAIRS */
        <div className="table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '120px' }}>Số thứ nhất</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Số thứ hai</th>
                <th style={{ textAlign: 'center', width: '180px' }}>Số kỳ đi cùng nhau</th>
                <th>Tỷ lệ đi cùng</th>
              </tr>
            </thead>
            <tbody>
              {filteredPairs.slice(0, 100).map((item, idx) => {
                const percent = visibleResults.length > 0 ? ((item.count / visibleResults.length) * 100).toFixed(1) : 0;
                return (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center' }}>
                      <span className="ball" style={{ margin: '0 auto' }}>{item.num1}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="ball" style={{ margin: '0 auto' }}>{item.num2}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {item.count} kỳ
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '45px', fontWeight: '600' }}>{percent}%</span>
                        <div style={{ flex: 1, height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, percent * 5)}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPairs.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '24px' }}>
                    Không tìm thấy cặp số nào khớp điều kiện tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* REPORT: TRANSITIONS / BẠC NHỚ */
        <div className="table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '100px' }}>Số kỳ trước</th>
                <th>Số hay xuất hiện nhất ở kỳ sau (Bóng số & Số lần về)</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransitions.map((item) => (
                <tr key={item.number}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <span className="ball" style={{ margin: '0 auto', background: 'radial-gradient(circle at 30% 30%, #457b9d, #1d3557)' }}>
                      {item.number}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '4px 0' }}>
                      {item.topNext.map((next, idx) => {
                        const maxCount = Math.max(...item.topNext.map(t => t.count), 1);
                        const relativeWeight = next.count / maxCount;
                        const opacity = 0.45 + relativeWeight * 0.55;
                        
                        return (
                          <div key={idx} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            background: `rgba(255,255,255,${0.03 + relativeWeight * 0.05})`, 
                            padding: '4px 8px', 
                            borderRadius: '20px',
                            border: `1px solid rgba(255,255,255,${0.04 + relativeWeight * 0.08})`,
                            opacity: opacity
                          }}>
                            <span className="ball small" style={{ 
                              width: '24px', 
                              height: '24px', 
                              fontSize: '0.75rem', 
                              marginRight: '6px',
                              background: relativeWeight === 1 ? 'var(--primary)' : undefined
                            }}>
                              {next.num}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: relativeWeight === 1 ? 'var(--primary)' : 'var(--text-main)' }}>
                              {next.count} lần
                            </span>
                          </div>
                        );
                      })}
                      {item.topNext.length === 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dimmed)' }}>Chưa có dữ liệu kỳ sau</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransitions.length === 0 && (
                <tr>
                  <td colSpan="2" style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '24px' }}>
                    Không tìm thấy dữ liệu số khớp điều kiện tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StatsPanel;
