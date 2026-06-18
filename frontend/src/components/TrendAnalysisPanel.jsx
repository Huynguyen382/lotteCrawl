import React, { useState, useMemo } from 'react';
import './TrendAnalysisPanel.css';

function TrendAnalysisPanel({ game, visibleResults, statsConfig }) {
  const [activeChart, setActiveChart] = useState('sum'); // 'sum' | 'absence' | 'score'
  const [drawLimit, setDrawLimit] = useState(50); // 30 | 50 | 100 | 0 (all)

  const [hoveredPoint, setHoveredPoint] = useState(null); // { x, y, data } for tooltip

  const mainLength = game === '535' ? 5 : 6;
  const maxNum = game === '645' ? 45 : (game === '655' ? 55 : 35);

  // 1. Helper function for scoring tickets
  function scoreTicket(ticketNums, config) {
    if (!config || !config.sums || !config.topPairs || !config.hot || !config.cold) {
      return { score: 0, reasons: [] };
    }
    let score = 0;
    const reasons = [];

    // Sum Rule (Bell Curve)
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

    // Consecutive Rule
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

    // Association Rule (Pairs)
    const top15Pairs = config.topPairs ? config.topPairs.slice(0, 15) : [];
    for (let i = 0; i < ticketNums.length; i++) {
      for (let j = i + 1; j < ticketNums.length; j++) {
        const p1 = `${ticketNums[i]}-${ticketNums[j]}`;
        if (top15Pairs.includes(p1)) {
          score += 2;
          reasons.push({ type: 'primary', text: `Cặp tỷ lệ cao [${ticketNums[i]}, ${ticketNums[j]}]` });
        }
      }
    }

    // Hot/Cold frequencies
    let hotCount = 0;
    let coldCount = 0;
    const hotList = config.hot || [];
    const coldList = config.cold || [];
    ticketNums.forEach(n => {
      const nStr = String(n).padStart(2, '0');
      if (hotList.slice(0, 8).includes(nStr)) hotCount++;
      if (coldList.slice(0, 5).includes(nStr)) coldCount++;
    });
    
    if (hotCount >= 1 && hotCount <= 3) {
      score += 1;
    }
    if (coldCount === 1) {
      score += 1;
      reasons.push({ type: 'warning', text: 'Đón lỏng số lạnh' });
    }

    // Odd/Even ratio
    const oddCount = ticketNums.filter(n => n % 2 !== 0).length;
    const isBalanced = (mainLength === 6 && oddCount >= 2 && oddCount <= 4) || (mainLength === 5 && oddCount >= 2 && oddCount <= 3);
    if (isBalanced) {
      score += 1;
    } else {
      score -= 2;
    }

    // Low/High Balance Rule
    const midPoint = game === '645' ? 23 : (game === '655' ? 28 : 18);
    const lowCount = ticketNums.filter(n => n < midPoint).length;
    const highCount = ticketNums.length - lowCount;
    const isLowHighBalanced = (mainLength === 6 && lowCount >= 2 && lowCount <= 4) || (mainLength === 5 && lowCount >= 2 && lowCount <= 3);
    if (isLowHighBalanced) {
      score += 1;
    } else if (lowCount === 0 || highCount === 0) {
      score -= 2;
    }

    // Prime Number Rule
    const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53]);
    const primeCount = ticketNums.filter(n => primes.has(n)).length;
    if (primeCount >= 1 && primeCount <= 3) {
      score += 1;
    } else if (primeCount === 0) {
      score -= 1;
    }

    // Tail Digit Repetition Rule
    const tails = ticketNums.map(n => n % 10);
    const tailCounts = {};
    tails.forEach(t => { tailCounts[t] = (tailCounts[t] || 0) + 1; });
    const maxTailRep = Math.max.apply(null, Object.values(tailCounts));
    if (maxTailRep === 2) {
      score += 1;
      reasons.push({ type: 'success', text: 'Nhịp đuôi đối xứng' });
    } else if (maxTailRep >= 4) {
      score -= 3;
    }

    // Spread Range Check
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
  }

  // 2. Prepare chronological draw data for Sum and Score charts
  const trendData = useMemo(() => {
    if (!visibleResults || visibleResults.length === 0) return [];
    
    // Slice based on drawLimit, visibleResults is sorted newest first (descending)
    const sliced = drawLimit > 0 ? visibleResults.slice(0, drawLimit) : visibleResults;
    
    // Map to objects with sum and score computed, and reverse to chronologically ascending (oldest first)
    const mapped = sliced.map(draw => {
      const mainNums = draw.numbers ? draw.numbers.slice(0, mainLength).map(Number).sort((a, b) => a - b) : [];
      const sum = mainNums.reduce((a, b) => a + b, 0);
      const scoreObj = statsConfig ? scoreTicket(mainNums, statsConfig) : { score: 0, reasons: [] };
      return {
        drawId: draw.drawId,
        drawIdStr: draw.drawIdStr,
        dateStr: draw.dateStr,
        numbers: draw.numbers ? draw.numbers.slice(0, mainLength) : [],
        sum,
        score: scoreObj.score,
        reasons: scoreObj.reasons
      };
    });
    
    return mapped.reverse();
  }, [visibleResults, drawLimit, statsConfig, game]);

  // 3. Compute Absence Counts for bar chart
  const absenceData = useMemo(() => {
    if (!visibleResults || visibleResults.length === 0) return [];

    const absences = {};
    for (let i = 1; i <= maxNum; i++) {
      absences[i] = visibleResults.length;
    }

    // Loop from newest to oldest. Draw index is the absence count.
    visibleResults.forEach((draw, idx) => {
      if (!draw.numbers) return;
      const nums = draw.numbers.slice(0, mainLength).map(Number);
      nums.forEach(n => {
        if (absences[n] === visibleResults.length) {
          absences[n] = idx;
        }
      });
    });

    return Object.entries(absences).map(([num, count]) => ({
      num: parseInt(num, 10),
      count
    })).sort((a, b) => a.num - b.num);
  }, [visibleResults, game]);

  // 4. Render Sum Trend Line Chart
  const renderSumChart = () => {
    if (trendData.length === 0) return <div className="trends-empty">Không có dữ liệu biểu đồ.</div>;

    const width = 850;
    const height = 380;
    const padding = { top: 30, right: 30, bottom: 45, left: 50 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const meanVal = statsConfig?.sums?.mean || (game === '645' ? 138 : (game === '655' ? 168 : 90));

    // Find min/max sums to scale y-axis dynamically
    const sums = trendData.map(d => d.sum);
    let yMin = Math.min(...sums, meanVal - 25);
    let yMax = Math.max(...sums, meanVal + 25);
    yMin = Math.floor(yMin / 10) * 10;
    yMax = Math.ceil(yMax / 10) * 10;

    // Helper functions to convert value to coordinates
    const getX = (idx) => padding.left + (idx / (trendData.length - 1)) * plotWidth;
    const getY = (val) => padding.top + plotHeight - ((val - yMin) / (yMax - yMin)) * plotHeight;

    // Golden zone box bounds
    const yGoldenTop = getY(meanVal + 15);
    const yGoldenBottom = getY(meanVal - 15);
    const goldenHeight = yGoldenBottom - yGoldenTop;

    // Construct path string
    const points = trendData.map((d, i) => `${getX(i)},${getY(d.sum)}`);
    const pathD = `M ${points.join(' L ')}`;

    // Generate horizontal grid lines
    const gridLines = [];
    const step = 20;
    const startGridVal = Math.ceil(yMin / step) * step;
    for (let v = startGridVal; v <= yMax; v += step) {
      gridLines.push(v);
    }

    return (
      <div className="trends-chart-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <defs>
            <linearGradient id="sumGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5e6c" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ff5e6c" stopOpacity="0" />
            </linearGradient>
            <filter id="glowSum" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {gridLines.map((val, idx) => (
            <g key={idx}>
              <line 
                x1={padding.left} 
                y1={getY(val)} 
                x2={width - padding.right} 
                y2={getY(val)} 
                className="trends-grid-line"
              />
              <text 
                x={padding.left - 10} 
                y={getY(val) + 4} 
                textAnchor="end" 
                className="trends-axis-text"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Golden Zone Shading Area */}
          <rect 
            x={padding.left} 
            y={yGoldenTop} 
            width={plotWidth} 
            height={goldenHeight} 
            className="trends-golden-rect"
          />

          {/* Golden Range Mean Centerline */}
          <line 
            x1={padding.left} 
            y1={getY(meanVal)} 
            x2={width - padding.right} 
            y2={getY(meanVal)} 
            className="trends-mean-line"
          />

          {/* Golden mean text label */}
          <text 
            x={width - padding.right - 8} 
            y={getY(meanVal) - 6} 
            textAnchor="end" 
            className="trends-mean-text"
          >
            Trung bình: {meanVal}
          </text>

          {/* Area fill under Sum Line */}
          {trendData.length > 0 && (
            <path
              d={`M ${getX(0)},${padding.top + plotHeight} L ${points.join(' L ')} L ${getX(trendData.length - 1)},${padding.top + plotHeight} Z`}
              fill="url(#sumGlowGrad)"
            />
          )}

          {/* Sum Trend Line */}
          <path 
            d={pathD} 
            className="trends-line sum-line"
            filter="url(#glowSum)"
          />

          {/* Interactivity Dots */}
          {trendData.map((pt, idx) => {
            const cx = getX(idx);
            const cy = getY(pt.sum);
            const isGolden = pt.sum >= meanVal - 15 && pt.sum <= meanVal + 15;
            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={hoveredPoint?.data?.drawId === pt.drawId ? 6 : 4}
                className={`trends-dot ${isGolden ? 'golden' : 'outer'}`}
                onMouseEnter={(e) => {
                  const rect = e.target.getBoundingClientRect();
                  setHoveredPoint({
                    x: rect.left + window.scrollX - 10,
                    y: rect.top + window.scrollY - 110,
                    type: 'sum',
                    data: pt
                  });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {/* X Axis Labels */}
          {trendData.map((pt, idx) => {
            // Label every few points to avoid overlap
            const divisor = Math.ceil(trendData.length / 10);
            if (idx % divisor !== 0 && idx !== trendData.length - 1) return null;

            return (
              <text 
                key={idx}
                x={getX(idx)} 
                y={padding.top + plotHeight + 20} 
                textAnchor="middle" 
                className="trends-axis-text"
              >
                #{pt.drawIdStr}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // 5. Render Absence Bar Chart
  const renderAbsenceChart = () => {
    if (absenceData.length === 0) return <div className="trends-empty">Không có dữ liệu biểu đồ.</div>;

    const width = 850;
    const height = 350;
    const padding = { top: 30, right: 20, bottom: 40, left: 45 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const maxAbsVal = Math.max(...absenceData.map(d => d.count), 10);
    const yMax = Math.ceil(maxAbsVal / 10) * 10;

    const getX = (idx) => padding.left + (idx / absenceData.length) * plotWidth;
    const getY = (val) => padding.top + plotHeight - (val / yMax) * plotHeight;
    const barWidth = Math.max(3, (plotWidth / absenceData.length) - 3);

    // Grid lines
    const gridLines = [];
    const step = Math.max(5, Math.ceil(yMax / 5 / 5) * 5);
    for (let v = 0; v <= yMax; v += step) {
      gridLines.push(v);
    }

    const coldThreshold = Math.max(12, Math.round(visibleResults.length * 0.15));

    return (
      <div className="trends-chart-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <defs>
            <linearGradient id="barHotGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ec4b6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#2ec4b6" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="barColdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9d4edd" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#5a189a" stopOpacity="0.3" />
            </linearGradient>
            <filter id="glowBar" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {gridLines.map((val, idx) => (
            <g key={idx}>
              <line 
                x1={padding.left} 
                y1={getY(val)} 
                x2={width - padding.right} 
                y2={getY(val)} 
                className="trends-grid-line"
              />
              <text 
                x={padding.left - 10} 
                y={getY(val) + 4} 
                textAnchor="end" 
                className="trends-axis-text"
              >
                {val}
              </text>
            </g>
          ))}

          {/* Bars */}
          {absenceData.map((pt, idx) => {
            const x = getX(idx) + 1.5;
            const y = getY(pt.count);
            const barHeight = plotHeight - (y - padding.top);
            const isCold = pt.count >= coldThreshold;

            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(1, barHeight)}
                className={`trends-bar ${isCold ? 'cold' : 'normal'}`}
                fill={isCold ? "url(#barColdGrad)" : "url(#barHotGrad)"}
                filter={isCold ? "url(#glowBar)" : ""}
                onMouseEnter={(e) => {
                  const rect = e.target.getBoundingClientRect();
                  setHoveredPoint({
                    x: rect.left + window.scrollX - 10,
                    y: rect.top + window.scrollY - 100,
                    type: 'absence',
                    data: pt
                  });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {/* X Axis Numbers */}
          {absenceData.map((pt, idx) => {
            const divisor = game === '655' ? 5 : 2;
            if (pt.num % divisor !== 0 && pt.num !== 1 && pt.num !== maxNum) return null;
            
            return (
              <text
                key={idx}
                x={getX(idx) + barWidth / 2}
                y={padding.top + plotHeight + 18}
                textAnchor="middle"
                className="trends-axis-text"
              >
                {String(pt.num).padStart(2, '0')}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  // 6. Render AI V2 Score Trend Chart
  const renderScoreChart = () => {
    if (trendData.length === 0) return <div className="trends-empty">Không có dữ liệu biểu đồ.</div>;

    const width = 850;
    const height = 350;
    const padding = { top: 30, right: 25, bottom: 40, left: 45 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const yMax = 13;
    const getX = (idx) => padding.left + (idx / (trendData.length - 1)) * plotWidth;
    const getY = (val) => padding.top + plotHeight - (val / yMax) * plotHeight;

    const gridLines = [0, 2, 4, 6, 8, 10, 12, 13];
    const points = trendData.map((d, i) => `${getX(i)},${getY(d.score)}`);
    const pathD = `M ${points.join(' L ')}`;

    return (
      <div className="trends-chart-wrapper">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
          <defs>
            <linearGradient id="scoreGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb703" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffb703" stopOpacity="0" />
            </linearGradient>
            <filter id="glowScore" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          {gridLines.map((val, idx) => (
            <g key={idx}>
              <line 
                x1={padding.left} 
                y1={getY(val)} 
                x2={width - padding.right} 
                y2={getY(val)} 
                className="trends-grid-line"
              />
              <text 
                x={padding.left - 10} 
                y={getY(val) + 4} 
                textAnchor="end" 
                className="trends-axis-text"
              >
                {val}đ
              </text>
            </g>
          ))}

          {/* Shaded Area */}
          {trendData.length > 0 && (
            <path
              d={`M ${getX(0)},${padding.top + plotHeight} L ${points.join(' L ')} L ${getX(trendData.length - 1)},${padding.top + plotHeight} Z`}
              fill="url(#scoreGlowGrad)"
            />
          )}

          {/* Score line */}
          <path 
            d={pathD} 
            className="trends-line score-line"
            filter="url(#glowScore)"
          />

          {/* Dots */}
          {trendData.map((pt, idx) => {
            const cx = getX(idx);
            const cy = getY(pt.score);
            const isExcellent = pt.score >= 10;
            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={hoveredPoint?.data?.drawId === pt.drawId ? 6 : 4}
                className={`trends-dot ${isExcellent ? 'excellent' : 'regular'}`}
                onMouseEnter={(e) => {
                  const rect = e.target.getBoundingClientRect();
                  setHoveredPoint({
                    x: rect.left + window.scrollX - 10,
                    y: rect.top + window.scrollY - 110,
                    type: 'score',
                    data: pt
                  });
                }}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            );
          })}

          {/* X Axis Labels */}
          {trendData.map((pt, idx) => {
            const divisor = Math.ceil(trendData.length / 10);
            if (idx % divisor !== 0 && idx !== trendData.length - 1) return null;

            return (
              <text 
                key={idx}
                x={getX(idx)} 
                y={padding.top + plotHeight + 20} 
                textAnchor="middle" 
                className="trends-axis-text"
              >
                #{pt.drawIdStr}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="trends-container slide-up">
      <div className="trends-header">
        <div>
          <h3>📈 Phân Tích Xu Hướng Dữ Liệu</h3>
          <p>Mô hình hóa lịch sử các kỳ quay để xác định điểm rơi lý tưởng</p>
        </div>

        <div className="trends-controls">
          {activeChart !== 'absence' && (
            <div className="trends-select-group">
              <label>Kỳ quay:</label>
              <select 
                value={drawLimit} 
                onChange={(e) => setDrawLimit(parseInt(e.target.value, 10))}
                className="select-field"
                style={{ height: '34px', margin: 0, padding: '0 8px', fontSize: '0.85rem' }}
              >
                <option value={30}>30 kỳ gần nhất</option>
                <option value={50}>50 kỳ gần nhất</option>
                <option value={100}>100 kỳ gần nhất</option>
                <option value={0}>Tất cả kỳ quay</option>
              </select>
            </div>
          )}

          <div className="trends-tabs">
            <button 
              className={`trends-tab-btn ${activeChart === 'sum' ? 'active' : ''}`}
              onClick={() => setActiveChart('sum')}
            >
              <span>📊</span> Tổng điểm
            </button>
            <button 
              className={`trends-tab-btn ${activeChart === 'absence' ? 'active' : ''}`}
              onClick={() => setActiveChart('absence')}
            >
              <span>❄</span> Số vắng
            </button>
            <button 
              className={`trends-tab-btn ${activeChart === 'score' ? 'active' : ''}`}
              onClick={() => setActiveChart('score')}
            >
              <span>🧠</span> Điểm AI V2
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel trends-chart-panel">
        {activeChart === 'sum' && (
          <>
            <div className="trends-chart-title">Biểu đồ xu hướng tổng điểm bộ số chính</div>
            {renderSumChart()}
            <div className="trends-legend">
              <span className="trends-legend-item"><span className="legend-indicator sum-line-dot"></span> Tổng điểm thực tế</span>
              <span className="trends-legend-item"><span className="legend-indicator mean-line-dot"></span> Trung bình ({statsConfig?.sums?.mean || 138})</span>
              <span className="trends-legend-item"><span className="legend-indicator golden-range-dot"></span> Vùng tổng điểm vàng (+/-15)</span>
            </div>
          </>
        )}

        {activeChart === 'absence' && (
          <>
            <div className="trends-chart-title">Biểu đồ số kỳ quay liên tiếp chưa về (Độ lạnh của các con số)</div>
            {renderAbsenceChart()}
            <div className="trends-legend">
              <span className="trends-legend-item"><span className="legend-indicator normal-bar-dot"></span> Đang ổn định (Vắng &lt; 15% số kỳ)</span>
              <span className="trends-legend-item"><span className="legend-indicator cold-bar-dot"></span> Đang vắng cực lâu (Số lạnh vắng sâu)</span>
            </div>
          </>
        )}

        {activeChart === 'score' && (
          <>
            <div className="trends-chart-title">Biểu đồ biến thiên điểm số AI V2 của kết quả trúng thưởng</div>
            {renderScoreChart()}
            <div className="trends-legend">
              <span className="trends-legend-item"><span className="legend-indicator score-line-dot"></span> Điểm Heuristic V2 thực tế</span>
              <span className="trends-legend-item"><span className="legend-indicator excellent-dot"></span> Kỳ quay đạt điểm xuất sắc (&gt;=10đ)</span>
            </div>
          </>
        )}
      </div>

      {/* Floating Tooltip Component */}
      {hoveredPoint && (
        <div 
          className="trends-tooltip-portal glass-panel"
          style={{
            position: 'absolute',
            left: `${hoveredPoint.x}px`,
            top: `${hoveredPoint.y}px`,
            pointerEvents: 'none',
            zIndex: 9999
          }}
        >
          {hoveredPoint.type === 'sum' && (
            <div className="trends-tooltip-content">
              <div className="tooltip-title">Kỳ quay #{hoveredPoint.data.drawIdStr}</div>
              <div className="tooltip-date">Ngày: {hoveredPoint.data.dateStr}</div>
              <div className="tooltip-value highlight-red">Tổng điểm: <strong>{hoveredPoint.data.sum}</strong></div>
              <div className="tooltip-value">
                Vùng vàng: {
                  (hoveredPoint.data.sum >= (statsConfig?.sums?.mean || 138) - 15 && 
                   hoveredPoint.data.sum <= (statsConfig?.sums?.mean || 138) + 15) ? (
                    <span className="badge-pass">✓ Đạt chuẩn</span>
                  ) : (
                    <span className="badge-fail">✗ Lệch chuẩn</span>
                  )
                }
              </div>
              <div className="tooltip-balls">
                {hoveredPoint.data.numbers.map((n, i) => <span key={i} className="tooltip-ball">{n}</span>)}
              </div>
            </div>
          )}

          {hoveredPoint.type === 'absence' && (
            <div className="trends-tooltip-content">
              <div className="tooltip-title highlight-teal">Số chính: {String(hoveredPoint.data.num).padStart(2, '0')}</div>
              <div className="tooltip-value">Số kỳ vắng: <strong>{hoveredPoint.data.count}</strong> kỳ</div>
              <div className="tooltip-value">
                Trạng thái: {
                  hoveredPoint.data.count >= Math.max(12, Math.round(visibleResults.length * 0.15)) ? (
                    <span className="badge-cold">❄ Số lạnh sâu</span>
                  ) : (
                    <span className="badge-normal">✓ Bình thường</span>
                  )
                }
              </div>
            </div>
          )}

          {hoveredPoint.type === 'score' && (
            <div className="trends-tooltip-content">
              <div className="tooltip-title">Kỳ quay #{hoveredPoint.data.drawIdStr}</div>
              <div className="tooltip-date">Ngày: {hoveredPoint.data.dateStr}</div>
              <div className="tooltip-value highlight-gold">Điểm AI V2: <strong>{hoveredPoint.data.score}/13</strong></div>
              <div className="tooltip-reasons">
                {hoveredPoint.data.reasons.length > 0 ? (
                  hoveredPoint.data.reasons.map((r, i) => (
                    <span key={i} className="tooltip-reason-pill">✓ {r.text}</span>
                  ))
                ) : (
                  <span className="tooltip-reason-pill neutral">Không đạt quy tắc nào</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrendAnalysisPanel;
