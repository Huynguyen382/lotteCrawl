import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';
import './PredictionV2Panel.css'; // Sẽ tạo file CSS riêng để tách biệt style

function PredictionV2Panel({ 
  game, 
  generatedTickets, 
  setGeneratedTickets, 
  ticketCount, 
  setTicketCount 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [statsConfig, setStatsConfig] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [error, setError] = useState('');
  const [searchTicketQuery, setSearchTicketQuery] = useState('');
  const [generateProgress, setGenerateProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
  const mainLength = game === '535' ? 5 : 6;

  // Reset page number on filter/game/results change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTicketQuery, generatedTickets.length, game]);

  // Filter generated tickets based on query
  const filteredTickets = generatedTickets.filter((ticket) => {
    if (!searchTicketQuery.trim()) return true;
    const parts = searchTicketQuery.toLowerCase().split(/[\s,.-]+/).filter(Boolean);
    return parts.every((part) => {
      const partInt = parseInt(part, 10);
      if (!isNaN(partInt)) {
        const inMain = ticket.numbers.some(n => parseInt(n, 10) === partInt);
        const inSpecial = ticket.specialNumber ? parseInt(ticket.specialNumber, 10) === partInt : false;
        return inMain || inSpecial;
      }
      return false;
    });
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Fetch AI V2 stats configuration from Backend
  useEffect(() => {
    async function fetchStats() {
      setIsLoadingStats(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE}/api/stats/v2/${game}`);
        const data = await response.json();
        if (data.success && data.data) {
          setStatsConfig(data.data);
        } else {
          setError('Không thể lấy dữ liệu thống kê từ server.');
        }
      } catch (err) {
        setError('Lỗi kết nối server khi tải dữ liệu cấu hình AI V2.');
      } finally {
        setIsLoadingStats(false);
      }
    }
    fetchStats();
  }, [game]);

  const generateRandomTicket = () => {
    const nums = new Set();
    while (nums.size < mainLength) {
      const r = Math.floor(Math.random() * maxNum) + 1;
      nums.add(r);
    }
    const sorted = Array.from(nums).sort((a, b) => a - b);
    return sorted;
  };

  const scoreTicket = (ticketNums, config) => {
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
    let foundPair = false;
    const top15Pairs = config.topPairs.slice(0, 15);
    for (let i = 0; i < ticketNums.length; i++) {
      for (let j = i + 1; j < ticketNums.length; j++) {
        const p1 = `${ticketNums[i]}-${ticketNums[j]}`;
        if (top15Pairs.includes(p1)) {
          score += 2;
          foundPair = true;
          reasons.push({ type: 'primary', text: `Cặp tỷ lệ cao [${ticketNums[i]}, ${ticketNums[j]}]` });
        }
      }
    }

    // 4. Hot/Cold frequencies
    let hotCount = 0;
    let coldCount = 0;
    ticketNums.forEach(n => {
      if (config.hot.slice(0, 8).includes(n)) hotCount++;
      if (config.cold.slice(0, 5).includes(n)) coldCount++;
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
    const isBalanced = (mainLength === 6 && oddCount >= 2 && oddCount <= 4) || (mainLength === 5 && oddCount >= 2 && oddCount <= 3);
    if (isBalanced) {
      score += 1;
    } else {
      score -= 2;
    }

    // 6. Low/High Balance Rule (Quy luật Cao/Thấp thực tế)
    const midPoint = game === '645' ? 23 : (game === '655' ? 28 : 18);
    const lowCount = ticketNums.filter(n => n < midPoint).length;
    const highCount = ticketNums.length - lowCount;
    const isLowHighBalanced = (mainLength === 6 && lowCount >= 2 && lowCount <= 4) || (mainLength === 5 && lowCount >= 2 && lowCount <= 3);
    if (isLowHighBalanced) {
      score += 1;
    } else if (lowCount === 0 || highCount === 0) {
      score -= 2;
    }

    // 7. Prime Number Rule (Quy luật Số Nguyên Tố)
    const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53]);
    const primeCount = ticketNums.filter(n => primes.has(n)).length;
    if (primeCount >= 1 && primeCount <= 3) {
      score += 1;
    } else if (primeCount === 0) {
      score -= 1;
    }

    // 8. Tail Digit Repetition Rule (Quy luật Đuôi số đối xứng)
    const tails = ticketNums.map(n => n % 10);
    const tailCounts = {};
    tails.forEach(t => { tailCounts[t] = (tailCounts[t] || 0) + 1; });
    const maxTailRep = Math.max(...Object.values(tailCounts));
    if (maxTailRep === 2) {
      score += 1;
      reasons.push({ type: 'success', text: 'Nhịp đuôi đối xứng' });
    } else if (maxTailRep >= 4) {
      score -= 3;
    }

    // 9. Spread Spread Range Check (Khoảng giãn cách bộ số)
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

  const handleGenerateV2 = () => {
    if (!statsConfig) return;
    setIsGenerating(true);
    setGenerateProgress(0);
    setGeneratedTickets([]);

    const numCandidates = Math.max(10000, Math.floor(ticketCount * 1.15));
    const candidates = [];
    const CHUNK_SIZE = 10000;

    const generateChunk = () => {
      const target = Math.min(numCandidates, candidates.length + CHUNK_SIZE);
      
      while (candidates.length < target) {
        const nums = generateRandomTicket();
        const { score, reasons } = scoreTicket(nums, statsConfig);
        candidates.push({ nums, score, reasons });
      }

      setGenerateProgress(candidates.length);

      if (candidates.length < numCandidates) {
        setTimeout(generateChunk, 0);
      } else {
        // Sort descending by score
        candidates.sort((a, b) => b.score - a.score);

        // Select top unique ones
        const finalTickets = [];
        const seenSignatures = new Set();
        
        for (let i = 0; i < candidates.length && finalTickets.length < ticketCount; i++) {
          const sig = candidates[i].nums.join('-');
          if (!seenSignatures.has(sig)) {
            seenSignatures.add(sig);
            
            let specialStr = null;
            if (game === '655') {
              let r = Math.floor(Math.random() * 55) + 1;
              while (candidates[i].nums.includes(r)) r = Math.floor(Math.random() * 55) + 1;
              specialStr = String(r).padStart(2, '0');
            } else if (game === '535') {
              // Lotto 5/35 số đặc biệt từ 01-12 (EuroMillions/Lucky Star style)
              let r = Math.floor(Math.random() * 12) + 1;
              specialStr = String(r).padStart(2, '0');
            }

            // Filter unique reasons
            const uniqueReasons = [];
            const seenReasonTexts = new Set();
            candidates[i].reasons.forEach(r => {
              if (!seenReasonTexts.has(r.text)) {
                seenReasonTexts.add(r.text);
                uniqueReasons.push(r);
              }
            });

            finalTickets.push({
              id: finalTickets.length + 1,
              numbers: candidates[i].nums.map(n => String(n).padStart(2, '0')),
              specialNumber: specialStr,
              score: candidates[i].score,
              reasons: uniqueReasons
            });
          }
        }

        setGeneratedTickets(finalTickets);
        setSearchTicketQuery(''); // Reset search query on new generation
        setIsGenerating(false);
      }
    };

    setTimeout(generateChunk, 0);
  };

  return (
    <div className="v2-container slide-up">
      <div className="v2-header">
        <div className="v2-title-wrapper">
          <div className="v2-icon-box">🧠</div>
          <div>
            <h3>Mô Hình AI V2 (Heuristic Scoring)</h3>
            <p>Học máy dựa trên thống kê xác suất toàn diện</p>
          </div>
        </div>
        <div className="v2-badge-glow">Premium Mode</div>
      </div>

      <div className="glass-panel v2-control-panel">
        <p className="v2-description">
          Thuật toán V2 quét và đánh giá <strong>{Math.max(10000, Math.floor(ticketCount * 1.15)).toLocaleString()} vé ngẫu nhiên</strong> theo các quy luật thực tế: Điểm rơi Toán Học, Tần suất Chẵn/Lẻ, và Ma trận Liên kết. 
        </p>

        {error && <div className="v2-error-banner"><i className="fas fa-exclamation-triangle"></i> {error}</div>}

        <div className="v2-actions">
          <div className="v2-input-group">
            <label>Số vé xuất ra (Top N)</label>
            <div className="v2-input-wrapper">
              <input 
                type="number" 
                min="1" max="1000000" 
                value={ticketCount}
                onChange={(e) => setTicketCount(Math.max(1, Math.min(1000000, parseInt(e.target.value) || 1)))}
              />
              <span className="v2-input-suffix">Vé</span>
            </div>
          </div>

          <button 
            className={`v2-btn-generate ${isGenerating ? 'generating' : ''}`}
            onClick={handleGenerateV2}
            disabled={isGenerating || isLoadingStats || !statsConfig}
          >
            {isGenerating ? (
              <><span className="v2-spinner"></span> Đang chấm điểm {generateProgress.toLocaleString()} / {Math.max(10000, Math.floor(ticketCount * 1.15)).toLocaleString()} ứng viên...</>
            ) : isLoadingStats ? (
              <><span className="v2-spinner"></span> Đang nạp {game} model...</>
            ) : (
              <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Huấn Luyện & Sinh Vé</>
            )}
            <div className="v2-btn-glow"></div>
          </button>
        </div>
        
        {statsConfig && (
          <div className="v2-stats-summary">
            <div className="v2-stat-chip">
              <span className="v2-stat-label">Kho Dữ Liệu</span>
              <span className="v2-stat-value">{statsConfig.totalDraws} kỳ quay</span>
            </div>
            <div className="v2-stat-chip">
              <span className="v2-stat-label">Tổng Trung Bình</span>
              <span className="v2-stat-value">{statsConfig.sums.mean}</span>
            </div>
            <div className="v2-stat-chip">
              <span className="v2-stat-label">Cặp Nóng Nhất</span>
              <span className="v2-stat-value">{statsConfig.topPairs[0]}</span>
            </div>
          </div>
        )}
      </div>

      {generatedTickets.length > 0 && (
        <div className="v2-results-area">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h4 className="v2-results-title" style={{ margin: 0 }}>Top {ticketCount.toLocaleString()} Vé Tối Ưu Nhất (Điểm Sinh Tồn Trực Tiếp)</h4>
            
            {/* Search Filter Box */}
            <div className="input-group" style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                placeholder="Tìm vé chứa số (ví dụ: 05, 12)..."
                className="input-field"
                value={searchTicketQuery}
                onChange={(e) => setSearchTicketQuery(e.target.value)}
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
              {searchTicketQuery && (
                <button 
                  onClick={() => setSearchTicketQuery('')}
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
          </div>

          {searchTicketQuery && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Tìm thấy <strong>{filteredTickets.length.toLocaleString()}</strong> / {generatedTickets.length.toLocaleString()} vé chứa số mong muốn.
            </div>
          )}

          <div className="v2-ticket-grid">
            {paginatedTickets.map((ticket, index) => (
              <div key={ticket.id} className="glass-panel v2-ticket-card" style={{animationDelay: `${(index % pageSize) * 0.02}s`}}>
                <div className="v2-ticket-header">
                  <div className="v2-ticket-id">Phương án #{ticket.id}</div>
                  <div className={`v2-score-badge ${ticket.score >= 10 ? 'super-high' : ticket.score >= 8 ? 'high' : 'medium'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    Điểm AI: {ticket.score}/13
                  </div>
                </div>

                <div className="v2-ticket-balls">
                  {ticket.numbers.map((num, idx) => (
                    <div key={idx} className="v2-ball main">
                      {num}
                    </div>
                  ))}
                  {ticket.specialNumber && (
                    <div className="v2-ball special">
                      {ticket.specialNumber}
                    </div>
                  )}
                </div>

                {ticket.reasons && ticket.reasons.length > 0 && (
                  <div className="v2-ticket-reasons">
                    {ticket.reasons.map((r, i) => (
                      <span key={i} className={`v2-reason-pill ${r.type}`}>
                        {r.type === 'success' && '✓ '}
                        {r.type === 'accent' && '✦ '}
                        {r.type === 'primary' && '🔥 '}
                        {r.type === 'warning' && '❄ '}
                        {r.type === 'neutral' && '• '}
                        {r.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {filteredTickets.length > pageSize && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setCurrentPage(1);
                  }}
                  className="select-field"
                  style={{ width: '80px', height: '32px', padding: '0 8px', margin: 0, fontSize: '0.85rem' }}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
                <span>vé / trang</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', height: '32px', minWidth: '36px', fontSize: '0.85rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  &lt;&lt;
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', height: '32px', minWidth: '36px', fontSize: '0.85rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  &lt;
                </button>
                
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 8px' }}>
                  Trang <strong>{currentPage}</strong> / {totalPages}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', height: '32px', minWidth: '36px', fontSize: '0.85rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  &gt;
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', height: '32px', minWidth: '36px', fontSize: '0.85rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  &gt;&gt;
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Đến trang:</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = Math.max(1, Math.min(totalPages, parseInt(e.target.value, 10) || 1));
                    setCurrentPage(page);
                  }}
                  className="input-field"
                  style={{ width: '70px', height: '32px', textAlign: 'center', fontSize: '0.85rem', padding: '0 4px', margin: 0 }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PredictionV2Panel;
