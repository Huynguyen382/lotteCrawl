import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

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
    // Clear previously generated tickets when game changes
    setGeneratedTickets([]);
  }, [game, setGeneratedTickets]);

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
      reasons.push(`Tổng điểm vàng (${sum})`);
    } else if (sum < mean - 30 || sum > mean + 30) {
      score -= 2;
    }

    // 2. Consecutive Rule
    let consecutiveCount = 0;
    for (let i = 0; i < ticketNums.length - 1; i++) {
      if (ticketNums[i + 1] - ticketNums[i] === 1) consecutiveCount++;
    }
    if (consecutiveCount === 1) {
      score += 2;
      reasons.push('Có cặp số liền kề');
    } else if (consecutiveCount === 2) {
      score += 1;
    } else if (consecutiveCount >= 3) {
      score -= 3; // Quá nhiều số liền kề thường rất hiếm
    }

    // 3. Association Rule (Pairs)
    let foundPair = false;
    const top10Pairs = config.topPairs.slice(0, 10);
    for (let i = 0; i < ticketNums.length; i++) {
      for (let j = i + 1; j < ticketNums.length; j++) {
        const p1 = `${ticketNums[i]}-${ticketNums[j]}`;
        if (top10Pairs.includes(p1)) {
          score += 2;
          foundPair = true;
          reasons.push(`Có cặp tỷ lệ cao [${ticketNums[i]}, ${ticketNums[j]}]`);
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
      // Một số lạnh chín mùi sắp nổ
      score += 1;
      reasons.push('Đón lỏng số lạnh');
    }

    // 5. Odd/Even ratio
    const oddCount = ticketNums.filter(n => n % 2 !== 0).length;
    const isBalanced = (mainLength === 6 && oddCount >= 2 && oddCount <= 4) || (mainLength === 5 && oddCount >= 2 && oddCount <= 3);
    if (isBalanced) {
      score += 1;
    } else {
      score -= 2; // Bất cân bằng quá cao (Toàn chẵn / Toàn lẻ)
    }

    return { score, reasons };
  };

  const handleGenerateV2 = () => {
    if (!statsConfig) return;
    setIsGenerating(true);

    // Simulate thinking delay so UI can show loader
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
          
          // Generate special number if applicable
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

          finalTickets.push({
            id: finalTickets.length + 1,
            numbers: candidates[i].nums.map(n => String(n).padStart(2, '0')),
            specialNumber: specialStr,
            score: candidates[i].score,
            reasons: [...new Set(candidates[i].reasons)] // Remove duplicate reasons
          });
        }
      }

      setGeneratedTickets(finalTickets);
      setIsGenerating(false);
    }, 100);
  };

  return (
    <div className="prediction-panel v2-panel fade-in">
      <div className="section-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>🧠</span>
          Mô hình AI V2 (Scoring Heuristic)
        </h3>
        <span className="badge badge-pulse" style={{ background: 'var(--success, #2a9d8f)', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem' }}>Học Máy Lịch Sử</span>
      </div>

      <div className="control-group" style={{ background: 'var(--bg-light, #f8f9fa)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 15px 0', fontSize: '0.9rem', color: 'var(--text-muted, #6c757d)' }}>
          Thuật toán V2 đánh giá <strong>10,000</strong> vé ngẫu nhiên theo Luật Trung Bình Tổng, Chu Kỳ Điểm Rơi, và Xác Suất Cặp Số Liên Kết từ toàn bộ kho dữ liệu thực tế.
        </p>

        {error && <div style={{ color: 'red', fontSize: '0.85rem', marginBottom: '10px' }}>{error}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center' }}>
          <div className="input-field">
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Số vé cần xuất (Top N):</label>
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={ticketCount}
              onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ padding: '8px', width: '100px', borderRadius: '4px', border: '1px solid #ced4da' }}
            />
          </div>

          <button 
            className="action-btn primary"
            onClick={handleGenerateV2}
            disabled={isGenerating || isLoadingStats || !statsConfig}
            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isGenerating ? (
              <><div className="spinner small"></div> Đang chấm điểm 10,000 vé...</>
            ) : isLoadingStats ? (
              <><div className="spinner small"></div> Đang tải mô hình...</>
            ) : (
              <><span style={{ fontSize: '1.2rem' }}>⚡</span> Bắt đầu Huấn luyện & Sinh Vé</>
            )}
          </button>
        </div>
        
        {statsConfig && (
          <div style={{ marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-muted, #6c757d)', display: 'flex', gap: '15px' }}>
            <span><strong>Dữ liệu:</strong> {statsConfig.totalDraws} kỳ quay</span>
            <span><strong>Điểm rơi tổng:</strong> {statsConfig.sums.mean}</span>
          </div>
        )}
      </div>

      {generatedTickets.length > 0 && (
        <div className="generated-results slide-up">
          <h4 style={{ marginBottom: '15px' }}>Top {ticketCount} Vé Tối Ưu Nhất (Điểm Cao Nhất)</h4>
          <div className="ticket-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {generatedTickets.map((ticket) => (
              <div key={ticket.id} className="ticket-item" style={{ 
                background: '#fff', 
                border: '1px solid #e9ecef', 
                borderRadius: '8px', 
                padding: '15px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="ticket-id" style={{ fontWeight: 'bold', color: 'var(--text-muted, #6c757d)' }}>
                    Vé #{ticket.id}
                  </div>
                  <div className="ticket-score" style={{ 
                    background: 'var(--warning, #ffca3a)', 
                    color: '#333', 
                    padding: '3px 10px', 
                    borderRadius: '12px', 
                    fontSize: '0.85rem',
                    fontWeight: 'bold'
                  }}>
                    Điểm AI: {ticket.score}/9
                  </div>
                </div>

                <div className="ticket-numbers" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ticket.numbers.map((num, idx) => (
                    <span key={idx} className="ball main-ball" style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', 
                      background: 'var(--accent, #e63946)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '1rem',
                      boxShadow: '0 2px 5px rgba(230, 57, 70, 0.3)'
                    }}>
                      {num}
                    </span>
                  ))}
                  {ticket.specialNumber && (
                    <span className="ball special-ball" style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', 
                      background: 'var(--warning, #ffca3a)', color: '#333',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '1rem',
                      boxShadow: '0 2px 5px rgba(255, 202, 58, 0.3)',
                      marginLeft: '10px'
                    }}>
                      {ticket.specialNumber}
                    </span>
                  )}
                </div>

                {ticket.reasons && ticket.reasons.length > 0 && (
                  <div className="ticket-reasons" style={{ fontSize: '0.8rem', color: '#1d3557', marginTop: '5px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {ticket.reasons.map((r, i) => (
                      <span key={i} style={{ background: '#e9ecef', padding: '2px 8px', borderRadius: '4px' }}>✓ {r}</span>
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
