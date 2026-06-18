import React, { useState, useEffect, useMemo } from 'react';

function PredictionPanel({ 
  game, 
  visibleResults, 
  generatedTickets, 
  setGeneratedTickets, 
  strategy, 
  setStrategy, 
  ticketCount, 
  setTicketCount 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [searchTicketQuery, setSearchTicketQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [generateProgress, setGenerateProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Debounce search query to avoid heavy filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchTicketQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTicketQuery]);

  const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);
  const mainLength = game === '535' ? 5 : 6;

  // Reset page number on filter/game/results change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, generatedTickets.length, game]);

  // Compute Hot and Cold numbers from visible results
  const getFrequencyStats = () => {
    if (visibleResults.length === 0) return { hot: [], cold: [] };

    const counts = {};
    for (let i = 1; i <= maxNum; i++) counts[i] = 0;

    // Count frequency in main numbers of visible results
    visibleResults.forEach(draw => {
      const mainNums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10));
      mainNums.forEach(num => {
        if (counts[num] !== undefined) counts[num]++;
      });
    });

    const frequencyList = Object.keys(counts).map(num => ({
      number: String(num).padStart(2, '0'),
      count: counts[num]
    }));

    // Sort by count descending for hot, ascending for cold
    const hotSorted = [...frequencyList].sort((a, b) => b.count - a.count);
    
    // For cold numbers, we check skip/absence interval (skip counts)
    const reversedResults = [...visibleResults].sort((a, b) => b.drawId - a.drawId);
    const absences = [];
    for (let i = 1; i <= maxNum; i++) {
      const idx = reversedResults.findIndex(draw => {
        const mainNums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10));
        return mainNums.includes(i);
      });
      absences.push({
        number: String(i).padStart(2, '0'),
        absentDraws: idx !== -1 ? idx : visibleResults.length
      });
    }
    const coldSorted = [...absences].sort((a, b) => b.absentDraws - a.absentDraws);

    return {
      hot: hotSorted.slice(0, 12).map(item => item.number),
      cold: coldSorted.slice(0, 12).map(item => item.number)
    };
  };

  const { hot, cold } = getFrequencyStats();

  // Generate AI Analysis Report on game or results change
  useEffect(() => {
    if (visibleResults.length === 0) {
      setAiReport(null);
      return;
    }

    const { hot: hotNums, cold: coldNums } = getFrequencyStats();
    
    // Calculations for simulated AI comments
    const last10 = [...visibleResults].sort((a, b) => b.drawId - a.drawId).slice(0, 10);
    const sums = last10.map(draw => {
      const nums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10));
      return nums.reduce((s, n) => s + n, 0);
    });
    const avgSum = Math.round(sums.reduce((s, n) => s + n, 0) / Math.max(1, sums.length));

    // Calculate Odd/Even ratio in last 10 draws
    let oddCount = 0;
    let totalCount = 0;
    last10.forEach(draw => {
      const nums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10));
      nums.forEach(n => {
        if (n % 2 !== 0) oddCount++;
        totalCount++;
      });
    });
    const oddPercent = Math.round((oddCount / Math.max(1, totalCount)) * 100);

    setAiReport({
      avgSum,
      oddPercent,
      topHot: hotNums.slice(0, 5),
      topCold: coldNums.slice(0, 5)
    });
    setSearchTicketQuery('');
  }, [game, visibleResults]);

  // Handle generation of smart tickets (Async Chunked Generation to prevent UI locking)
  const handleGenerate = () => {
    if (visibleResults.length === 0) return;
    setIsGenerating(true);
    setGenerateProgress(0);
    setGeneratedTickets([]);
    
    const tickets = [];
    const { hot: hotList, cold: coldList } = getFrequencyStats();

    // Setup parameters based on game type
    const midPoint = Math.floor(maxNum / 2);
    let minSum = 115, maxSum = 165; // Mega 6/45 default
    if (game === '655') {
      minSum = 135;
      maxSum = 200;
    } else if (game === '535') {
      minSum = 65;
      maxSum = 115;
    }

    const CHUNK_SIZE = 5000;
    let currentCount = 0;

    const generateChunk = () => {
      const target = Math.min(ticketCount, currentCount + CHUNK_SIZE);
      
      for (let t = currentCount; t < target; t++) {
        let ticketNums = [];
        let attempts = 0;

        while (ticketNums.length < mainLength && attempts < 500) {
          attempts++;
          let pool = [];

          if (strategy === 'balanced') {
            pool = Array.from({ length: maxNum }, (_, idx) => String(idx + 1).padStart(2, '0'));
          } else if (strategy === 'hot') {
            if (Math.random() < 0.6) {
              pool = hotList;
            } else {
              pool = Array.from({ length: maxNum }, (_, idx) => String(idx + 1).padStart(2, '0')).filter(n => !hotList.includes(n));
            }
          } else if (strategy === 'cold') {
            if (Math.random() < 0.6) {
              pool = coldList;
            } else {
              pool = Array.from({ length: maxNum }, (_, idx) => String(idx + 1).padStart(2, '0')).filter(n => !coldList.includes(n));
            }
          } else {
            pool = Array.from({ length: maxNum }, (_, idx) => String(idx + 1).padStart(2, '0'));
          }

          const randomNum = pool[Math.floor(Math.random() * pool.length)];
          if (randomNum && !ticketNums.includes(randomNum)) {
            ticketNums.push(randomNum);
          }

          if (ticketNums.length === mainLength) {
            const numVals = ticketNums.map(n => parseInt(n, 10));
            const sum = numVals.reduce((s, n) => s + n, 0);

            if (sum < minSum || sum > maxSum) {
              ticketNums = [];
              continue;
            }

            const odds = numVals.filter(n => n % 2 !== 0).length;
            if (mainLength === 6 && (odds < 2 || odds > 4)) {
              ticketNums = [];
              continue;
            }
            if (mainLength === 5 && (odds < 2 || odds > 3)) {
              ticketNums = [];
              continue;
            }

            const highs = numVals.filter(n => n > midPoint).length;
            if (mainLength === 6 && (highs < 2 || highs > 4)) {
              ticketNums = [];
              continue;
            }
            if (mainLength === 5 && (highs < 2 || highs > 3)) {
              ticketNums = [];
              continue;
            }
          }
        }

        if (ticketNums.length < mainLength) {
          ticketNums = [];
          while (ticketNums.length < mainLength) {
            const r = String(Math.floor(Math.random() * maxNum) + 1).padStart(2, '0');
            if (!ticketNums.includes(r)) ticketNums.push(r);
          }
        }

        ticketNums.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

        let specialNum = null;
        if (game === '655') {
          let r = Math.floor(Math.random() * 55) + 1;
          while (ticketNums.includes(String(r).padStart(2, '0'))) {
            r = Math.floor(Math.random() * 55) + 1;
          }
          specialNum = String(r).padStart(2, '0');
        } else if (game === '535') {
          specialNum = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        }

        tickets.push({
          id: t + 1,
          numbers: ticketNums,
          numValues: ticketNums.map(n => parseInt(n, 10)),
          special: specialNum,
          specialValue: specialNum ? parseInt(specialNum, 10) : null
        });
      }

      currentCount = target;
      setGenerateProgress(currentCount);

      if (currentCount < ticketCount) {
        setTimeout(generateChunk, 0);
      } else {
        setGeneratedTickets(tickets);
        setSearchTicketQuery(''); // Reset search query on new generation
        setIsGenerating(false);
      }
    };

    setTimeout(generateChunk, 0);
  };

  // Filter generated tickets based on query (Optimized with useMemo, debouncedQuery, and integer comparisons)
  const filteredTickets = useMemo(() => {
    if (!debouncedQuery.trim()) return generatedTickets;
    const parts = debouncedQuery.toLowerCase().split(/[\s,.-]+/).filter(Boolean);
    const partNums = parts.map(p => parseInt(p, 10)).filter(n => !isNaN(n));
    if (partNums.length === 0) return generatedTickets;

    return generatedTickets.filter((ticket) => {
      return partNums.every((partInt) => {
        const inMain = ticket.numValues ? ticket.numValues.includes(partInt) : ticket.numbers.some(n => parseInt(n, 10) === partInt);
        const inSpecial = ticket.specialValue !== undefined && ticket.specialValue !== null
          ? ticket.specialValue === partInt 
          : (ticket.special ? parseInt(ticket.special, 10) === partInt : false);
        return inMain || inSpecial;
      });
    });
  }, [generatedTickets, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (visibleResults.length === 0) {
    return (
      <div className="empty-state">
        <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <h3>Chưa có dữ liệu phân tích</h3>
        <p>Vui lòng cào dữ liệu trước để AI có cơ sở phân tích tần suất và gợi ý bộ số.</p>
      </div>
    );
  }

  return (
    <div className="stats-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* AI Analysis Summary Card */}
      {aiReport && (
        <div className="glass-panel" style={{ 
          background: 'linear-gradient(135deg, rgba(108, 92, 231, 0.1) 0%, rgba(230, 57, 70, 0.05) 100%)',
          border: '1px solid rgba(108, 92, 231, 0.25)',
          padding: '20px',
          borderRadius: '16px',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', margin: '0 0 12px 0', fontSize: '1.1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
            </svg>
            Báo cáo phân tích kỹ thuật AI (Simulated AI)
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '0.85rem', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tổng trung bình (10 kỳ gần đây):</span>
              <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{aiReport.avgSum}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dimmed, #8d99ae)' }}>
                {game === '645' ? 'Vùng tối ưu: 115 - 165' : (game === '655' ? 'Vùng tối ưu: 135 - 200' : 'Vùng tối ưu: 65 - 115')}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tỷ lệ số Lẻ xuất hiện:</span>
              <strong style={{ fontSize: '1.2rem', color: '#f4a261' }}>{aiReport.oddPercent}%</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dimmed, #8d99ae)' }}>Lý tưởng: 40% - 60% (Cân bằng)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>AI nhận diện Lô Gan lâu chưa về:</span>
              <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                {aiReport.topCold.map(n => (
                  <span key={n} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{n}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            background: 'rgba(0,0,0,0.2)', 
            borderLeft: '4px solid var(--accent)', 
            borderRadius: '0 8px 8px 0',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            lineHeight: '1.4'
          }}>
            <strong>💡 Khuyến nghị chiến thuật AI:</strong> Kỳ tiếp theo dự kiến có xu hướng hội tụ tổng về vùng cân bằng. 
            Để tăng hiệu quả và cơ hội trúng giải phụ, AI khuyên bạn nên sử dụng chiến thuật <strong>Cân bằng AI</strong> (Lớn/Nhỏ và Chẵn/Lẻ đều nhau) 
            và lồng ghép ít nhất 1 số lạnh (lô gan vắng mặt hơn 15 kỳ) vào tổ hợp.
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '6px', fontStyle: 'italic' }}>
              ⚠️ Tuyên bố miễn trừ trách nhiệm: Xổ số là hoàn toàn ngẫu nhiên. Các phân tích và gợi ý của AI chỉ mang tính chất thống kê, tối ưu hóa phân phối toán học và giải trí, không đảm bảo trúng thưởng 100%.
            </div>
          </div>
        </div>
      )}

      {/* Generator Control Card */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Bộ lọc & Gợi ý vé số thông minh
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Số lượng vé gợi ý (Từ 1 - 1,000,000)</label>
            <input 
              type="number"
              min="1"
              max="1000000"
              className="input-field"
              value={ticketCount}
              onChange={(e) => {
                const val = Math.max(1, Math.min(1000000, parseInt(e.target.value, 10) || 1));
                setTicketCount(val);
              }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label>Chiến thuật AI gợi ý</label>
            <select 
              className="select-field"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="balanced">Cân bằng AI (Chẵn/Lẻ, Lớn/Nhỏ)</option>
              <option value="hot">Ưu tiên Số Nóng (Tần suất về cao)</option>
              <option value="cold">Nuôi Lô Gan (Số lâu chưa về)</option>
              <option value="random">Ngẫu nhiên thuần túy</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`btn btn-primary ${isGenerating ? 'btn-disabled' : ''}`}
          style={{ width: '100%', background: 'linear-gradient(90deg, var(--accent) 0%, #6c5ce7 100%)', border: 'none' }}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              AI đang sinh bộ số... {generateProgress > 0 && `(${Math.min(100, Math.round((generateProgress / ticketCount) * 100))}% - ${generateProgress.toLocaleString()} vé)`}
            </>
          ) : 'Tạo bộ số gợi ý bằng AI'}
        </button>
      </div>

      {/* Generated Tickets Result */}
      {generatedTickets.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              Danh sách vé số gợi ý ({strategy === 'balanced' ? 'Cân bằng AI' : (strategy === 'hot' ? 'Số Nóng' : (strategy === 'cold' ? 'Lô Gan' : 'Ngẫu nhiên'))}):
            </h4>
            
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
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Tìm thấy <strong>{filteredTickets.length.toLocaleString()}</strong> / {generatedTickets.length.toLocaleString()} vé chứa số mong muốn.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {paginatedTickets.map((ticket) => {
              return (
                <div key={ticket.id} className="glass-panel" style={{ 
                  background: 'rgba(255,255,255,0.01)', 
                  padding: '12px 16px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vé #{ticket.id}</span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="balls-container" style={{ margin: 0 }}>
                      {ticket.numbers.map((n, i) => (
                        <span key={i} className="ball" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>{n}</span>
                      ))}
                      {ticket.special && (
                        <>
                          <span style={{ color: 'var(--border-color)', fontSize: '1rem' }}>|</span>
                          <span className="ball power-bonus" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>{ticket.special}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tổng: <strong>{ticket.numbers.reduce((s, n) => s + parseInt(n, 10), 0)}</strong> 
                    {ticket.special && ` | ĐB: ${ticket.special}`}
                  </div>
                </div>
              );
            })}

            {filteredTickets.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-dimmed)', fontSize: '0.85rem' }}>
                Không có vé nào chứa bộ số tìm kiếm.
              </div>
            )}
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

export default PredictionPanel;
