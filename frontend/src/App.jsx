import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from './config';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import BottomNav from './components/BottomNav';


function App() {
  const [game, setGame] = useState('645'); // '645' for Mega, '655' for Power
  const [startDate, setStartDate] = useState(() => {
    // Default to the first day of the current year
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    // Default to today
    return new Date().toISOString().split('T')[0];
  });
  const [isScraping, setIsScraping] = useState(false);
  const [crawlOnline, setCrawlOnline] = useState(false);
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
  const [activeTab, setActiveTab] = useState('preview');

  // Lifted state for AI predictions to avoid data loss on tab switch
  const [predictionTickets, setPredictionTickets] = useState([]);
  const [predictionStrategy, setPredictionStrategy] = useState('balanced');
  const [predictionTicketCount, setPredictionTicketCount] = useState(3);

  const [predictionTicketsV2, setPredictionTicketsV2] = useState([]);
  const [predictionTicketCountV2, setPredictionTicketCountV2] = useState(3);

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
    setPredictionTickets([]); // Reset predicted tickets when game type changes
    setPredictionTicketsV2([]);
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

    const url = `${API_BASE}/api/scrape-stream?game=${game}&startDate=${startDate}&endDate=${endDate}&mode=${crawlOnline ? 'xskt' : 'db'}`;
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

  // Get visible results
  const visibleResults = results.filter((draw) => {
    if (!scrapedRange) return true;
    return draw.drawId >= scrapedRange.startId && draw.drawId <= scrapedRange.endId;
  });

  const statsConfigV2 = React.useMemo(() => {
    if (!visibleResults || visibleResults.length === 0) {
      return {
        totalDraws: 0,
        hot: [],
        cold: [],
        topPairs: [],
        sums: { mean: 0, min: 0, max: 0 }
      };
    }

    const mainLength = game === '535' ? 5 : 6;
    let totalDraws = 0;
    const frequency = {};
    const pairs = {};
    const sums = [];

    visibleResults.forEach(draw => {
      if (!draw.numbers || draw.numbers.length < mainLength) return;
      
      const nums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10));
      totalDraws++;
      
      nums.forEach(n => {
        frequency[n] = (frequency[n] || 0) + 1;
      });
      
      const sum = nums.reduce((a, b) => a + b, 0);
      sums.push(sum);
      
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) {
          const n1 = nums[i];
          const n2 = nums[j];
          const pKey = n1 < n2 ? `${n1}-${n2}` : `${n2}-${n1}`;
          pairs[pKey] = (pairs[pKey] || 0) + 1;
        }
      }
    });

    const freqArr = Object.entries(frequency).map(([num, count]) => ({ num: parseInt(num, 10), count }));
    freqArr.sort((a, b) => b.count - a.count);
    
    const hot = freqArr.slice(0, 10).map(x => String(x.num).padStart(2, '0'));
    const cold = freqArr.slice(-10).map(x => String(x.num).padStart(2, '0'));
    
    const pairsArr = Object.entries(pairs).map(([pair, count]) => ({ pair, count }));
    pairsArr.sort((a, b) => b.count - a.count);
    const topPairs = pairsArr.slice(0, 50).map(x => x.pair);
    
    sums.sort((a, b) => a - b);
    const sumMean = sums.length > 0 ? Math.round(sums.reduce((a, b) => a + b, 0) / sums.length) : 0;
    const sumMin = sums[0] || 0;
    const sumMax = sums[sums.length - 1] || 0;

    return {
      totalDraws,
      hot,
      cold,
      topPairs,
      sums: { mean: sumMean, min: sumMin, max: sumMax }
    };
  }, [visibleResults, game]);

  // Filter results by query
  const filteredResults = visibleResults.filter((draw) => {
    if (!searchQuery.trim()) return true;

    const queryParts = searchQuery.toLowerCase().split(/[\s,.-]+/).filter(Boolean);
    if (queryParts.length === 0) return true;

    const lottoNumbers = [];
    const metaQueries = [];

    queryParts.forEach((part) => {
      const isPureNumber = /^\d+$/.test(part);
      const num = parseInt(part, 10);
      
      if (isPureNumber && !isNaN(num) && num >= 1 && num <= 55) {
        lottoNumbers.push(num);
      } else {
        metaQueries.push(part);
      }
    });

    if (lottoNumbers.length > 0) {
      const hasAllNumbers = lottoNumbers.every((searchNum) => {
        return draw.numbers.some((num) => parseInt(num, 10) === searchNum);
      });
      if (!hasAllNumbers) return false;
    }

    if (metaQueries.length > 0) {
      return metaQueries.every((part) => {
        if (draw.drawIdStr.includes(part) || String(draw.drawId).includes(part)) return true;
        if (draw.dateStr.includes(part)) return true;
        return false;
      });
    }

    return true;
  }).sort((a, b) => {
    if (!searchQuery.trim()) return a.drawId - b.drawId;

    const queryParts = searchQuery.toLowerCase().split(/[\s,.-]+/).filter(Boolean);
    const searchNums = [];
    queryParts.forEach((part) => {
      const isPureNumber = /^\d+$/.test(part);
      const num = parseInt(part, 10);
      if (isPureNumber && !isNaN(num) && num >= 1 && num <= 55) {
        searchNums.push(num);
      }
    });

    if (searchNums.length === 0) {
      return a.drawId - b.drawId;
    }

    const mainLength = game === '535' ? 5 : 6;

    const getPriority = (draw) => {
      if (!draw.numbers) return 0;
      const mainNums = draw.numbers.slice(0, mainLength).map(Number);
      const hasAllInMain = searchNums.every(n => mainNums.includes(n));
      return hasAllInMain ? 1 : 0;
    };

    const pA = getPriority(a);
    const pB = getPriority(b);

    if (pA !== pB) {
      return pA - pB; // 0 (special match only) comes before 1 (main match) so main matches are last in list (rendered first on reverse)
    }

    return a.drawId - b.drawId;
  });

  // Find previous draw index to calculate diff
  const getPreviousDraw = (currentDraw) => {
    const sortedAll = [...results].sort((a, b) => a.drawId - b.drawId);
    const currentIndex = sortedAll.findIndex(d => d.drawId === currentDraw.drawId);
    if (currentIndex > 0) {
      return sortedAll[currentIndex - 1];
    }
    return null;
  };

  // Calculate sum and step deltas
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
      } else if (game === '655') {
        const curMain = currentNums.slice(0, 6).sort((a, b) => a - b);
        const prevMain = prevNums.slice(0, 6).sort((a, b) => a - b);
        curSorted = [...curMain, currentNums[6]];
        prevSorted = [...prevMain, prevNums[6]];
      } else if (game === '535') {
        const curMain = currentNums.slice(0, 5).sort((a, b) => a - b);
        const prevMain = prevNums.slice(0, 5).sort((a, b) => a - b);
        curSorted = [...curMain, currentNums[5]];
        prevSorted = [...prevMain, prevNums[5]];
      }

      numDeltas = curSorted.map((num, idx) => {
        return num - prevSorted[idx];
      });
    }

    return { sumDiff, numDeltas };
  };

  return (
    <div className="app-container">
      <Header game={game} latestInfo={latestInfo} />

      <div className="dashboard-grid">
        <LeftPanel
          game={game}
          setGame={setGame}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          crawlOnline={crawlOnline}
          setCrawlOnline={setCrawlOnline}
          isScraping={isScraping}
          handleStartScrape={handleStartScrape}
          scrapedRange={scrapedRange}
          handleDownloadExcel={handleDownloadExcel}
          logs={logs}
          logContainerRef={logContainerRef}
          fetchLatestInfo={fetchLatestInfo}
          progress={progress}
        />

        {/* Right Column: Interactive Results Dashboard */}
        <RightPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          visibleResults={visibleResults}
          filteredResults={filteredResults}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isScraping={isScraping}
          progress={progress}
          game={game}
          calculateDeltas={calculateDeltas}
          statsConfigV2={statsConfigV2}
          predictionTickets={predictionTickets}
          setPredictionTickets={setPredictionTickets}
          predictionStrategy={predictionStrategy}
          setStrategy={setPredictionStrategy}
          predictionTicketCount={predictionTicketCount}
          setPredictionTicketCount={setPredictionTicketCount}
          predictionTicketsV2={predictionTicketsV2}
          setPredictionTicketsV2={setPredictionTicketsV2}
          predictionTicketCountV2={predictionTicketCountV2}
          setPredictionTicketCountV2={setPredictionTicketCountV2}
        />
      </div>

      {/* Sticky Bottom Navigation Bar for Mobile View */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;
