import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NumberMatrixGrid from './NumberMatrixGrid';

function ResultsMatrixCollapse({ 
  game, 
  results = [], 
  onToggleAll, 
  allRowsExpanded,
  absenceMap = null,
  fillStats = null,
  title,
  subtitle,
  initialOpen = false
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [selectedDrawId, setSelectedDrawId] = useState(null);
  const [showAbsenceInMatrix, setShowAbsenceInMatrix] = useState(Boolean(absenceMap));
  const [collapseViewMode, setCollapseViewMode] = useState(fillStats ? 'coverage' : 'draw'); // 'draw' or 'coverage'

  // Results are usually in ascending or descending order.
  // In App.jsx, results are sorted ascending by drawId, and filteredResults.slice().reverse() is used to display newest first.
  // Let's create a list with newest first for the collapse selector:
  const sortedDraws = useMemo(() => {
    if (!results || results.length === 0) return [];
    return [...results].sort((a, b) => b.drawId - a.drawId);
  }, [results]);

  // Current active draw
  const currentDraw = useMemo(() => {
    if (sortedDraws.length === 0) return null;
    if (selectedDrawId) {
      const found = sortedDraws.find(d => d.drawId === selectedDrawId);
      if (found) return found;
    }
    return sortedDraws[0];
  }, [sortedDraws, selectedDrawId]);

  if (!results || results.length === 0 || !currentDraw) {
    return null;
  }

  const currentIndex = sortedDraws.findIndex(d => d.drawId === currentDraw.drawId);
  const hasPrev = currentIndex < sortedDraws.length - 1; // older draw
  const hasNext = currentIndex > 0; // newer draw

  const handlePrevDraw = () => {
    if (hasPrev) {
      setSelectedDrawId(sortedDraws[currentIndex + 1].drawId);
    }
  };

  const handleNextDraw = () => {
    if (hasNext) {
      setSelectedDrawId(sortedDraws[currentIndex - 1].drawId);
    }
  };

  const maxNumber = game === '645' ? 45 : (game === '655' ? 55 : 35);
  const gameName = game === '645' ? 'MEGA 6/45' : (game === '655' ? 'POWER 6/55' : '5/35');

  // Stats for the active draw
  const mainLength = game === '535' ? 5 : 6;
  const mainNums = currentDraw.numbers ? currentDraw.numbers.slice(0, mainLength).map(Number) : [];
  const oddCount = mainNums.filter(n => n % 2 !== 0).length;
  const evenCount = mainNums.length - oddCount;
  const midPoint = game === '645' ? 23 : (game === '655' ? 28 : 18);
  const lowCount = mainNums.filter(n => n < midPoint).length;
  const highCount = mainNums.length - lowCount;
  const sum = mainNums.reduce((a, b) => a + b, 0);

  return (
    <div 
      className="glass-panel results-matrix-collapse" 
      style={{
        marginBottom: '16px',
        padding: '0',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.7)'
      }}
    >
      {/* Collapse Trigger Header Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          cursor: 'pointer',
          userSelect: 'none',
          background: isOpen ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
          transition: 'background 0.2s ease',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(230, 57, 70, 0.15)',
              border: '1px solid rgba(230, 57, 70, 0.3)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '700', fontSize: '0.92rem', color: '#fff' }}>
                {title || `Ma trận số 8 cột (1 - ${maxNumber})`}
              </span>
              <span className={`badge ${game === '645' ? 'badge-mega' : 'badge-power'}`} style={{ fontSize: '0.7rem' }}>
                {gameName}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {subtitle || `Kỳ quay #${currentDraw.drawIdStr} (${currentDraw.dateStr}) • 8 số/dòng, sáng số trúng thưởng`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Quick numbers indicator on header */}
          {!isOpen && (
            <div className="balls-container desktop-only" style={{ gap: '4px', transform: 'scale(0.85)' }}>
              {currentDraw.numbers.slice(0, mainLength).map((n, i) => (
                <span key={i} className="ball" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                  {n}
                </span>
              ))}
              {game === '655' && currentDraw.numbers[6] && (
                <span className="ball power-bonus" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                  {currentDraw.numbers[6]}
                </span>
              )}
            </div>
          )}

          {absenceMap && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAbsenceInMatrix(!showAbsenceInMatrix);
              }}
              style={{
                background: showAbsenceInMatrix ? 'rgba(46, 196, 182, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: showAbsenceInMatrix ? '1px solid rgba(46, 196, 182, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: showAbsenceInMatrix ? '#2ec4b6' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              title="Hiện hoặc ẩn số chu kỳ vắng mặt dưới mỗi bóng số"
            >
              {showAbsenceInMatrix ? '✓ Hiện kỳ vắng' : 'Ẩn kỳ vắng'}
            </button>
          )}

          {onToggleAll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleAll();
              }}
              style={{
                background: allRowsExpanded ? 'rgba(46, 196, 182, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: allRowsExpanded ? '1px solid rgba(46, 196, 182, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: allRowsExpanded ? '#2ec4b6' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s'
              }}
              title="Mở hoặc thu gọn tất cả lưới số từng kỳ trong bảng kết quả bên dưới"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              {allRowsExpanded ? 'Thu gọn bảng' : 'Mở rộng bảng'}
            </button>
          )}

          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--accent)',
              fontSize: '0.8rem',
              fontWeight: '600',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(168, 218, 220, 0.08)'
            }}
          >
            <span>{isOpen ? 'Thu gọn' : 'Mở ra'}</span>
            <motion.svg 
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </motion.svg>
          </div>
        </div>
      </div>

      {/* Expanded Collapse Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {/* Mode Toggle if fillStats is provided */}
              {fillStats && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                  <div style={{
                    display: 'flex',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '3px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <button
                      onClick={() => setCollapseViewMode('coverage')}
                      style={{
                        background: collapseViewMode === 'coverage' ? 'var(--primary)' : 'none',
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
                      🎯 Tỷ lệ lấp số ({fillStats.fillRate}%)
                    </button>
                    <button
                      onClick={() => setCollapseViewMode('draw')}
                      style={{
                        background: collapseViewMode === 'draw' ? 'var(--primary)' : 'none',
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
                      🎲 Theo từng kỳ quay
                    </button>
                  </div>
                </div>
              )}

              {/* Controls bar: Draw selector & Navigation (only in 'draw' mode) */}
              {collapseViewMode === 'draw' ? (
                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  {/* Draw Navigator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={handlePrevDraw}
                      disabled={!hasPrev}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: hasPrev ? '#fff' : 'var(--text-dimmed)',
                        cursor: hasPrev ? 'pointer' : 'not-allowed',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Kỳ trước đó (cũ hơn)"
                    >
                      ◀ Kỳ trước
                    </button>

                    <select
                      value={currentDraw.drawId}
                      onChange={(e) => setSelectedDrawId(parseInt(e.target.value, 10))}
                      style={{
                        background: 'rgba(10, 15, 29, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      {sortedDraws.map((d) => (
                        <option key={d.drawId} value={d.drawId}>
                          #{d.drawIdStr} - {d.dateStr}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleNextDraw}
                      disabled={!hasNext}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: hasNext ? '#fff' : 'var(--text-dimmed)',
                        cursor: hasNext ? 'pointer' : 'not-allowed',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Kỳ sau đó (mới hơn)"
                    >
                      Kỳ sau ▶
                    </button>
                  </div>

                  {/* Winning balls preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kết quả:</span>
                    <div className="balls-container" style={{ margin: 0 }}>
                      {currentDraw.numbers.slice(0, mainLength).map((n, i) => (
                        <div key={i} className="ball-wrapper" style={{ width: '28px' }}>
                          <span className="ball" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>{n}</span>
                        </div>
                      ))}
                      {game === '655' && currentDraw.numbers[6] && (
                        <>
                          <span style={{ color: 'var(--border-color)', alignSelf: 'center', fontSize: '1.1rem' }}>|</span>
                          <div className="ball-wrapper" style={{ width: '28px' }}>
                            <span className="ball power-bonus" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>
                              {currentDraw.numbers[6]}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Coverage Mode banner */
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '14px',
                  background: 'rgba(46, 196, 182, 0.08)',
                  border: '1px solid rgba(46, 196, 182, 0.25)',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: '700' }}>
                      Bao phủ: <strong style={{ color: '#2ec4b6' }}>{fillStats.filledCount}/{fillStats.totalNumbers} số</strong> ({fillStats.fillRate}%)
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      • Chưa lấp: <strong style={{ color: '#ff6b6b' }}>{fillStats.missingCount} số</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: '600' }}>
                    {fillStats.drawCount} kỳ quay ({fillStats.rangeLabel || ''})
                  </div>
                </div>
              )}

              {/* Legend */}
              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '14px',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  flexWrap: 'wrap'
                }}
              >
                {collapseViewMode === 'coverage' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle at 30% 30%, #e63946, #c1121f)',
                          display: 'inline-block',
                          boxShadow: '0 0 6px rgba(230,57,70,0.8)'
                        }}
                      />
                      <span>Đã lấp (Có xuất hiện)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'inline-block'
                        }}
                      />
                      <span>Chưa lấp (Vắng 100%)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#2ec4b6', fontWeight: 'bold' }}>X lần:</span>
                      <span>Số lần về trong khoảng</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#e63946', fontWeight: 'bold' }}>0:</span>
                      <span>Chưa về</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle at 30% 30%, #e63946, #c1121f)',
                          display: 'inline-block',
                          boxShadow: '0 0 6px rgba(230,57,70,0.8)'
                        }}
                      />
                      <span>Số trúng thưởng (Sáng)</span>
                    </div>

                    {game === '655' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span 
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at 30% 30%, #ffd166, #f3a712)',
                            display: 'inline-block',
                            boxShadow: '0 0 6px rgba(255,183,3,0.8)'
                          }}
                        />
                        <span>Số đặc biệt (Bonus)</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span 
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'inline-block'
                        }}
                      />
                      <span>Số không về (Tối)</span>
                    </div>

                    {absenceMap && showAbsenceInMatrix && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#2ec4b6', fontWeight: 'bold' }}>0:</span>
                          <span>Vừa về kỳ này</span>
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
                  </>
                )}
              </div>

              {/* The Matrix Grid: 8 numbers per row, 1-45 or 1-55 */}
              <div 
                style={{
                  background: 'rgba(10, 15, 29, 0.6)',
                  padding: '16px 12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)'
                }}
              >
                {collapseViewMode === 'coverage' && fillStats ? (
                  <NumberMatrixGrid 
                    game={game} 
                    numbers={[]} 
                    compact={false}
                    coverageMode={true}
                    freqMap={fillStats.freqMap}
                    showFrequency={true}
                    absenceMap={absenceMap}
                    showAbsence={false}
                  />
                ) : (
                  <NumberMatrixGrid 
                    game={game} 
                    numbers={currentDraw.numbers} 
                    compact={false}
                    absenceMap={absenceMap}
                    showAbsence={showAbsenceInMatrix}
                  />
                )}
              </div>

              {/* Quick stats footer for this matrix */}
              <div 
                style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'center',
                  marginTop: '12px',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                {collapseViewMode === 'coverage' && fillStats ? (
                  <>
                    <div>Đã lấp: <strong style={{ color: '#2ec4b6' }}>{fillStats.filledCount}/{fillStats.totalNumbers} số</strong></div>
                    <div>Tỷ lệ lấp số: <strong style={{ color: '#2ec4b6' }}>{fillStats.fillRate}%</strong></div>
                    <div>Chưa lấp: <strong style={{ color: '#ff6b6b' }}>{fillStats.missingCount} số</strong></div>
                    <div>Phạm vi: <strong style={{ color: '#fff' }}>{fillStats.drawCount} kỳ</strong></div>
                    <div>Quy cách: <strong style={{ color: 'var(--accent)' }}>8 số/dòng</strong></div>
                  </>
                ) : (
                  <>
                    <div>Tổng: <strong style={{ color: '#fff' }}>{sum}</strong></div>
                    <div>Chẵn/Lẻ: <strong style={{ color: '#fff' }}>{evenCount}C - {oddCount}L</strong></div>
                    <div>Thấp/Cao: <strong style={{ color: '#fff' }}>{lowCount}T - {highCount}C</strong></div>
                    <div>Quy cách: <strong style={{ color: 'var(--accent)' }}>8 số/dòng</strong></div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ResultsMatrixCollapse;
