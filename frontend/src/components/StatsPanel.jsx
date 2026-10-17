import React, { useState, useEffect, useMemo } from 'react';
import ResultsMatrixCollapse from './ResultsMatrixCollapse';
import NumberMatrixGrid from './NumberMatrixGrid';

function StatsPanel({ game, visibleResults }) {
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [statsViewMode, setStatsViewMode] = useState('table'); // 'table', 'chart', or 'matrix'
  const [statsType, setStatsType] = useState('main'); // 'main' or 'special'
  const [sortBy, setSortBy] = useState('number');
  const [calculationMode, setCalculationMode] = useState('common'); // 'common' or 'separate'
  const [currentReport, setCurrentReport] = useState('absences'); // 'absences', 'pairs', or 'transitions'

  // Date range and coverage filter state
  const [datePreset, setDatePreset] = useState('all'); // 'all', '10', '20', '30days', '60days', '90days', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [matrixViewType, setMatrixViewType] = useState('coverage'); // 'coverage' (lấp số) or 'draw' (theo kỳ)
  const [showMissingNumbers, setShowMissingNumbers] = useState(true);

  // Helper to parse draw date to ISO format YYYY-MM-DD
  const parseDateToISO = (draw) => {
    if (!draw) return '';
    if (draw.dateYmd) return draw.dateYmd;
    if (!draw.dateStr) return '';
    const parts = draw.dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return draw.dateStr;
  };

  // Find min/max available dates across all visible results
  const availableDateRange = useMemo(() => {
    if (!visibleResults || visibleResults.length === 0) return { min: '', max: '' };
    const isoDates = visibleResults.map(parseDateToISO).filter(Boolean).sort();
    return {
      min: isoDates[0] || '',
      max: isoDates[isoDates.length - 1] || ''
    };
  }, [visibleResults]);

  // Synchronize start/end date inputs when availableDateRange updates
  useEffect(() => {
    if (datePreset === 'all' && availableDateRange.min && availableDateRange.max) {
      setStartDate(availableDateRange.min);
      setEndDate(availableDateRange.max);
    }
  }, [availableDateRange, datePreset]);

  // Reset stats configurations when game type changes
  useEffect(() => {
    setStatsType('main');
    setStatsSearchQuery('');
    setCalculationMode('common');
    setCurrentReport('absences');
    setDatePreset('all');
  }, [game]);

  // Preset selector handler
  const handlePresetSelect = (preset) => {
    setDatePreset(preset);
    if (!visibleResults || visibleResults.length === 0) return;
    
    const sorted = [...visibleResults].sort((a, b) => b.drawId - a.drawId);
    if (preset === 'all') {
      setStartDate(availableDateRange.min || '');
      setEndDate(availableDateRange.max || '');
    } else if (preset === '10') {
      const subset = sorted.slice(0, 10);
      if (subset.length > 0) {
        const subIso = subset.map(parseDateToISO).filter(Boolean).sort();
        setStartDate(subIso[0]);
        setEndDate(subIso[subIso.length - 1]);
      }
    } else if (preset === '20') {
      const subset = sorted.slice(0, 20);
      if (subset.length > 0) {
        const subIso = subset.map(parseDateToISO).filter(Boolean).sort();
        setStartDate(subIso[0]);
        setEndDate(subIso[subIso.length - 1]);
      }
    } else if (preset === '30days' || preset === '60days' || preset === '90days') {
      const days = preset === '30days' ? 30 : preset === '60days' ? 60 : 90;
      const baseDate = availableDateRange.max ? new Date(availableDateRange.max) : new Date();
      const cutoff = new Date(baseDate);
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffIso = cutoff.toISOString().split('T')[0];
      setStartDate(cutoffIso);
      setEndDate(availableDateRange.max || baseDate.toISOString().split('T')[0]);
    }
  };

  // Filter draws by selected date range / preset (sorted newest first)
  const rangeFilteredResults = useMemo(() => {
    if (!visibleResults || visibleResults.length === 0) return [];
    
    const sorted = [...visibleResults].sort((a, b) => b.drawId - a.drawId); // Newest first
    
    if (datePreset === '10') {
      return sorted.slice(0, 10);
    }
    if (datePreset === '20') {
      return sorted.slice(0, 20);
    }
    if (datePreset === '30days' || datePreset === '60days' || datePreset === '90days') {
      if (!startDate) return sorted;
      return sorted.filter(draw => {
        const dIso = parseDateToISO(draw);
        return (!startDate || dIso >= startDate) && (!endDate || dIso <= endDate);
      });
    }
    if (datePreset === 'custom') {
      return sorted.filter(draw => {
        const dIso = parseDateToISO(draw);
        if (startDate && dIso < startDate) return false;
        if (endDate && dIso > endDate) return false;
        return true;
      });
    }
    return sorted; // 'all'
  }, [visibleResults, datePreset, startDate, endDate]);

  // Compute number fill rate (Tỷ lệ lấp số) across rangeFilteredResults
  const fillStats = useMemo(() => {
    const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
    const totalNumbers = (statsType === 'special' && calculationMode === 'separate')
      ? (game === '655' ? 55 : 12)
      : maxNum;
    const mainLength = game === '535' ? 5 : 6;
    const specialIdx = game === '655' ? 6 : 5;

    const freqMap = {};
    for (let i = 1; i <= totalNumbers; i++) {
      freqMap[i] = 0;
    }

    rangeFilteredResults.forEach(draw => {
      if (!draw.numbers) return;
      if (statsType === 'special' && calculationMode === 'separate') {
        if (draw.numbers.length > specialIdx) {
          const spNum = parseInt(draw.numbers[specialIdx], 10);
          if (spNum >= 1 && spNum <= totalNumbers) {
            freqMap[spNum] = (freqMap[spNum] || 0) + 1;
          }
        }
      } else {
        const checkNums = (game !== '645' && calculationMode === 'common')
          ? draw.numbers
          : draw.numbers.slice(0, mainLength);
        checkNums.forEach(n => {
          const nInt = parseInt(n, 10);
          if (nInt >= 1 && nInt <= totalNumbers) {
            freqMap[nInt] = (freqMap[nInt] || 0) + 1;
          }
        });
      }
    });

    const filledNumbers = [];
    const missingNumbers = [];

    for (let i = 1; i <= totalNumbers; i++) {
      if (freqMap[i] > 0) {
        filledNumbers.push(String(i).padStart(2, '0'));
      } else {
        missingNumbers.push(String(i).padStart(2, '0'));
      }
    }

    const filledCount = filledNumbers.length;
    const missingCount = missingNumbers.length;
    const fillRate = totalNumbers > 0 ? ((filledCount / totalNumbers) * 100).toFixed(1) : '0';

    let rangeLabel = '';
    if (rangeFilteredResults.length > 0) {
      const newest = rangeFilteredResults[0];
      const oldest = rangeFilteredResults[rangeFilteredResults.length - 1];
      rangeLabel = newest.dateStr && oldest.dateStr 
        ? `${oldest.dateStr} ➔ ${newest.dateStr}`
        : `${rangeFilteredResults.length} kỳ quay`;
    }

    return {
      freqMap,
      totalNumbers,
      filledNumbers,
      missingNumbers,
      filledCount,
      missingCount,
      fillRate: parseFloat(fillRate),
      drawCount: rangeFilteredResults.length,
      rangeLabel
    };
  }, [rangeFilteredResults, game, statsType, calculationMode]);

  // Compute absent draws for main numbers (1-45 Mega, 1-55 Power, 1-35 Lotto) based on date range
  const getAbsenceStatistics = () => {
    if (rangeFilteredResults.length === 0) return [];
    
    const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
    const mainLength = game === '535' ? 5 : 6;
    const reversedResults = rangeFilteredResults; // already newest first
    const stats = [];
    
    for (let i = 1; i <= maxNum; i++) {
      const numStr = String(i).padStart(2, '0');
      const frequency = fillStats.freqMap[i] || 0;
      
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
          lastSeenDate: reversedResults[firstSeenIndex].dateStr,
          frequency,
          isFilled: frequency > 0
        });
      } else {
        stats.push({
          number: numStr,
          absentDraws: rangeFilteredResults.length,
          lastSeenDrawId: 'N/A',
          lastSeenDate: 'Chưa về',
          frequency,
          isFilled: false
        });
      }
    }
    
    return stats;
  };

  // Compute absent draws for Special/Bonus numbers based on date range
  const getSpecialAbsenceStatistics = () => {
    if (rangeFilteredResults.length === 0 || game === '645') return [];
    
    const maxNum = game === '655' ? 55 : 12;
    const specialIdx = game === '655' ? 6 : 5;
    const reversedResults = rangeFilteredResults; // already newest first
    const stats = [];
    
    for (let i = 1; i <= maxNum; i++) {
      const numStr = String(i).padStart(2, '0');
      const frequency = fillStats.freqMap[i] || 0;
      
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
          lastSeenDate: reversedResults[firstSeenIndex].dateStr,
          frequency,
          isFilled: frequency > 0
        });
      } else {
        stats.push({
          number: numStr,
          absentDraws: rangeFilteredResults.length,
          lastSeenDrawId: 'N/A',
          lastSeenDate: 'Chưa về',
          frequency,
          isFilled: false
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
    } else if (sortBy === 'frequency-desc') {
      return stats.sort((a, b) => b.frequency - a.frequency);
    } else if (sortBy === 'frequency-asc') {
      return stats.sort((a, b) => a.frequency - b.frequency);
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

  // --- 3. BẠC NHỚ (KỲ TRƯỚC -> KỲ SAU) với LIFT METRIC ---
  const getTransitions = () => {
    if (visibleResults.length < 2) return [];
    const mainLength = game === '535' ? 5 : 6;
    const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
    
    // Sắp xếp tăng dần theo drawId (chronological order)
    const chronological = [...visibleResults].sort((a, b) => a.drawId - b.drawId);
    
    // 1. Tính tần suất xuất hiện tổng thể của mỗi số
    const globalFreq = {};
    for (let i = 1; i <= maxNum; i++) globalFreq[i] = 0;
    chronological.forEach(draw => {
      if (!draw.numbers || draw.numbers.length < mainLength) return;
      draw.numbers.slice(0, mainLength).map(Number).forEach(n => {
        globalFreq[n] = (globalFreq[n] || 0) + 1;
      });
    });

    // 2. Tính tần suất xuất hiện của mỗi số ở vị trí "kỳ trước" (trừ kỳ cuối)
    const prevAppearCount = {};
    for (let i = 1; i <= maxNum; i++) prevAppearCount[i] = 0;
    for (let t = 0; t < chronological.length - 1; t++) {
      const prev = chronological[t];
      if (!prev.numbers || prev.numbers.length < mainLength) continue;
      prev.numbers.slice(0, mainLength).map(Number).forEach(n => {
        prevAppearCount[n] = (prevAppearCount[n] || 0) + 1;
      });
    }

    // 3. Đếm transition matrix
    const transitions = {};
    for (let i = 1; i <= maxNum; i++) transitions[i] = {};

    let validPairCount = 0;
    for (let t = 0; t < chronological.length - 1; t++) {
      const prev = chronological[t];
      const next = chronological[t + 1];
      if (!prev.numbers || !next.numbers || prev.numbers.length < mainLength || next.numbers.length < mainLength) continue;

      validPairCount++;
      const prevNums = prev.numbers.slice(0, mainLength).map(Number);
      const nextNums = next.numbers.slice(0, mainLength).map(Number);

      prevNums.forEach(x => {
        nextNums.forEach(y => {
          transitions[x][y] = (transitions[x][y] || 0) + 1;
        });
      });
    }

    // 4. Tính Lift, P(Y|X), P(Y), z-score cho mỗi transition
    const totalDraws = chronological.length;
    const pExpect = mainLength / maxNum; // P(Y trong 1 kỳ ngẫu nhiên)

    const result = [];
    for (let i = 1; i <= maxNum; i++) {
      const nextMap = transitions[i] || {};
      const xAppear = prevAppearCount[i] || 1; // số kỳ mà số i xuất hiện ở vị trí "trước"
      const expectedPerY = xAppear * pExpect; // kỳ vọng ngẫu nhiên cho transition[i][Y]

      const nextArray = Object.entries(nextMap).map(([num, count]) => {
        const numInt = parseInt(num, 10);
        const pYGlobal = globalFreq[numInt] / totalDraws; // P(Y tổng thể)
        const pYGivenX = count / (xAppear * mainLength);   // P(Y | X=i)
        const lift = pYGlobal > 0 ? pYGivenX / pYGlobal : 1;
        const zScore = expectedPerY > 0 ? (count - expectedPerY) / Math.max(Math.sqrt(expectedPerY), 1) : 0;

        return {
          num: String(numInt).padStart(2, '0'),
          count,
          lift: Math.round(lift * 1000) / 1000,
          pConditional: Math.round(pYGivenX * 10000) / 100, // %
          pGlobal: Math.round(pYGlobal * 10000) / 100,       // %
          zScore: Math.round(zScore * 100) / 100
        };
      }).sort((a, b) => b.lift - a.lift); // Sắp xếp theo Lift giảm dần

      result.push({
        number: String(i).padStart(2, '0'),
        appearances: xAppear,
        topNext: nextArray.slice(0, 10) // Top 10 số có Lift cao nhất
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

  const absenceMap = useMemo(() => {
    const stats = statsType === 'special' ? getSpecialAbsenceStatistics() : getAbsenceStatistics();
    const map = {};
    stats.forEach(item => {
      map[parseInt(item.number, 10)] = item.absentDraws;
    });
    return map;
  }, [rangeFilteredResults, game, statsType, calculationMode, fillStats]);

  const latestDraw = useMemo(() => {
    if (!rangeFilteredResults || rangeFilteredResults.length === 0) return null;
    return rangeFilteredResults[0];
  }, [rangeFilteredResults]);

  return (
    <div className="stats-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Collapsible Number Matrix with Absence & Coverage Info */}
      {visibleResults.length > 0 && (
        <ResultsMatrixCollapse
          game={game}
          results={rangeFilteredResults.length > 0 ? rangeFilteredResults : visibleResults}
          absenceMap={absenceMap}
          fillStats={fillStats}
          title={`Ma trận số 8 cột (Chu kỳ vắng & Tỷ lệ lấp số)`}
          subtitle={`Phạm vi ${rangeFilteredResults.length} kỳ quay • Tỷ lệ lấp số: ${fillStats.fillRate}% (${fillStats.filledCount}/${fillStats.totalNumbers} số)`}
        />
      )}
      
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

      {/* BẢNG ĐIỀU KHIỂN KHOẢNG NGÀY & TỶ LỆ LẤP SỐ (CHỈ TRONG TAB CHU KỲ VẮNG) */}
      {currentReport === 'absences' && (
        <div 
          className="coverage-kpi-card glass-panel"
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          {/* Row 1: Header + Presets */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(46, 196, 182, 0.15)',
                border: '1px solid rgba(46, 196, 182, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                color: '#2ec4b6',
                flexShrink: 0
              }}>
                📅
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: '#fff' }}>
                  Phân tích theo khoảng ngày & Tỷ lệ lấp số
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Lọc kỳ quay theo thời gian để theo dõi tỷ lệ bao phủ và các số chưa từng xuất hiện
                </span>
              </div>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'all', label: 'Tất cả' },
                { id: '10', label: '10 kỳ gần nhất' },
                { id: '20', label: '20 kỳ gần nhất' },
                { id: '30days', label: '30 ngày' },
                { id: '60days', label: '60 ngày' },
                { id: '90days', label: '90 ngày' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  style={{
                    background: datePreset === p.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                    border: datePreset === p.id ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: datePreset === p.id ? '#fff' : 'var(--text-muted)',
                    borderRadius: '6px',
                    padding: '5px 11px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Date Pickers & Range Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Từ ngày:</span>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                style={{ height: '30px', padding: '2px 8px', fontSize: '0.8rem', width: '135px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Đến ngày:</span>
              <input
                type="date"
                className="input-field"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                style={{ height: '30px', padding: '2px 8px', fontSize: '0.8rem', width: '135px' }}
              />
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Đang xét: <strong style={{ color: '#fff' }}>{rangeFilteredResults.length}</strong> / {visibleResults.length} kỳ</span>
              {fillStats.rangeLabel && (
                <span style={{ color: 'var(--accent)', fontWeight: '600' }}>({fillStats.rangeLabel})</span>
              )}
            </div>
          </div>

          {/* Row 3: 4 KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            {/* KPI 1: Tỷ lệ lấp số */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>TỶ LỆ LẤP SỐ</span>
                <span style={{ color: '#2ec4b6', fontWeight: '700' }}>{fillStats.filledCount}/{fillStats.totalNumbers} số</span>
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: fillStats.fillRate >= 80 ? '#2ec4b6' : fillStats.fillRate >= 60 ? '#f4a261' : '#e63946' }}>
                {fillStats.fillRate}%
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, fillStats.fillRate)}%`,
                  height: '100%',
                  background: fillStats.fillRate >= 80 ? 'linear-gradient(90deg, #2ec4b6, #3a86ff)' : 'linear-gradient(90deg, #f4a261, #e63946)',
                  borderRadius: '3px',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>

            {/* KPI 2: Số đã lấp */}
            <div style={{
              background: 'rgba(46, 196, 182, 0.06)',
              border: '1px solid rgba(46, 196, 182, 0.2)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#2ec4b6', fontWeight: '600' }}>SỐ ĐÃ LẤP (ĐÃ VỀ)</span>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#fff' }}>
                {fillStats.filledCount} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>số</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Xuất hiện ≥ 1 lần trong khoảng này</span>
            </div>

            {/* KPI 3: Số chưa lấp */}
            <div style={{
              background: 'rgba(230, 57, 70, 0.06)',
              border: '1px solid rgba(230, 57, 70, 0.2)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#ff6b6b', fontWeight: '600' }}>SỐ CHƯA LẤP (VẮNG MẶT)</span>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#ff6b6b' }}>
                {fillStats.missingCount} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>số</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Chưa từng về lần nào</span>
            </div>

            {/* KPI 4: Số kỳ quay */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>KỲ QUAY TRONG KHOẢNG</span>
              <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#fff' }}>
                {fillStats.drawCount} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)' }}>kỳ</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mẫu dữ liệu tính toán</span>
            </div>
          </div>

          {/* Row 4: Missing Numbers Ball Pills (Số chưa lấp) */}
          {fillStats.missingNumbers.length > 0 && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(230, 57, 70, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: '#ff6b6b', fontWeight: '700' }}>
                  ⚠️ Danh sách {fillStats.missingCount} số chưa lấp (vắng mặt toàn bộ khoảng ngày đã chọn):
                </span>
                <button
                  onClick={() => setShowMissingNumbers(!showMissingNumbers)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    textDecoration: 'underline'
                  }}
                >
                  {showMissingNumbers ? 'Thu gọn' : 'Xem chi tiết'}
                </button>
              </div>

              {showMissingNumbers && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  {fillStats.missingNumbers.map(num => (
                    <span
                      key={num}
                      className="ball"
                      style={{
                        width: '28px',
                        height: '28px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: 'rgba(230, 57, 70, 0.18)',
                        color: '#ff858d',
                        border: '1px solid rgba(230, 57, 70, 0.4)',
                        boxShadow: 'none'
                      }}
                      title={`Số ${num}: Chưa về lần nào trong ${fillStats.drawCount} kỳ quay`}
                    >
                      {num}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '0 4px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {currentReport === 'absences' && `Chu kỳ vắng và tỷ lệ lấp số dựa trên ${rangeFilteredResults.length} / ${visibleResults.length} kỳ quay (${game !== '645' ? `Chế độ ${calculationMode === 'common' ? 'Chung' : 'Riêng'}` : 'Số chính'}).`}
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
                <button
                  className={`toggle-btn ${statsViewMode === 'matrix' ? 'active' : ''}`}
                  onClick={() => setStatsViewMode('matrix')}
                  style={{
                    background: statsViewMode === 'matrix' ? 'var(--primary)' : 'none',
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
                  Ma trận 8 số
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
                  <option value="frequency-desc">Tần suất xuất hiện (Nhiều nhất)</option>
                  <option value="frequency-asc">Tần suất xuất hiện (Ít nhất / Chưa lấp)</option>
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
                  <th style={{ textAlign: 'center', width: '70px' }}>Số</th>
                  <th style={{ textAlign: 'center', width: '160px' }}>Tình trạng lấp số</th>
                  <th style={{ textAlign: 'center', width: '160px' }}>Số kỳ vắng mặt</th>
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
                      <td style={{ textAlign: 'center' }}>
                        {item.isFilled ? (
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            backgroundColor: 'rgba(46, 196, 182, 0.15)',
                            color: '#2ec4b6',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✓ Đã lấp ({item.frequency} lần)
                          </span>
                        ) : (
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            backgroundColor: 'rgba(230, 57, 70, 0.15)',
                            color: '#e63946',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✗ Chưa lấp (0)
                          </span>
                        )}
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
        ) : statsViewMode === 'chart' ? (
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
                <div key={item.number} style={{ display: 'flex', alignItems: 'center', gap: '16px' }} title={`Số ${item.number} vắng mặt ${item.absentDraws} kỳ, xuất hiện ${item.frequency} lần trong khoảng ngày.`}>
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
                      <span>
                        Lần về gần nhất: <strong>{item.lastSeenDrawId !== 'N/A' ? `#${item.lastSeenDrawId}` : 'N/A'}</strong> ({item.lastSeenDate})
                        <span style={{ marginLeft: '10px', color: item.isFilled ? '#2ec4b6' : '#ff6b6b', fontWeight: '600' }}>
                          • {item.isFilled ? `Đã lấp (${item.frequency} lần)` : 'Chưa lấp (0 lần)'}
                        </span>
                      </span>
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
        ) : (
          /* REPORT: MATRIX 8-COLUMNS VIEW WITH COVERAGE TOGGLE */
          <div 
            className="matrix-view glass-panel" 
            style={{ 
              padding: '24px 16px', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '16px',
              background: 'rgba(10, 15, 29, 0.4)'
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: '580px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: '0 0 6px 0', color: '#fff' }}>
                Ma trận 8 số/dòng • Tỷ lệ lấp số theo khoảng ngày (1 - {game === '645' ? 45 : (game === '655' ? 55 : 35)})
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                {matrixViewType === 'coverage'
                  ? `Đã lấp ${fillStats.filledCount}/${fillStats.totalNumbers} số (${fillStats.fillRate}%) trong ${fillStats.drawCount} kỳ quay • Sáng các số đã về (kèm tần suất), mờ các số chưa từng về.`
                  : (latestDraw 
                      ? `Kỳ mới nhất #${latestDraw.drawIdStr} (${latestDraw.dateStr}) • Sáng các số có trong kết quả xổ số, số bên dưới là số kỳ vắng mặt.` 
                      : 'Mỗi dòng 8 số, chỉ sáng số có trong kết quả xổ số.')
                }
              </p>
            </div>

            {/* Matrix View Sub-Mode Switcher */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                onClick={() => setMatrixViewType('coverage')}
                style={{
                  background: matrixViewType === 'coverage' ? 'var(--primary)' : 'none',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  transition: 'all 0.2s'
                }}
              >
                🎯 Ma trận lấp số ({fillStats.fillRate}%)
              </button>
              <button
                onClick={() => setMatrixViewType('draw')}
                style={{
                  background: matrixViewType === 'draw' ? 'var(--primary)' : 'none',
                  border: 'none',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  transition: 'all 0.2s'
                }}
              >
                🎲 Ma trận kỳ gần nhất (#{latestDraw ? latestDraw.drawIdStr : 'N/A'})
              </button>
            </div>

            <div 
              style={{
                background: 'rgba(10, 15, 29, 0.65)',
                padding: '20px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.4)'
              }}
            >
              {matrixViewType === 'coverage' ? (
                <NumberMatrixGrid
                  game={game}
                  numbers={[]}
                  compact={false}
                  coverageMode={true}
                  freqMap={fillStats.freqMap}
                  showFrequency={true}
                  absenceMap={absenceMap}
                />
              ) : (
                <NumberMatrixGrid
                  game={game}
                  numbers={latestDraw ? latestDraw.numbers : []}
                  compact={false}
                  absenceMap={absenceMap}
                  showAbsence={true}
                />
              )}
            </div>

            {/* Legend for Matrix View */}
            <div 
              style={{ 
                display: 'flex', 
                gap: '16px', 
                flexWrap: 'wrap', 
                justifyContent: 'center', 
                alignItems: 'center',
                fontSize: '0.8rem', 
                color: 'var(--text-muted)',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '8px 16px',
                borderRadius: '8px'
              }}
            >
              {matrixViewType === 'coverage' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #e63946, #c1121f)', display: 'inline-block', boxShadow: '0 0 6px rgba(230,57,70,0.8)' }} />
                    <span>Đã lấp (Có xuất hiện)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', display: 'inline-block' }} />
                    <span>Chưa lấp (Vắng 100%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#2ec4b6', fontWeight: 'bold' }}>X lần:</span>
                    <span>Số lần về trong khoảng</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#e63946', fontWeight: 'bold' }}>0:</span>
                    <span>Chưa về lần nào</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'radial-gradient(circle at 30% 30%, #e63946, #c1121f)', display: 'inline-block', boxShadow: '0 0 6px rgba(230,57,70,0.8)' }} />
                    <span>Số trúng kỳ này (Sáng)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#2ec4b6', fontWeight: 'bold' }}>0:</span>
                    <span>Vừa về</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#f4a261', fontWeight: 'bold' }}>≥10k:</span>
                    <span>Vắng lâu</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#e63946', fontWeight: 'bold' }}>≥20k:</span>
                    <span>Vắng cực đại</span>
                  </div>
                </>
              )}
            </div>
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
        /* REPORT: TRANSITIONS / BẠC NHỚ (Lift Metric) */
        <div className="table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '100px' }}>Số kỳ trước</th>
                <th>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Top số hay xuất hiện ở kỳ sau (sắp xếp theo Lift)</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed)', fontWeight: '400' }}>
                      Lift {'>'} 1.0 = cao hơn ngẫu nhiên &nbsp;|&nbsp; Lift ≈ 1.0 = ngẫu nhiên &nbsp;|&nbsp; Lift {'<'} 1.0 = thấp hơn
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransitions.map((item) => (
                <tr key={item.number}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <span className="ball" style={{ margin: '0 auto', background: 'radial-gradient(circle at 30% 30%, #457b9d, #1d3557)' }}>
                      {item.number}
                    </span>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', marginTop: '4px' }}>
                      {item.appearances} kỳ
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '4px 0' }}>
                      {item.topNext.map((next, idx) => {
                        // Color coding based on Lift
                        let liftColor, liftBg, liftBorder, liftIcon;
                        if (next.lift >= 1.20) {
                          liftColor = '#2ecc71'; // Green - significantly above random
                          liftBg = 'rgba(46, 204, 113, 0.08)';
                          liftBorder = 'rgba(46, 204, 113, 0.25)';
                          liftIcon = '🔥';
                        } else if (next.lift >= 1.10) {
                          liftColor = '#87ceab'; // Light green - slightly above
                          liftBg = 'rgba(135, 206, 171, 0.06)';
                          liftBorder = 'rgba(135, 206, 171, 0.18)';
                          liftIcon = '↑';
                        } else if (next.lift <= 0.80) {
                          liftColor = '#e74c3c'; // Red - significantly below
                          liftBg = 'rgba(231, 76, 60, 0.06)';
                          liftBorder = 'rgba(231, 76, 60, 0.18)';
                          liftIcon = '↓';
                        } else if (next.lift <= 0.90) {
                          liftColor = '#e0a899'; // Light red - slightly below
                          liftBg = 'rgba(224, 168, 153, 0.05)';
                          liftBorder = 'rgba(224, 168, 153, 0.15)';
                          liftIcon = '↓';
                        } else {
                          liftColor = 'var(--text-muted)'; // Neutral
                          liftBg = 'rgba(255,255,255,0.03)';
                          liftBorder = 'rgba(255,255,255,0.06)';
                          liftIcon = '≈';
                        }
                        
                        const tooltipText = `Số ${next.num}: ${next.count} lần\nP(${next.num}|${item.number}) = ${next.pConditional}%\nP(${next.num}) tổng thể = ${next.pGlobal}%\nLift = ${next.lift}x\nZ-Score = ${next.zScore}`;
                        
                        return (
                          <div key={idx} title={tooltipText} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            background: liftBg, 
                            padding: '4px 10px 4px 6px', 
                            borderRadius: '20px',
                            border: `1px solid ${liftBorder}`,
                            cursor: 'help',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            gap: '6px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 0 10px ${liftBorder}`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <span className="ball small" style={{ 
                              width: '24px', 
                              height: '24px', 
                              fontSize: '0.75rem',
                              flexShrink: 0,
                              background: next.lift >= 1.20 ? 'radial-gradient(circle at 30% 30%, #2ecc71, #1a8c4e)' :
                                         next.lift >= 1.10 ? 'radial-gradient(circle at 30% 30%, #5dade2, #2980b9)' :
                                         undefined
                            }}>
                              {next.num}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.15' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: liftColor }}>
                                {liftIcon} {next.lift.toFixed(2)}x
                              </span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-dimmed)' }}>
                                {next.count} lần
                              </span>
                            </div>
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
