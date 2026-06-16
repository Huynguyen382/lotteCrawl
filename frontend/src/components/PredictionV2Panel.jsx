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

  const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
  const mainLength = game === '535' ? 5 : 6;

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
    const top10Pairs = config.topPairs.slice(0, 15);
    for (let i = 0; i < ticketNums.length; i++) {
      for (let j = i + 1; j < ticketNums.length; j++) {
        const p1 = `${ticketNums[i]}-${ticketNums[j]}`;
        if (top10Pairs.includes(p1)) {
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

    return { score, reasons };
  };

  const handleGenerateV2 = () => {
    if (!statsConfig) return;
    setIsGenerating(true);

    setTimeout(() => {
      const NUM_CANDIDATES = 10000;
      const candidates = [];

      for (let i = 0; i < NUM_CANDIDATES; i++) {
        const nums = generateRandomTicket();
        const { score, reasons } = scoreTicket(nums, statsConfig);
        candidates.push({ nums, score, reasons });
      }

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
            let r = Math.floor(Math.random() * 35) + 1;
            while (candidates[i].nums.includes(r)) r = Math.floor(Math.random() * 35) + 1;
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
      setIsGenerating(false);
    }, 150); // slight delay for animation
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
          Thuật toán V2 quét và đánh giá <strong>10,000 vé ngẫu nhiên</strong> theo các quy luật thực tế: Điểm rơi Toán Học, Tần suất Chẵn/Lẻ, và Ma trận Liên kết. 
        </p>

        {error && <div className="v2-error-banner"><i className="fas fa-exclamation-triangle"></i> {error}</div>}

        <div className="v2-actions">
          <div className="v2-input-group">
            <label>Số vé xuất ra (Top N)</label>
            <div className="v2-input-wrapper">
              <input 
                type="number" 
                min="1" max="100" 
                value={ticketCount}
                onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
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
              <><span className="v2-spinner"></span> Đang chấm điểm 10,000 vé...</>
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
          <h4 className="v2-results-title">Top {ticketCount} Vé Tối Ưu Nhất (Điểm Sinh Tồn Trực Tiếp)</h4>
          <div className="v2-ticket-grid">
            {generatedTickets.map((ticket, index) => (
              <div key={ticket.id} className="glass-panel v2-ticket-card" style={{animationDelay: `${index * 0.05}s`}}>
                <div className="v2-ticket-header">
                  <div className="v2-ticket-id">Phương án #{ticket.id}</div>
                  <div className={`v2-score-badge ${ticket.score >= 7 ? 'super-high' : ticket.score >= 5 ? 'high' : 'medium'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    Điểm AI: {ticket.score}/9
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
        </div>
      )}
    </div>
  );
}

export default PredictionV2Panel;
