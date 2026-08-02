import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../config';
import './PredictionV2Panel.css'; // Sẽ tạo file CSS riêng để tách biệt style

function PredictionV2Panel({ 
  game, 
  visibleResults,
  statsConfig,
  generatedTickets, 
  setGeneratedTickets, 
  ticketCount, 
  setTicketCount 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [searchTicketQuery, setSearchTicketQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [generateProgress, setGenerateProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [targetScore, setTargetScore] = useState(8); // Default to 8 points
  const [activeFilters, setActiveFilters] = useState({
    sum: false,
    consecutive: false,
    pairs: false,
    hotCold: false,
    oddEven: false,
    lowHigh: false,
    prime: false,
    tail: false,
    spread: false
  });
  const [copyStatusId, setCopyStatusId] = useState(null);

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
          : (ticket.specialNumber ? parseInt(ticket.specialNumber, 10) === partInt : false);
        return inMain || inSpecial;
      });
    });
  }, [generatedTickets, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Map of number -> current absent draws
  const absencesMap = useMemo(() => {
    if (visibleResults.length === 0) return {};
    
    const map = {};
    const reversedResults = [...visibleResults].sort((a, b) => b.drawId - a.drawId);
    
    for (let i = 1; i <= maxNum; i++) {
      const numStr = String(i).padStart(2, '0');
      const idx = reversedResults.findIndex(draw => {
        const checkLength = game === '535' ? 5 : 6;
        const mainNums = draw.numbers ? draw.numbers.slice(0, checkLength).map(n => parseInt(n, 10)) : [];
        return mainNums.includes(i);
      });
      map[numStr] = idx !== -1 ? idx : visibleResults.length;
    }
    
    // For Special numbers (if game is 655 or 535)
    if (game === '655') {
      for (let i = 1; i <= 55; i++) {
        const numStr = String(i).padStart(2, '0');
        const idx = reversedResults.findIndex(draw => {
          if (!draw.numbers || draw.numbers.length <= 6) return false;
          return parseInt(draw.numbers[6], 10) === i;
        });
        map[`sp_${numStr}`] = idx !== -1 ? idx : visibleResults.length;
      }
    } else if (game === '535') {
      for (let i = 1; i <= 12; i++) {
        const numStr = String(i).padStart(2, '0');
        const idx = reversedResults.findIndex(draw => {
          if (!draw.numbers || draw.numbers.length <= 5) return false;
          return parseInt(draw.numbers[5], 10) === i;
        });
        map[`sp_${numStr}`] = idx !== -1 ? idx : visibleResults.length;
      }
    }
    
    return map;
  }, [visibleResults, game, maxNum]);

  // States for custom ticket scoring
  const [numbersInput, setNumbersInput] = useState('');
  const [specialInput, setSpecialInput] = useState('');
  const [customScoreResult, setCustomScoreResult] = useState(null);
  const [scoreError, setScoreError] = useState('');

  // Reset custom scoring states on game change
  useEffect(() => {
    setNumbersInput('');
    setSpecialInput('');
    setCustomScoreResult(null);
    setScoreError('');
  }, [game]);

  const handleScoreCustomTicket = () => {
    setScoreError('');
    setCustomScoreResult(null);

    if (!statsConfig) {
      setScoreError('Dữ liệu mô hình AI chưa được tải xong.');
      return;
    }

    // Parse main numbers
    const parts = numbersInput.trim().split(/[\s,.-]+/).filter(Boolean);
    const parsedNums = parts.map(n => parseInt(n, 10)).filter(n => !isNaN(n));

    // Validate main numbers length
    if (parsedNums.length !== mainLength) {
      setScoreError(`Bộ số chính phải có đúng ${mainLength} số.`);
      return;
    }

    // Validate boundaries and uniqueness
    const seen = new Set();
    for (const num of parsedNums) {
      if (num < 1 || num > maxNum) {
        setScoreError(`Các số chính phải nằm trong khoảng từ 01 đến ${String(maxNum).padStart(2, '0')}.`);
        return;
      }
      if (seen.has(num)) {
        setScoreError('Các số chính không được trùng lặp.');
        return;
      }
      seen.add(num);
    }

    // Sort ascending
    const sortedNums = [...parsedNums].sort((a, b) => a - b);

    // Parse special number if applicable
    let specialNumParsed = null;
    if (game === '655' || game === '535') {
      const specTrim = specialInput.trim();
      if (!specTrim) {
        setScoreError('Vui lòng nhập số đặc biệt (Số Bonus).');
        return;
      }
      const num = parseInt(specTrim, 10);
      if (isNaN(num)) {
        setScoreError('Số đặc biệt phải là một số.');
        return;
      }
      const maxSpec = game === '655' ? 55 : 12;
      if (num < 1 || num > maxSpec) {
        setScoreError(`Số đặc biệt phải nằm trong khoảng từ 01 đến ${String(maxSpec).padStart(2, '0')}.`);
        return;
      }
      if (game === '655' && sortedNums.includes(num)) {
        setScoreError('Số đặc biệt không được trùng với các số chính.');
        return;
      }
      specialNumParsed = num;
    }

    // Score the ticket
    const { score, reasons } = scoreTicket(sortedNums, statsConfig);

    // Filter unique reasons
    const uniqueReasons = [];
    const seenReasonTexts = new Set();
    reasons.forEach(r => {
      if (!seenReasonTexts.has(r.text)) {
        seenReasonTexts.add(r.text);
        uniqueReasons.push(r);
      }
    });

    setCustomScoreResult({
      numbers: sortedNums.map(n => String(n).padStart(2, '0')),
      specialNumber: specialNumParsed !== null ? String(specialNumParsed).padStart(2, '0') : null,
      score,
      reasons: uniqueReasons
    });
  };

  // Compute average score dynamically from draws in preview data
  const avgScore = useMemo(() => {
    if (!visibleResults || visibleResults.length === 0 || !statsConfig) return 8;
    const mainLength = game === '535' ? 5 : 6;
    let totalScore = 0;
    let countedDraws = 0;

    visibleResults.forEach(draw => {
      if (!draw.numbers || draw.numbers.length < mainLength) return;
      const nums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10)).sort((a, b) => a - b);
      const { score } = scoreTicket(nums, statsConfig);
      totalScore += score;
      countedDraws++;
    });

    if (countedDraws === 0) return 8;
    return Math.round(totalScore / countedDraws);
  }, [visibleResults, statsConfig, game]);

  // Synchronize targetScore when avgScore updates
  useEffect(() => {
    setTargetScore(avgScore);
  }, [avgScore]);

  const generateRandomTicket = () => {
    const nums = new Set();
    while (nums.size < mainLength) {
      const r = Math.floor(Math.random() * maxNum) + 1;
      nums.add(r);
    }
    const sorted = Array.from(nums).sort((a, b) => a - b);
    return sorted;
  };

  function scoreTicket(ticketNums, config) {
    if (!config || !config.sums || !config.topPairs || !config.hot || !config.cold) {
      return { score: 0, reasons: [] };
    }
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
  }

  // Handle generation of smart tickets (Parallel Multi-threaded Web Workers to prevent UI locking and boost speed)
  const handleGenerateV2 = () => {
    if (!statsConfig) return;
    setIsGenerating(true);
    setGenerateProgress(0);
    setGeneratedTickets([]);

    const numCandidates = Math.max(10000, Math.floor(ticketCount * 1.15));

    // Inline Web Worker script for heuristic candidate evaluation
    const workerCodeV2 = `
      self.onmessage = function(e) {
        const { count, statsConfig, game, maxNum, mainLength, ticketCount, targetScore, activeFilters } = e.data;

        // Helper functions inside worker
        const generateRandomTicket = () => {
          const nums = new Set();
          while (nums.size < mainLength) {
            const r = Math.floor(Math.random() * maxNum) + 1;
            nums.add(r);
          }
          return Array.from(nums).sort((a, b) => a - b);
        };

        const checkTicketFilters = (ticketNums, config, activeFilters) => {
          if (activeFilters.sum) {
            const sum = ticketNums.reduce((a, b) => a + b, 0);
            const mean = config.sums.mean || (game === '645' ? 138 : (game === '655' ? 168 : 90));
            if (!(sum >= mean - 15 && sum <= mean + 15)) return false;
          }

          if (activeFilters.consecutive) {
            let consecutiveCount = 0;
            for (let i = 0; i < ticketNums.length - 1; i++) {
              if (ticketNums[i + 1] - ticketNums[i] === 1) consecutiveCount++;
            }
            if (!(consecutiveCount === 1 || consecutiveCount === 2)) return false;
          }

          if (activeFilters.pairs) {
            let foundPair = false;
            const top15Pairs = config.topPairs ? config.topPairs.slice(0, 15) : [];
            for (let i = 0; i < ticketNums.length; i++) {
              for (let j = i + 1; j < ticketNums.length; j++) {
                const p1 = ticketNums[i] + '-' + ticketNums[j];
                if (top15Pairs.includes(p1)) {
                  foundPair = true;
                  break;
                }
              }
              if (foundPair) break;
            }
            if (!foundPair) return false;
          }

          if (activeFilters.hotCold) {
            let hotCount = 0;
            let coldCount = 0;
            const hotList = config.hot || [];
            const coldList = config.cold || [];
            ticketNums.forEach(n => {
              const nStr = String(n).padStart(2, '0');
              if (hotList.slice(0, 8).includes(nStr)) hotCount++;
              if (coldList.slice(0, 5).includes(nStr)) coldCount++;
            });
            const isHotColdSatisfied = (hotCount >= 1 && hotCount <= 3) || coldCount === 1;
            if (!isHotColdSatisfied) return false;
          }

          if (activeFilters.oddEven) {
            const oddCount = ticketNums.filter(n => n % 2 !== 0).length;
            const isBalanced = (mainLength === 6 && oddCount >= 2 && oddCount <= 4) || (mainLength === 5 && oddCount >= 2 && oddCount <= 3);
            if (!isBalanced) return false;
          }

          if (activeFilters.lowHigh) {
            const midPoint = game === '645' ? 23 : (game === '655' ? 28 : 18);
            const lowCount = ticketNums.filter(n => n < midPoint).length;
            const highCount = ticketNums.length - lowCount;
            const isLowHighBalanced = (mainLength === 6 && lowCount >= 2 && lowCount <= 4) || (mainLength === 5 && lowCount >= 2 && lowCount <= 3);
            if (!isLowHighBalanced) return false;
          }

          if (activeFilters.prime) {
            const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53]);
            const primeCount = ticketNums.filter(n => primes.has(n)).length;
            if (!(primeCount >= 1 && primeCount <= 3)) return false;
          }

          if (activeFilters.tail) {
            const tails = ticketNums.map(n => n % 10);
            const tailCounts = {};
            tails.forEach(t => { tailCounts[t] = (tailCounts[t] || 0) + 1; });
            const maxTailRep = Math.max.apply(null, Object.values(tailCounts));
            if (maxTailRep !== 2) return false;
          }

          if (activeFilters.spread) {
            const minVal = ticketNums[0];
            const maxVal = ticketNums[ticketNums.length - 1];
            const spread = maxVal - minVal;
            const minSpread = game === '645' ? 20 : (game === '655' ? 25 : 15);
            if (spread < minSpread) return false;
          }

          return true;
        };

        const scoreTicket = (ticketNums, config) => {
          let score = 0;

          // 1. Sum Rule (Bell Curve)
          const sum = ticketNums.reduce((a, b) => a + b, 0);
          const mean = config.sums.mean || (game === '645' ? 138 : (game === '655' ? 168 : 90));
          if (sum >= mean - 15 && sum <= mean + 15) {
            score += 3;
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
          } else if (consecutiveCount === 2) {
            score += 1;
          } else if (consecutiveCount >= 3) {
            score -= 3;
          }

          // 3. Association Rule (Pairs)
          const top15Pairs = config.topPairs.slice(0, 15);
          for (let i = 0; i < ticketNums.length; i++) {
            for (let j = i + 1; j < ticketNums.length; j++) {
              const p1 = ticketNums[i] + '-' + ticketNums[j];
              if (top15Pairs.includes(p1)) {
                score += 2;
              }
            }
          }

          // 4. Hot/Cold frequencies
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
          }

          // 5. Odd/Even ratio
          const oddCount = ticketNums.filter(n => n % 2 !== 0).length;
          const isBalanced = (mainLength === 6 && oddCount >= 2 && oddCount <= 4) || (mainLength === 5 && oddCount >= 2 && oddCount <= 3);
          if (isBalanced) {
            score += 1;
          } else {
            score -= 2;
          }

          // 6. Low/High Balance Rule
          const midPoint = game === '645' ? 23 : (game === '655' ? 28 : 18);
          const lowCount = ticketNums.filter(n => n < midPoint).length;
          const highCount = ticketNums.length - lowCount;
          const isLowHighBalanced = (mainLength === 6 && lowCount >= 2 && lowCount <= 4) || (mainLength === 5 && lowCount >= 2 && lowCount <= 3);
          if (isLowHighBalanced) {
            score += 1;
          } else if (lowCount === 0 || highCount === 0) {
            score -= 2;
          }

          // 7. Prime Number Rule
          const primes = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53]);
          const primeCount = ticketNums.filter(n => primes.has(n)).length;
          if (primeCount >= 1 && primeCount <= 3) {
            score += 1;
          } else if (primeCount === 0) {
            score -= 1;
          }

          // 8. Tail Digit Repetition Rule
          const tails = ticketNums.map(n => n % 10);
          const tailCounts = {};
          tails.forEach(t => { tailCounts[t] = (tailCounts[t] || 0) + 1; });
          const maxTailRep = Math.max.apply(null, Object.values(tailCounts));
          if (maxTailRep === 2) {
            score += 1;
          } else if (maxTailRep >= 4) {
            score -= 3;
          }

          // 9. Spread Spread Range Check
          const minVal = ticketNums[0];
          const maxVal = ticketNums[ticketNums.length - 1];
          const spread = maxVal - minVal;
          const minSpread = game === '645' ? 20 : (game === '655' ? 25 : 15);
          if (spread >= minSpread) {
            score += 1;
          } else {
            score -= 3;
          }

          return { score };
        };

        const candidates = [];
        let attempts = 0;
        const maxAttempts = count * 200;

        while (candidates.length < count && attempts < maxAttempts) {
          attempts++;
          const nums = generateRandomTicket();
          const { score } = scoreTicket(nums, statsConfig);
          if (score === targetScore && checkTicketFilters(nums, statsConfig, activeFilters)) {
            candidates.push({ nums, score });
          }
        }

        // Fallback in case user set high targetScore and attempts exceeded
        // We relax targetScore, but STILL strictly enforce activeFilters first
        let fallbackAttempts = 0;
        const maxFallbackAttempts = count * 500;
        while (candidates.length < count && fallbackAttempts < maxFallbackAttempts) {
          fallbackAttempts++;
          const nums = generateRandomTicket();
          if (checkTicketFilters(nums, statsConfig, activeFilters)) {
            const { score } = scoreTicket(nums, statsConfig);
            candidates.push({ nums, score });
          }
        }

        // Absolute last resort fallback (only if filters are mathematically impossible to satisfy together)
        while (candidates.length < count) {
          const nums = generateRandomTicket();
          const { score } = scoreTicket(nums, statsConfig);
          candidates.push({ nums, score });
        }

        // Sort descending locally
        candidates.sort((a, b) => b.score - a.score);

        // Keep only top candidates to optimize memory transfer
        const topCandidates = candidates.slice(0, ticketCount);

        self.postMessage({ type: 'done', candidates: topCandidates });
      };
    `;

    // Divide candidate workload among 4 workers
    const numWorkers = 4;
    const parts = [];
    const baseCount = Math.floor(numCandidates / numWorkers);
    const remainder = numCandidates % numWorkers;

    for (let i = 0; i < numWorkers; i++) {
      const count = baseCount + (i === numWorkers - 1 ? remainder : 0);
      if (count > 0) {
        parts.push(count);
      }
    }

    let completedWorkers = 0;
    let allCandidates = [];
    const workerProgresses = Array(parts.length).fill(0);

    const blob = new Blob([workerCodeV2], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const activeWorkers = [];

    parts.forEach((count, index) => {
      const worker = new Worker(workerUrl);
      activeWorkers.push(worker);

      worker.onmessage = (e) => {
        if (e.data.type === 'done') {
          allCandidates = allCandidates.concat(e.data.candidates);
          workerProgresses[index] = count;

          const totalProgress = workerProgresses.reduce((s, v) => s + v, 0);
          setGenerateProgress(totalProgress);

          completedWorkers++;
          if (completedWorkers === parts.length) {
            // Sort merged candidates
            allCandidates.sort((a, b) => b.score - a.score);

            // Select unique candidates
            const finalTickets = [];
            const seenSignatures = new Set();
            
            for (let i = 0; i < allCandidates.length && finalTickets.length < ticketCount; i++) {
              const sig = allCandidates[i].nums.join('-');
              if (!seenSignatures.has(sig)) {
                seenSignatures.add(sig);
                
                let specialStr = null;
                if (game === '655') {
                  let r = Math.floor(Math.random() * 55) + 1;
                  while (allCandidates[i].nums.includes(r)) r = Math.floor(Math.random() * 55) + 1;
                  specialStr = String(r).padStart(2, '0');
                } else if (game === '535') {
                  let r = Math.floor(Math.random() * 12) + 1;
                  specialStr = String(r).padStart(2, '0');
                }

                finalTickets.push({
                  id: finalTickets.length + 1,
                  numbers: allCandidates[i].nums.map(n => String(n).padStart(2, '0')),
                  numValues: allCandidates[i].nums,
                  specialNumber: specialStr,
                  specialValue: specialStr ? parseInt(specialStr, 10) : null,
                  score: allCandidates[i].score
                });
              }
            }

            setGeneratedTickets(finalTickets);
            setSearchTicketQuery('');
            setIsGenerating(false);

            // Clean up
            activeWorkers.forEach(w => w.terminate());
            URL.revokeObjectURL(workerUrl);
          }
        }
      };

      worker.postMessage({
        count,
        statsConfig,
        game,
        maxNum,
        mainLength,
        ticketCount,
        targetScore,
        activeFilters
      });
    });
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Panel 1: Huấn luyện & Sinh Vé AI */}
        <div className="glass-panel v2-control-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
          <div>
            <p className="v2-description" style={{ marginBottom: '16px' }}>
              Thuật toán V2 quét và đánh giá <strong>{Math.max(10000, Math.floor(ticketCount * 1.15)).toLocaleString()} vé ngẫu nhiên</strong> theo các quy luật thực tế: Điểm rơi Toán Học, Tần suất Chẵn/Lẻ, và Ma trận Liên kết. 
            </p>

            {error && <div className="v2-error-banner"><i className="fas fa-exclamation-triangle"></i> {error}</div>}

            <div className="v2-actions" style={{ marginBottom: '16px' }}>
              <div className="v2-input-group">
                <label>Số vé xuất ra (Không giới hạn)</label>
                <div className="v2-input-wrapper">
                  <input 
                    type="number" 
                    min="1"
                    value={ticketCount}
                    onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                  <span className="v2-input-suffix">Vé</span>
                </div>
              </div>

              <div className="v2-input-group">
                <label>Mức điểm tạo bộ số</label>
                <select 
                  className="select-field"
                  value={targetScore}
                  onChange={(e) => setTargetScore(parseInt(e.target.value, 10))}
                  style={{ height: '38px', borderRadius: '10px', background: 'rgba(10, 15, 29, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', padding: '0 12px', fontSize: '0.9rem', outline: 'none' }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(scoreVal => (
                    <option key={scoreVal} value={scoreVal}>
                      Tạo bộ số {scoreVal} điểm {scoreVal === avgScore ? '(Khuyên dùng)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button 
                className={`v2-btn-generate ${isGenerating ? 'generating' : ''}`}
                onClick={handleGenerateV2}
                disabled={isGenerating || !statsConfig}
                style={{ flex: 1, minWidth: '160px' }}
              >
                {isGenerating ? (
                  <><span className="v2-spinner"></span> Đang chấm...</>
                ) : !statsConfig ? (
                  <><span className="v2-spinner"></span> Loading...</>
                ) : (
                  <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Sinh vé AI</>
                )}
                <div className="v2-btn-glow"></div>
              </button>
            </div>

            {isGenerating && (
              <div className="v2-progress-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Quét và lọc ({generateProgress.toLocaleString()} / {Math.max(10000, Math.floor(ticketCount * 1.15)).toLocaleString()}):</span>
                  <span>{Math.round((generateProgress / Math.max(10000, Math.floor(ticketCount * 1.15))) * 100)}%</span>
                </div>
                <div className="v2-progress-bar-bg">
                  <div 
                    className="v2-progress-bar-fill" 
                    style={{ width: `${(generateProgress / Math.max(10000, Math.floor(ticketCount * 1.15))) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <div className="v2-filters-container">
              <span className="v2-filters-title-label">Bộ lọc quy luật AI bắt buộc (Heuristic Filters)</span>
              <div className="v2-filters-grid">
                {[
                  { key: 'sum', label: 'Tổng điểm vàng' },
                  { key: 'consecutive', label: 'Cặp số liền kề' },
                  { key: 'pairs', label: 'Cặp tỷ lệ cao' },
                  { key: 'hotCold', label: 'Số nóng/lạnh chuẩn' },
                  { key: 'oddEven', label: 'Cân bằng Chẵn/Lẻ' },
                  { key: 'lowHigh', label: 'Cân bằng Cao/Thấp' },
                  { key: 'prime', label: 'Chứa số nguyên tố' },
                  { key: 'tail', label: 'Nhịp đuôi đối xứng' },
                  { key: 'spread', label: 'Khoảng cách bộ số' }
                ].map((item) => (
                  <label key={item.key} className={`v2-filter-label ${activeFilters[item.key] ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      className="v2-filter-checkbox-hidden"
                      checked={activeFilters[item.key]}
                      onChange={(e) => setActiveFilters(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      style={{ display: 'none' }}
                    />
                    <div className="v2-custom-checkbox">
                      {activeFilters[item.key] && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      )}
                    </div>
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {statsConfig && (
            <div className="v2-stats-summary" style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="v2-stat-chip">
                <span className="v2-stat-label">Model</span>
                <span className="v2-stat-value">{statsConfig.totalDraws} kỳ</span>
              </div>
              <div className="v2-stat-chip">
                <span className="v2-stat-label">Tổng Tb</span>
                <span className="v2-stat-value">{statsConfig.sums.mean}</span>
              </div>
              <div className="v2-stat-chip">
                <span className="v2-stat-label">Cặp Hot</span>
                <span className="v2-stat-value">{statsConfig.topPairs[0]}</span>
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Chấm Điểm Cá Nhân */}
        <div className="glass-panel v2-control-panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>🔍</span> Chấm Điểm Bộ Số Của Bạn
          </h4>
          <p className="v2-description" style={{ margin: 0, fontSize: '0.8rem' }}>
            Nhập bộ số chính gồm {mainLength} số (ví dụ: {game === '535' ? '05 12 18 20 31' : '05 12 18 20 31 44'}) để kiểm tra điểm Heuristic dựa trên các phân phối thống kê.
          </p>

          {scoreError && <div className="v2-error-banner" style={{ padding: '8px 12px', fontSize: '0.8rem', margin: 0 }}><i className="fas fa-exclamation-triangle"></i> {scoreError}</div>}

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div className="v2-input-group" style={{ flex: 1 }}>
              <label>Bộ số chính ({mainLength} số)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder={game === '535' ? 'Ví dụ: 02 12 19 24 31' : 'Ví dụ: 02 12 19 24 31 44'} 
                value={numbersInput}
                onChange={(e) => setNumbersInput(e.target.value)}
                style={{ height: '38px', fontSize: '0.85rem' }}
              />
            </div>
            
            {(game === '655' || game === '535') && (
              <div className="v2-input-group" style={{ width: '80px' }}>
                <label>Số ĐB</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={game === '655' ? '01-55' : '01-12'} 
                  value={specialInput}
                  onChange={(e) => setSpecialInput(e.target.value)}
                  style={{ height: '38px', textAlign: 'center', fontSize: '0.85rem' }}
                />
              </div>
            )}
          </div>

          <button 
            className="v2-btn-generate"
            onClick={handleScoreCustomTicket}
            disabled={!statsConfig}
            style={{ width: '100%', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>📊</span> Chấm Điểm Ngay
          </button>

          {/* Custom Score Result Display */}
          {customScoreResult && (
            <div style={{ 
              marginTop: '10px', 
              padding: '12px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '8px', 
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kết quả chấm điểm:</span>
                <div className={`v2-score-badge ${customScoreResult.score >= 10 ? 'super-high' : customScoreResult.score >= 8 ? 'high' : 'medium'}`} style={{ margin: 0, padding: '2px 8px', fontSize: '0.75rem' }}>
                  Điểm AI: {customScoreResult.score}/13
                </div>
              </div>

              <div className="v2-ticket-balls" style={{ justifyContent: 'center', gap: '6px', margin: '4px 0' }}>
                {customScoreResult.numbers.map((num, idx) => (
                  <div key={idx} className="v2-ball main" style={{ width: '32px', height: '32px', fontSize: '0.85rem', lineHeight: '32px' }}>
                    {num}
                  </div>
                ))}
                {customScoreResult.specialNumber && (
                  <div className="v2-ball special" style={{ width: '32px', height: '32px', fontSize: '0.85rem', lineHeight: '32px' }}>
                    {customScoreResult.specialNumber}
                  </div>
                )}
              </div>

              <div className="v2-ticket-reasons" style={{ maxHeight: '90px', overflowY: 'auto', gap: '4px', paddingRight: '4px' }}>
                {customScoreResult.reasons.map((r, i) => (
                  <span key={i} className={`v2-reason-pill ${r.type}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                    {r.type === 'success' && '✓ '}
                    {r.type === 'accent' && '✦ '}
                    {r.type === 'primary' && '🔥 '}
                    {r.type === 'warning' && '❄ '}
                    {r.type === 'neutral' && '• '}
                    {r.text}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {generatedTickets.length > 0 && (
        <div className="v2-results-area">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h4 className="v2-results-title" style={{ margin: 0 }}>Top {ticketCount.toLocaleString()} Vé Tối Ưu Nhất (Điểm Sinh Tồn Trực Tiếp)</h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dimmed, #8d99ae)' }}>
                *(Chỉ số nhỏ dưới mỗi bóng hiển thị số kỳ vắng mặt hiện tại)*
              </span>
            </div>
            
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
            {paginatedTickets.map((ticket, index) => {
              // Dynamically evaluate reasons for the paginated page view to avoid memory bloat
              const { reasons } = scoreTicket(ticket.numValues, statsConfig);
              const uniqueReasons = [];
              const seenReasonTexts = new Set();
              reasons.forEach(r => {
                if (!seenReasonTexts.has(r.text)) {
                  seenReasonTexts.add(r.text);
                  uniqueReasons.push(r);
                }
              });

              return (
                <div key={ticket.id} className={`glass-panel v2-ticket-card ${ticket.score >= 10 ? 'super-high' : ticket.score >= 8 ? 'high' : 'medium'}`} style={{animationDelay: `${(index % pageSize) * 0.02}s`}}>
                  <div className="v2-ticket-header">
                    <div className="v2-ticket-id">Phương án #{ticket.id}</div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className={`v2-copy-btn ${copyStatusId === ticket.id ? 'copied' : ''}`}
                        onClick={(e) => {
                          const text = ticket.numbers.join(', ') + (ticket.specialNumber ? ` | ĐB: ${ticket.specialNumber}` : '');
                          navigator.clipboard.writeText(text).then(() => {
                            setCopyStatusId(ticket.id);
                            setTimeout(() => setCopyStatusId(null), 1200);
                          });
                        }}
                        title="Sao chép bộ số"
                      >
                        {copyStatusId === ticket.id ? (
                          <>✓ <span className="v2-copy-tooltip">Đã chép!</span></>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                      </button>

                      <div className={`v2-score-badge ${ticket.score >= 10 ? 'super-high' : ticket.score >= 8 ? 'high' : 'medium'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        Điểm AI: {ticket.score}/13
                      </div>
                    </div>
                  </div>

                  <div className="v2-ticket-balls" style={{ alignItems: 'flex-start' }}>
                    {ticket.numbers.map((num, idx) => {
                      const absCount = absencesMap[num] !== undefined ? absencesMap[num] : 0;
                      let absColor = 'var(--text-muted)';
                      if (absCount >= 20) {
                        absColor = '#e63946'; // Red for long absence (gan)
                      } else if (absCount >= 10) {
                        absColor = '#f4a261'; // Orange
                      }
                      
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div className="v2-ball main">
                            {num}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: absColor, fontWeight: '700' }}>
                            {absCount}
                          </span>
                        </div>
                      );
                    })}
                    {ticket.specialNumber && (() => {
                      const spKey = `sp_${ticket.specialNumber}`;
                      const absCount = absencesMap[spKey] !== undefined ? absencesMap[spKey] : 0;
                      let absColor = 'var(--text-muted)';
                      if (absCount >= 20) absColor = '#e63946';
                      else if (absCount >= 10) absColor = '#f4a261';
                      
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div className="v2-ball special">
                            {ticket.specialNumber}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: absColor, fontWeight: '700' }}>
                            {absCount}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {uniqueReasons.length > 0 && (
                    <div className="v2-ticket-reasons">
                      {uniqueReasons.map((r, i) => (
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
              );
            })}
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
