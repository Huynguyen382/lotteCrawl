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
  const [searchQuery, setSearchQuery] = useState('');
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [statsViewMode, setStatsViewMode] = useState('table'); // 'table' or 'chart'
  const [activeTab, setActiveTab] = useState('preview');
  const [sortBy, setSortBy] = useState('number');

  // State for Management / Manual entry
  const [mgmtTab, setMgmtTab] = useState('quick'); // 'quick' or 'manual'
  const [mgmtGame, setMgmtGame] = useState('645');
  const [mgmtDrawId, setMgmtDrawId] = useState('');
  const [mgmtDate, setMgmtDate] = useState('');
  const [mgmtNumbers, setMgmtNumbers] = useState(() => Array(7).fill(''));
  const [mgmtJackpotCount, setMgmtJackpotCount] = useState('0');
  const [mgmtJackpotValue, setMgmtJackpotValue] = useState('12000000000');
  const [mgmtJackpot2Count, setMgmtJackpot2Count] = useState('0');
  const [mgmtJackpot2Value, setMgmtJackpot2Value] = useState('3000000000');
  const [mgmtG1Count, setMgmtG1Count] = useState('0');
  const [mgmtG2Count, setMgmtG2Count] = useState('0');
  const [mgmtG3Count, setMgmtG3Count] = useState('0');
  const [isSubmittingMgmt, setIsSubmittingMgmt] = useState(false);
  const [mgmtMsg, setMgmtMsg] = useState({ text: '', type: '' });

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

  // Lấy các kết quả hiển thị thực tế (nằm trong khoảng kỳ đã cào được chọn)
  const visibleResults = results.filter((draw) => {
    if (!scrapedRange) return true;
    return draw.drawId >= scrapedRange.startId && draw.drawId <= scrapedRange.endId;
  });

  // Lọc kết quả theo điều kiện tìm kiếm (số, bộ số, kỳ quay, ngày quay)
  const filteredResults = visibleResults.filter((draw) => {
    if (!searchQuery.trim()) return true;

    // Tách các từ khóa tìm kiếm bằng dấu cách, dấu phẩy hoặc dấu gạch ngang
    const queryParts = searchQuery.toLowerCase().split(/[\s,.-]+/).filter(Boolean);
    if (queryParts.length === 0) return true;

    const lottoNumbers = [];
    const metaQueries = [];

    // Phân nhóm từ khóa thành 2 loại: số Vietlott hợp lệ [1, 55] và các chuỗi metadata khác
    queryParts.forEach((part) => {
      const isPureNumber = /^\d+$/.test(part);
      const num = parseInt(part, 10);
      
      if (isPureNumber && !isNaN(num) && num >= 1 && num <= 55) {
        lottoNumbers.push(num);
      } else {
        metaQueries.push(part);
      }
    });

    // 1. Nếu có nhập số Vietlott: BẮT BUỘC toàn bộ số đó phải nằm trong bộ số trúng thưởng
    if (lottoNumbers.length > 0) {
      const hasAllNumbers = lottoNumbers.every((searchNum) => {
        return draw.numbers.some((num) => parseInt(num, 10) === searchNum);
      });
      if (!hasAllNumbers) return false;
    }

    // 2. Nếu có từ khóa khác (kỳ quay, ngày quay, chữ...): Khớp với kỳ quay hoặc ngày quay
    if (metaQueries.length > 0) {
      return metaQueries.every((part) => {
        // Khớp mã kỳ quay (ví dụ: '1000' hoặc '#01000')
        if (draw.drawIdStr.includes(part) || String(draw.drawId).includes(part)) return true;

        // Khớp ngày quay
        if (draw.dateStr.includes(part)) return true;

        return false;
      });
    }

    return true;
  });

  // Tính toán số kỳ vắng mặt của các số từ 1-45 (Mega) hoặc 1-55 (Power)
  const getAbsenceStatistics = () => {
    if (visibleResults.length === 0) return [];
    
    const maxNum = game === '645' ? 45 : 55;
    // Sắp xếp kỳ quay giảm dần để duyệt từ mới nhất về cũ nhất
    const reversedResults = [...visibleResults].sort((a, b) => b.drawId - a.drawId);
    
    const stats = [];
    
    for (let i = 1; i <= maxNum; i++) {
      const numStr = String(i).padStart(2, '0');
      
      const firstSeenIndex = reversedResults.findIndex(draw => {
        return draw.numbers.some(num => parseInt(num, 10) === i);
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
          absentDraws: visibleResults.length, // Chưa xuất hiện trong dải dữ liệu đã cào
          lastSeenDrawId: 'N/A',
          lastSeenDate: 'Chưa về'
        });
      }
    }
    
    return stats;
  };

  // Sắp xếp kết quả thống kê vắng mặt
  const getSortedStats = () => {
    const stats = getAbsenceStatistics();
    if (sortBy === 'number') {
      return stats.sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));
    } else if (sortBy === 'absent-desc') {
      return stats.sort((a, b) => b.absentDraws - a.absentDraws);
    } else if (sortBy === 'absent-asc') {
      return stats.sort((a, b) => a.absentDraws - b.absentDraws);
    }
    return stats;
  };

  // Lọc kết quả thống kê vắng mặt theo statsSearchQuery
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

  // Tìm kỳ quay liền trước đó để tính toán chênh lệch
  const getPreviousDraw = (currentDraw) => {
    const sortedAll = [...results].sort((a, b) => a.drawId - b.drawId);
    const currentIndex = sortedAll.findIndex(d => d.drawId === currentDraw.drawId);
    if (currentIndex > 0) {
      return sortedAll[currentIndex - 1];
    }
    return null;
  };

  // Tính toán tổng số và chênh lệch số giữa 2 kỳ quay liên tiếp
  const calculateDeltas = (draw) => {
    const prevDraw = getPreviousDraw(draw);
    const currentNums = draw.numbers.map(n => parseInt(n, 10));
    const currentSum = currentNums.reduce((sum, n) => sum + n, 0);
    
    let sumDiff = null;
    let numDeltas = [];

    if (prevDraw) {
      const prevNums = prevDraw.numbers.map(n => parseInt(n, 10));
      const prevSum = prevNums.reduce((sum, n) => sum + n, 0);
      sumDiff = currentSum - prevSum;
      
      let curSorted = [];
      let prevSorted = [];
      
      if (game === '645') {
        curSorted = [...currentNums].sort((a, b) => a - b);
        prevSorted = [...prevNums].sort((a, b) => a - b);
      } else {
        // Tách 6 số chính và 1 số đặc biệt đối với Power 6/55
        const curMain = currentNums.slice(0, 6).sort((a, b) => a - b);
        const prevMain = prevNums.slice(0, 6).sort((a, b) => a - b);
        curSorted = [...curMain, currentNums[6]];
        prevSorted = [...prevMain, prevNums[6]];
      }

      numDeltas = curSorted.map((num, idx) => {
        return num - prevSorted[idx];
      });
    }

    return {
      currentSum,
      sumDiff,
      numDeltas
    };
  };

  const handleQuickFetch = async (e) => {
    e.preventDefault();
    if (!mgmtDrawId) {
      setMgmtMsg({ text: 'Vui lòng nhập mã kỳ quay.', type: 'error' });
      return;
    }
    setIsSubmittingMgmt(true);
    setMgmtMsg({ text: 'Đang gửi yêu cầu cào dữ liệu...', type: 'info' });
    try {
      const response = await fetch(`${API_BASE}/api/draws/quick-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: mgmtGame, drawId: mgmtDrawId })
      });
      const data = await response.json();
      if (response.ok) {
        setMgmtMsg({ text: data.message || 'Thành công!', type: 'success' });
        setMgmtDrawId('');
        fetchLatestInfo();
      } else {
        setMgmtMsg({ text: data.error || 'Có lỗi xảy ra.', type: 'error' });
      }
    } catch (err) {
      setMgmtMsg({ text: `Lỗi kết nối: ${err.message}`, type: 'error' });
    } finally {
      setIsSubmittingMgmt(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!mgmtDrawId || !mgmtDate) {
      setMgmtMsg({ text: 'Vui lòng nhập mã kỳ quay và ngày quay.', type: 'error' });
      return;
    }
    
    const dateObj = new Date(mgmtDate);
    if (isNaN(dateObj.getTime())) {
      setMgmtMsg({ text: 'Ngày quay không hợp lệ.', type: 'error' });
      return;
    }
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    
    const numCount = mgmtGame === '645' ? 6 : 7;
    const numbers = [];
    for (let i = 0; i < numCount; i++) {
      const val = mgmtNumbers[i]?.trim();
      if (!val || isNaN(parseInt(val, 10))) {
        setMgmtMsg({ text: `Số thứ ${i + 1} không hợp lệ.`, type: 'error' });
        return;
      }
      numbers.push(val.padStart(2, '0'));
    }
    
    let prizes = [];
    if (mgmtGame === '645') {
      prizes = [
        {
          name: 'Jackpot',
          matching: 'O O O O O O',
          count: parseInt(mgmtJackpotCount, 10) || 0,
          valueStr: (parseInt(mgmtJackpotValue, 10) || 0).toLocaleString('vi-VN'),
          value: parseInt(mgmtJackpotValue, 10) || 0
        },
        {
          name: 'Giải Nhất',
          matching: 'O O O O O',
          count: parseInt(mgmtG1Count, 10) || 0,
          valueStr: '10.000.000',
          value: 10000000
        },
        {
          name: 'Giải Nhì',
          matching: 'O O O O',
          count: parseInt(mgmtG2Count, 10) || 0,
          valueStr: '300.000',
          value: 30000
        },
        {
          name: 'Giải Ba',
          matching: 'O O O',
          count: parseInt(mgmtG3Count, 10) || 0,
          valueStr: '30.000',
          value: 30000
        }
      ];
    } else {
      prizes = [
        {
          name: 'Jackpot 1',
          matching: 'O O O O O O',
          count: parseInt(mgmtJackpotCount, 10) || 0,
          valueStr: (parseInt(mgmtJackpotValue, 10) || 0).toLocaleString('vi-VN'),
          value: parseInt(mgmtJackpotValue, 10) || 0
        },
        {
          name: 'Jackpot 2',
          matching: 'O O O O O + [O]',
          count: parseInt(mgmtJackpot2Count, 10) || 0,
          valueStr: (parseInt(mgmtJackpot2Value, 10) || 0).toLocaleString('vi-VN'),
          value: parseInt(mgmtJackpot2Value, 10) || 0
        },
        {
          name: 'Giải Nhất',
          matching: 'O O O O O',
          count: parseInt(mgmtG1Count, 10) || 0,
          valueStr: '40.000.000',
          value: 40000000
        },
        {
          name: 'Giải Nhì',
          matching: 'O O O O',
          count: parseInt(mgmtG2Count, 10) || 0,
          valueStr: '500.000',
          value: 500000
        },
        {
          name: 'Giải Ba',
          matching: 'O O O',
          count: parseInt(mgmtG3Count, 10) || 0,
          valueStr: '50.000',
          value: 50000
        }
      ];
    }
    
    setIsSubmittingMgmt(true);
    setMgmtMsg({ text: 'Đang lưu kết quả...', type: 'info' });
    try {
      const response = await fetch(`${API_BASE}/api/draws`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: mgmtGame,
          drawId: mgmtDrawId,
          dateStr,
          numbers,
          prizes
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMgmtMsg({ text: data.message || 'Đã lưu thành công!', type: 'success' });
        setMgmtDrawId('');
        setMgmtDate('');
        setMgmtNumbers(Array(7).fill(''));
        setMgmtJackpotCount('0');
        setMgmtJackpot2Count('0');
        setMgmtG1Count('0');
        setMgmtG2Count('0');
        setMgmtG3Count('0');
        fetchLatestInfo();
      } else {
        setMgmtMsg({ text: data.error || 'Có lỗi xảy ra.', type: 'error' });
      }
    } catch (err) {
      setMgmtMsg({ text: `Lỗi kết nối: ${err.message}`, type: 'error' });
    } finally {
      setIsSubmittingMgmt(false);
    }
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
        {/* Left Column: Control Card & Management Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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

          {/* NEW Management Card */}
          <div className="glass-panel control-card" style={{ marginTop: '0' }}>
            <h2 className="section-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Quản lý & Nhập liệu kỳ quay
            </h2>

            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '10px' }}>
              <button
                type="button"
                className={`tab-btn ${mgmtTab === 'quick' ? 'active' : ''}`}
                onClick={() => { setMgmtTab('quick'); setMgmtMsg({ text: '', type: '' }); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: mgmtTab === 'quick' ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: mgmtTab === 'quick' ? '2px solid var(--accent)' : 'none',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}
              >
                Cào nhanh theo kỳ
              </button>
              <button
                type="button"
                className={`tab-btn ${mgmtTab === 'manual' ? 'active' : ''}`}
                onClick={() => { setMgmtTab('manual'); setMgmtMsg({ text: '', type: '' }); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: mgmtTab === 'manual' ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: mgmtTab === 'manual' ? '2px solid var(--accent)' : 'none',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}
              >
                Nhập thủ công
              </button>
            </div>

            {/* Game Selector for Management */}
            <div className="form-group">
              <label>Loại Vé</label>
              <select
                className="select-field"
                value={mgmtGame}
                onChange={(e) => setMgmtGame(e.target.value)}
                disabled={isSubmittingMgmt}
              >
                <option value="645">Mega 6/45</option>
                <option value="655">Power 6/55</option>
              </select>
            </div>

            {mgmtTab === 'quick' ? (
              <form onSubmit={handleQuickFetch}>
                <div className="form-group">
                  <label>Mã Kỳ Quay (Draw ID)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ví dụ: 01190 hoặc 1190"
                    value={mgmtDrawId}
                    onChange={(e) => setMgmtDrawId(e.target.value)}
                    disabled={isSubmittingMgmt}
                  />
                </div>
                
                <button
                  type="submit"
                  className={`btn btn-secondary ${isSubmittingMgmt ? 'btn-disabled' : ''}`}
                  disabled={isSubmittingMgmt}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {isSubmittingMgmt ? 'Đang cào...' : 'Tải & Lưu dữ liệu'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>Mã Kỳ Quay</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Ví dụ: 1190"
                    value={mgmtDrawId}
                    onChange={(e) => setMgmtDrawId(e.target.value)}
                    disabled={isSubmittingMgmt}
                  />
                </div>

                <div className="form-group">
                  <label>Ngày Quay Thưởng</label>
                  <input
                    type="date"
                    className="input-field"
                    value={mgmtDate}
                    onChange={(e) => setMgmtDate(e.target.value)}
                    disabled={isSubmittingMgmt}
                  />
                </div>

                <div className="form-group">
                  <label>Bộ Số Trúng Thưởng ({mgmtGame === '645' ? '6 số' : '6 số chính + 1 số ĐB'})</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {Array.from({ length: mgmtGame === '645' ? 6 : 7 }).map((_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength="2"
                        className="input-field"
                        style={{
                          width: '38px',
                          height: '38px',
                          textAlign: 'center',
                          padding: '0',
                          fontSize: '0.9rem',
                          borderRadius: '8px',
                          border: idx === 6 ? '1px solid var(--warning)' : '1px solid var(--border-color)',
                          background: idx === 6 ? 'rgba(255, 183, 3, 0.05)' : 'rgba(255,255,255,0.02)'
                        }}
                        placeholder={idx === 6 ? 'ĐB' : String(idx + 1)}
                        value={mgmtNumbers[idx] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const newNums = [...mgmtNumbers];
                          newNums[idx] = val;
                          setMgmtNumbers(newNums);
                        }}
                        disabled={isSubmittingMgmt}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Số Lượng & Giá Trị Trúng Giải</label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Trúng Jackpot</label>
                      <input
                        type="number"
                        className="input-field"
                        value={mgmtJackpotCount}
                        onChange={(e) => setMgmtJackpotCount(e.target.value)}
                        disabled={isSubmittingMgmt}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Giá Trị Jackpot (đ)</label>
                      <input
                        type="number"
                        className="input-field"
                        value={mgmtJackpotValue}
                        onChange={(e) => setMgmtJackpotValue(e.target.value)}
                        disabled={isSubmittingMgmt}
                      />
                    </div>
                  </div>

                  {mgmtGame === '655' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>Trúng Jackpot 2</label>
                        <input
                          type="number"
                          className="input-field"
                          value={mgmtJackpot2Count}
                          onChange={(e) => setMgmtJackpot2Count(e.target.value)}
                          disabled={isSubmittingMgmt}
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem' }}>Giá Trị Jackpot 2 (đ)</label>
                        <input
                          type="number"
                          className="input-field"
                          value={mgmtJackpot2Value}
                          onChange={(e) => setMgmtJackpot2Value(e.target.value)}
                          disabled={isSubmittingMgmt}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Giải Nhất</label>
                      <input
                        type="number"
                        className="input-field"
                        value={mgmtG1Count}
                        onChange={(e) => setMgmtG1Count(e.target.value)}
                        disabled={isSubmittingMgmt}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Giải Nhì</label>
                      <input
                        type="number"
                        className="input-field"
                        value={mgmtG2Count}
                        onChange={(e) => setMgmtG2Count(e.target.value)}
                        disabled={isSubmittingMgmt}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Giải Ba</label>
                      <input
                        type="number"
                        className="input-field"
                        value={mgmtG3Count}
                        onChange={(e) => setMgmtG3Count(e.target.value)}
                        disabled={isSubmittingMgmt}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`btn btn-primary ${isSubmittingMgmt ? 'btn-disabled' : ''}`}
                  disabled={isSubmittingMgmt}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {isSubmittingMgmt ? 'Đang lưu...' : 'Lưu kết quả'}
                </button>
              </form>
            )}

            {mgmtMsg.text && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  backgroundColor: mgmtMsg.type === 'success' 
                    ? 'rgba(46, 196, 182, 0.15)' 
                    : mgmtMsg.type === 'error' 
                      ? 'rgba(230, 57, 70, 0.15)' 
                      : 'rgba(69, 123, 157, 0.15)',
                  color: mgmtMsg.type === 'success' 
                    ? 'var(--success)' 
                    : mgmtMsg.type === 'error' 
                      ? 'var(--error)' 
                      : 'var(--accent)',
                  border: `1px solid ${
                    mgmtMsg.type === 'success' 
                      ? 'rgba(46, 196, 182, 0.3)' 
                      : mgmtMsg.type === 'error' 
                        ? 'rgba(230, 57, 70, 0.3)' 
                        : 'rgba(69, 123, 157, 0.3)'
                  }`
                }}
              >
                {mgmtMsg.text}
              </div>
            )}
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
            {visibleResults.length > 0 && (
              <span className="preview-count">
                Đã tải {visibleResults.length} kỳ quay
              </span>
            )}
          </div>

          {/* Tab Navigation */}
          {visibleResults.length > 0 && (
            <div className="tabs-navigation" style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '16px', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
              paddingBottom: '8px' 
            }}>
              <button
                className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('preview');
                  setStatsSearchQuery(''); // Xóa query search thống kê khi qua tab xem trước
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'preview' ? 'var(--accent, #e63946)' : 'var(--text-muted, #8d99ae)',
                  borderBottom: activeTab === 'preview' ? '2px solid var(--accent, #e63946)' : 'none',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem'
                }}
              >
                Xem trước dữ liệu
              </button>
              <button
                className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('stats');
                  setSearchQuery(''); // Xóa query search thường khi qua tab thống kê
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'stats' ? 'var(--accent, #e63946)' : 'var(--text-muted, #8d99ae)',
                  borderBottom: activeTab === 'stats' ? '2px solid var(--accent, #e63946)' : 'none',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.95rem'
                }}
              >
                Thống kê vắng mặt
              </button>
            </div>
          )}
 
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

          {/* Tab Content */}
          {visibleResults.length > 0 ? (
            activeTab === 'preview' ? (
              <>
                {/* Search Box */}
                <div className="search-container" style={{ marginBottom: '16px', padding: '0 8px' }}>
                  <div className="input-group" style={{ position: 'relative', width: '100%' }}>
                    <input
                      type="text"
                      placeholder="Tìm kiếm kỳ quay, ngày, số (ví dụ: 15) hoặc bộ số (ví dụ: 15 23 34)..."
                      className="input-field"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '36px', width: '100%' }}
                    />
                    <svg 
                      width="18" 
                      height="18" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          lineHeight: '1'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Tìm thấy <strong>{filteredResults.length}</strong> / {visibleResults.length} kỳ quay khớp điều kiện.
                    </div>
                  )}
                </div>

                 {/* Results Table */}
                <div className="table-wrapper">
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
                      ) : (
                        <tr>
                          <th>Kỳ Quay</th>
                          <th>Ngày Quay</th>
                          <th>Bộ Số Trúng Thưởng (1-6 | Bonus)</th>
                          <th style={{ textAlign: 'center', width: '110px' }}>Tổng (Lệch)</th>
                          <th style={{ textAlign: 'center', width: '110px' }}>Tổng Vắng</th>
                          <th style={{ textAlign: 'right' }}>Jackpot 1</th>
                          <th style={{ textAlign: 'right' }}>Jackpot 2</th>
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
                        }
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="stats-wrapper">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Tính toán vắng mặt dựa trên **{visibleResults.length}** kỳ quay đã cào.
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
                        {getFilteredSortedStats().map((item) => {
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
                                <span className="ball" style={{ margin: '0 auto' }}>{item.number}</span>
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
                    {getFilteredSortedStats().map((item) => {
                      const maxAbsent = Math.max(...getFilteredSortedStats().map(s => s.absentDraws), 1);
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
                          <span className="ball" style={{ width: '32px', height: '32px', fontSize: '0.85rem', flexShrink: 0, background: item.absentDraws === 0 ? 'radial-gradient(circle at 30% 30%, #2a9d8f, #1a6d61)' : undefined }}>
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
            )
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
