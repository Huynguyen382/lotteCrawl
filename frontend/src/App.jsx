import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from './config';

function App() {
  const [game, setGame] = useState('645'); // '645' for Mega, '655' for Power
  const [startDate, setStartDate] = useState(() => {
    // Default to 30 days ago
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    // Default to today
    return new Date().toISOString().split('T')[0];
  });
  const [isScraping, setIsScraping] = useState(false);
  const [progress, setProgress] = useState({
    currentId: 0,
    progress: 0,
    total: 0,
    percent: 0,
    message: ''
  });
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [scrapedRange, setScrapedRange] = useState(null);
  const [latestInfo, setLatestInfo] = useState(null);

  const logContainerRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Load latest draw info on game change
  useEffect(() => {
    fetchLatestInfo();
  }, [game]);

  const fetchLatestInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/latest?game=${game}`);
      if (response.ok) {
        const data = await response.json();
        setLatestInfo(data);
      }
    } catch (error) {
      console.error('Error fetching latest info:', error);
    }
  };

  const handleStartScrape = () => {
    if (isScraping) return;

    // Validation
    if (!startDate || !endDate) {
      alert('Vui lòng chọn khoảng ngày đầy đủ.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert('Ngày bắt đầu không thể sau ngày kết thúc.');
      return;
    }

    // Reset state
    setIsScraping(true);
    setResults([]);
    setScrapedRange(null);
    setProgress({
      currentId: 0,
      progress: 0,
      total: 0,
      percent: 0,
      message: 'Khởi động cào dữ liệu...'
    });
    setLogs([{ text: 'Bắt đầu phiên cào dữ liệu mới...', type: 'system' }]);

    // Close any existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Sử dụng environment variable hoặc fallback
    const url = `${API_BASE}/api/scrape-stream?game=${game}&startDate=${startDate}&endDate=${endDate}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'log':
          setLogs((prev) => [...prev, { text: data.message, type: 'info' }]);
          break;

        case 'start':
          setLogs((prev) => [
            ...prev,
            { text: `Bắt đầu cào ${data.totalDraws} kỳ quay (#${data.startId} đến #${data.endId})`, type: 'system' }
          ]);
          setProgress((prev) => ({
            ...prev,
            total: data.totalDraws,
            message: `Tìm thấy ${data.totalDraws} kỳ quay.`
          }));
          break;

        case 'progress':
          setProgress({
            currentId: data.currentId,
            progress: data.progress,
            total: data.total,
            percent: data.percent,
            message: data.message
          });
          setLogs((prev) => [...prev, { text: data.message, type: 'progress' }]);
          break;

        case 'complete':
          setResults(data.results);
          setScrapedRange({ startId: data.startId, endId: data.endId });
          setIsScraping(false);
          setLogs((prev) => [
            ...prev,
            { text: `Hoàn tất! Cào thành công ${data.totalCrawled} kỳ quay.`, type: 'success' }
          ]);
          setProgress((prev) => ({
            ...prev,
            percent: 100,
            message: 'Cào dữ liệu hoàn tất!'
          }));
          es.close();
          break;

        case 'error':
          setLogs((prev) => [...prev, { text: data.message, type: 'error' }]);
          setIsScraping(false);
          es.close();
          break;

        default:
          break;
      }
    };

    es.onerror = (err) => {
      console.error('SSE connection error:', err);
      setLogs((prev) => [...prev, { text: 'Lỗi kết nối Server-Sent Events.', type: 'error' }]);
      setIsScraping(false);
      es.close();
    };
  };

  const handleDownloadExcel = () => {
    if (!scrapedRange) return;
    const url = `${API_BASE}/api/export?game=${game}&startId=${scrapedRange.startId}&endId=${scrapedRange.endId}`;
    window.location.href = url;
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-title-group">
          <h1>
            <svg className="app-logo" width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#e63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="#e63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="#e63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            SCRAPER
          </h1>
          <p>Hệ thống cào và quản lý dữ liệu lịch sử xổ số điện toán chuyên nghiệp</p>
          {/* Debug: chỉ hiển thị khi VITE_BACKEND_URL chưa được set */}
          {!import.meta.env.VITE_BACKEND_URL && (
            <p style={{ color: 'red', fontSize: '0.75rem', marginTop: '4px' }}>
              ⚠️ VITE_BACKEND_URL chưa được set! API đang trỏ về: {API_BASE}
            </p>
          )}
        </div>
        {latestInfo && (
          <div className="glass-panel" style={{ padding: '10px 18px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Mới nhất ({game === '645' ? 'Mega' : 'Power'}): </span>
            <strong style={{ color: 'var(--accent)' }}>Kỳ #{latestInfo.drawId}</strong> ({latestInfo.dateStr})
          </div>
        )}
      </header>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Control Card */}
        <div className="glass-panel control-card">
          <h2 className="section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 15V17M12 7V13M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Cấu hình cào dữ liệu
          </h2>

          {/* Game Selector */}
          <div className="form-group">
            <label>Loại Vé Vietlott</label>
            <select
              className="select-field"
              value={game}
              onChange={(e) => setGame(e.target.value)}
              disabled={isScraping}
            >
              <option value="645">Mega 6/45 (Thứ 4, 6, Chủ nhật)</option>
              <option value="655">Power 6/55 (Thứ 3, 5, 7)</option>
            </select>
          </div>

          {/* Date Pickers */}
          <div className="form-group">
            <label>Từ Ngày (Ngày Bắt Đầu)</label>
            <input
              type="date"
              className="input-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isScraping}
            />
          </div>

          <div className="form-group">
            <label>Đến Ngày (Ngày Kết Thúc)</label>
            <input
              type="date"
              className="input-field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isScraping}
            />
          </div>

          {/* Action Buttons */}
          <button
            className={`btn btn-primary ${isScraping ? 'btn-disabled' : ''}`}
            onClick={handleStartScrape}
            disabled={isScraping}
          >
            {isScraping ? (
              <>
                <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang cào dữ liệu...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4V9H4.582M20 20V15H19.418M20 20H15M4 4H9M20 4V9H19.418M4 20V15H4.582M19.418 9C18.524 6.052 15.658 4 12 4C8.342 4 5.476 6.052 4.582 9M19.418 9H14M4.582 15C5.476 17.948 8.342 20 12 20C15.658 20 18.524 17.948 19.418 15M4.582 15H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Bắt đầu cào dữ liệu
              </>
            )}
          </button>

          {scrapedRange && !isScraping && (
            <button
              className="btn btn-secondary"
              onClick={handleDownloadExcel}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 10V16M12 16L9 13M12 16L15 13M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L18.7071 8.70711C18.8946 8.89464 19 9.149 19 9.41421V19C19 20.1046 18.1046 21 17 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Tải File Excel (.xlsx)
            </button>
          )}

          {/* Terminal logger inside control area */}
          <div className="terminal-card glass-panel" style={{ background: 'rgba(0,0,0,0.2)', padding: '16px' }}>
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="terminal-dot dot-red"></span>
                <span className="terminal-dot dot-yellow"></span>
                <span className="terminal-dot dot-green"></span>
              </div>
              <span className="terminal-status">Crawl Logs</span>
            </div>
            <div className="terminal-body" ref={logContainerRef} style={{ height: '120px', padding: '8px' }}>
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-dimmed)' }}>Chưa có tiến trình hoạt động...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`log-line ${log.type}`}>
                    &gt; {log.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Results Dashboard */}
        <div className="glass-panel preview-card">
          <div className="preview-header">
            <h2 className="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Bảng xem trước dữ liệu
            </h2>
            {results.length > 0 && (
              <span className="preview-count">
                Đã tải {results.length} kỳ quay
              </span>
            )}
          </div>

          {/* Scrape Progress Bar */}
          {isScraping && (
            <div className="progress-container">
              <div className="progress-info">
                <span>{progress.message}</span>
                <span>{progress.percent}% ({progress.progress}/{progress.total})</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${progress.percent}%` }}></div>
              </div>
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 ? (
            <div className="table-wrapper">
              <table className="preview-table">
                <thead>
                  {game === '645' ? (
                    <tr>
                      <th>Kỳ Quay</th>
                      <th>Ngày Quay</th>
                      <th>Bộ Số Trúng Thưởng</th>
                      <th style={{ textAlign: 'right' }}>Giá trị Jackpot</th>
                      <th style={{ textAlign: 'right' }}>Số người trúng</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Kỳ Quay</th>
                      <th>Ngày Quay</th>
                      <th>Bộ Số Trúng Thưởng (1-6 | Bonus)</th>
                      <th style={{ textAlign: 'right' }}>Jackpot 1</th>
                      <th style={{ textAlign: 'right' }}>Jackpot 2</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {results.slice().reverse().map((draw) => {
                    if (game === '645') {
                      const jackpot = draw.prizes.find(p => p.name.toLowerCase().includes('jackpot')) || { valueStr: '0', count: 0 };
                      return (
                        <tr key={draw.drawId}>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>#{draw.drawIdStr}</td>
                          <td>{draw.dateStr}</td>
                          <td>
                            <div className="balls-container">
                              {draw.numbers.map((n, i) => (
                                <span key={i} className="ball">{n}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{jackpot.valueStr} đ</td>
                          <td style={{ textAlign: 'right' }}>{jackpot.count}</td>
                        </tr>
                      );
                    } else {
                      const jp1 = draw.prizes.find(p => p.name.includes('Jackpot 1')) || { valueStr: '0', count: 0 };
                      const jp2 = draw.prizes.find(p => p.name.includes('Jackpot 2')) || { valueStr: '0', count: 0 };
                      return (
                        <tr key={draw.drawId}>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>#{draw.drawIdStr}</td>
                          <td>{draw.dateStr}</td>
                          <td>
                            <div className="balls-container">
                              {draw.numbers.slice(0, 6).map((n, i) => (
                                <span key={i} className="ball">{n}</span>
                              ))}
                              <span style={{ color: 'var(--border-color)', alignSelf: 'center', fontSize: '1.2rem' }}>|</span>
                              <span className="ball power-bonus">{draw.numbers[6]}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600' }}>{jp1.valueStr} đ ({jp1.count})</td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--warning)' }}>{jp2.valueStr} đ ({jp2.count})</td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h3>Chưa có dữ liệu preview</h3>
              <p>Chọn loại vé, khoảng ngày bên trái và nhấn nút cào để hiển thị bảng dữ liệu trước khi xuất Excel.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
