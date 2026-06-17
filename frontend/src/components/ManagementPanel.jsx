import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

function ManagementPanel({ fetchLatestInfo, onSuccess }) {
  const [mgmtTab, setMgmtTab] = useState('quick'); // 'quick', 'manual', or 'list'
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

  // CRUD states
  const [isEditing, setIsEditing] = useState(false);
  const [editingDrawId, setEditingDrawId] = useState(null);
  const [dbDraws, setDbDraws] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const fetchDbDraws = async () => {
    setIsLoadingList(true);
    try {
      const response = await fetch(`${API_BASE}/api/draws/${mgmtGame}?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setDbDraws(data);
      } else {
        setMgmtMsg({ text: 'Không thể tải danh sách kỳ quay từ database.', type: 'error' });
      }
    } catch (err) {
      setMgmtMsg({ text: `Lỗi tải danh sách: ${err.message}`, type: 'error' });
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (mgmtTab === 'list') {
      fetchDbDraws();
    }
  }, [mgmtTab, mgmtGame]);

  const handleStartEdit = (draw) => {
    setIsEditing(true);
    setEditingDrawId(draw.drawId);
    setMgmtDrawId(String(draw.drawId));
    
    // Parse date from DD/MM/YYYY to YYYY-MM-DD for date input
    if (draw.dateStr) {
      const parts = draw.dateStr.split('/');
      if (parts.length === 3) {
        setMgmtDate(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      }
    }
    
    // Set numbers
    const numCount = mgmtGame === '655' ? 7 : 6;
    const newNums = Array(7).fill('');
    for (let i = 0; i < numCount; i++) {
      newNums[i] = draw.numbers[i] || '';
    }
    setMgmtNumbers(newNums);
    
    // Set prizes
    if (mgmtGame === '645') {
      const jp = draw.prizes.find(p => p.name.toLowerCase().includes('jackpot')) || {};
      const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || {};
      const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || {};
      const g3 = draw.prizes.find(p => p.name.includes('Ba')) || {};
      
      setMgmtJackpotCount(String(jp.count || 0));
      setMgmtJackpotValue(String(jp.value || 0));
      setMgmtG1Count(String(g1.count || 0));
      setMgmtG2Count(String(g2.count || 0));
      setMgmtG3Count(String(g3.count || 0));
    } else if (mgmtGame === '655') {
      const jp1 = draw.prizes.find(p => p.name.includes('Jackpot 1')) || {};
      const jp2 = draw.prizes.find(p => p.name.includes('Jackpot 2')) || {};
      const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || {};
      const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || {};
      const g3 = draw.prizes.find(p => p.name.includes('Ba')) || {};
      
      setMgmtJackpotCount(String(jp1.count || 0));
      setMgmtJackpotValue(String(jp1.value || 0));
      setMgmtJackpot2Count(String(jp2.count || 0));
      setMgmtJackpot2Value(String(jp2.value || 0));
      setMgmtG1Count(String(g1.count || 0));
      setMgmtG2Count(String(g2.count || 0));
      setMgmtG3Count(String(g3.count || 0));
    } else if (mgmtGame === '535') {
      const jp = draw.prizes.find(p => p.name.includes('Giải Độc Đắc')) || draw.prizes.find(p => p.name.includes('Độc Đắc')) || {};
      const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || {};
      const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || {};
      const g3 = draw.prizes.find(p => p.name.includes('Ba')) || {};
      
      setMgmtJackpotCount(String(jp.count || 0));
      setMgmtJackpotValue(String(jp.value || 0));
      setMgmtG1Count(String(g1.count || 0));
      setMgmtG2Count(String(g2.count || 0));
      setMgmtG3Count(String(g3.count || 0));
    }
    
    setMgmtTab('manual');
    setMgmtMsg({ text: `Đang sửa kỳ quay #${draw.drawId}. Hãy chỉnh sửa các trường bên dưới và nhấn Cập nhật.`, type: 'info' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingDrawId(null);
    setMgmtDrawId('');
    setMgmtDate('');
    setMgmtNumbers(Array(7).fill(''));
    setMgmtJackpotCount('0');
    setMgmtJackpot2Count('0');
    setMgmtG1Count('0');
    setMgmtG2Count('0');
    setMgmtG3Count('0');
    setMgmtMsg({ text: '', type: '' });
  };

  const handleDeleteDraw = async (drawId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa kỳ quay #${drawId} không?`)) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/draws/${mgmtGame}/${drawId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (response.ok) {
        setMgmtMsg({ text: data.message || 'Đã xóa thành công!', type: 'success' });
        fetchDbDraws();
        fetchLatestInfo();
        if (onSuccess) onSuccess();
      } else {
        setMgmtMsg({ text: data.error || 'Không thể xóa kỳ quay.', type: 'error' });
      }
    } catch (err) {
      setMgmtMsg({ text: `Lỗi kết nối: ${err.message}`, type: 'error' });
    }
  };

  const parseRawText = (text, currentMgmtGame) => {
    let drawId = '';
    let dateVal = ''; // YYYY-MM-DD
    let numbers = Array(7).fill('');
    let detectedGame = currentMgmtGame;

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Find header info
    lines.forEach(line => {
      const drawMatch = line.match(/#(\d+)/) || line.match(/Kỳ quay thưởng\s+#?(\d+)/i) || line.match(/Kỳ\s+(\d+)/i);
      if (drawMatch) {
        drawId = drawMatch[1];
      }
      const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        dateVal = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
      }
    });

    // Find numbers line (exclude header lines)
    const numLine = lines.find(line => {
      // A line that contains digits, and doesn't contain "Kỳ" or "ngày"
      return /\d/.test(line) && !/kỳ|ngày|thưởng/i.test(line);
    });

    if (numLine) {
      // Parse numbers line
      let mainPart = numLine;
      let specialPart = '';

      if (numLine.includes('|')) {
        const parts = numLine.split('|');
        mainPart = parts[0].trim();
        specialPart = parts[1].trim();
      }

      // Helper to extract 2-digit tokens from a string
      const extractTokens = (str) => {
        const rawTokens = str.split(/[^\d]+/).filter(Boolean);
        const tokens = [];
        rawTokens.forEach(t => {
          if (t.length >= 4 && t.length % 2 === 0) {
            // Split long concatenated digits like 1214181933 into 2-digit chunks
            for (let i = 0; i < t.length; i += 2) {
              tokens.push(t.substring(i, i + 2));
            }
          } else {
            tokens.push(t);
          }
        });
        return tokens;
      };

      const mainNums = extractTokens(mainPart);
      const specialNums = specialPart ? extractTokens(specialPart) : [];

      if (specialNums.length > 0) {
        // Has special number
        if (mainNums.length === 5) {
          detectedGame = '535';
          numbers[0] = mainNums[0] || '';
          numbers[1] = mainNums[1] || '';
          numbers[2] = mainNums[2] || '';
          numbers[3] = mainNums[3] || '';
          numbers[4] = mainNums[4] || '';
          numbers[5] = specialNums[0] || '';
        } else if (mainNums.length === 6) {
          detectedGame = '655';
          numbers[0] = mainNums[0] || '';
          numbers[1] = mainNums[1] || '';
          numbers[2] = mainNums[2] || '';
          numbers[3] = mainNums[3] || '';
          numbers[4] = mainNums[4] || '';
          numbers[5] = mainNums[5] || '';
          numbers[6] = specialNums[0] || '';
        }
      } else {
        // No pipe
        if (mainNums.length === 6) {
          // Check if any number > 35
          const hasHighNum = mainNums.some(n => parseInt(n, 10) > 35);
          if (hasHighNum) {
            detectedGame = '645';
            mainNums.forEach((n, idx) => { if (idx < 6) numbers[idx] = n; });
          } else {
            detectedGame = currentMgmtGame === '535' ? '535' : '645';
            if (detectedGame === '535') {
              numbers[0] = mainNums[0] || '';
              numbers[1] = mainNums[1] || '';
              numbers[2] = mainNums[2] || '';
              numbers[3] = mainNums[3] || '';
              numbers[4] = mainNums[4] || '';
              numbers[5] = mainNums[5] || '';
            } else {
              mainNums.forEach((n, idx) => { if (idx < 6) numbers[idx] = n; });
            }
          }
        } else if (mainNums.length === 7) {
          detectedGame = '655';
          mainNums.forEach((n, idx) => { if (idx < 7) numbers[idx] = n; });
        }
      }
    }

    return { drawId, dateVal, numbers, detectedGame };
  };

  const handleRawPaste = (e) => {
    const text = e.target.value;
    if (!text.trim()) return;
    
    const { drawId, dateVal, numbers, detectedGame } = parseRawText(text, mgmtGame);
    
    if (drawId) setMgmtDrawId(drawId);
    if (dateVal) setMgmtDate(dateVal);
    if (detectedGame) setMgmtGame(detectedGame);
    
    // Fill numbers
    const newNums = [...mgmtNumbers];
    const numCount = detectedGame === '655' ? 7 : 6;
    for (let i = 0; i < numCount; i++) {
      newNums[i] = numbers[i] || '';
    }
    setMgmtNumbers(newNums);
    
    setMgmtMsg({ text: `Đã tự động nhận diện và phân tích: ${detectedGame === '645' ? 'Mega 6/45' : detectedGame === '655' ? 'Power 6/55' : 'Lotto 5/35'} - Kỳ #${drawId || '?'}.`, type: 'success' });
    
    // Clear textarea value to allow subsequent pastes
    e.target.value = '';
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
        if (onSuccess) onSuccess();
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
    
    const numCount = mgmtGame === '655' ? 7 : 6;
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
    } else if (mgmtGame === '655') {
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
    } else if (mgmtGame === '535') {
      prizes = [
        {
          name: 'Giải Độc Đắc',
          matching: 'O O O O O + O',
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
          matching: 'O O O O + O',
          count: parseInt(mgmtG2Count, 10) || 0,
          valueStr: '5.000.000',
          value: 5000000
        },
        {
          name: 'Giải Ba',
          matching: 'O O O O',
          count: parseInt(mgmtG3Count, 10) || 0,
          valueStr: '500.000',
          value: 500000
        },
        {
          name: 'Giải Tư',
          matching: 'O O O + O',
          count: 0,
          valueStr: '100.000',
          value: 100000
        },
        {
          name: 'Giải Năm',
          matching: 'O O O',
          count: 0,
          valueStr: '30.000',
          value: 30000
        },
        {
          name: 'Giải Khuyến Khích',
          matching: 'OO + OO + OO',
          count: 0,
          valueStr: '10.000',
          value: 10000
        }
      ];
    }
    
    setIsSubmittingMgmt(true);
    setMgmtMsg({ text: isEditing ? 'Đang cập nhật kết quả...' : 'Đang lưu kết quả...', type: 'info' });
    try {
      const url = isEditing 
        ? `${API_BASE}/api/draws/${mgmtGame}/${editingDrawId}` 
        : `${API_BASE}/api/draws`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
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
        setIsEditing(false);
        setEditingDrawId(null);
        setMgmtDrawId('');
        setMgmtDate('');
        setMgmtNumbers(Array(7).fill(''));
        setMgmtJackpotCount('0');
        setMgmtJackpot2Count('0');
        setMgmtG1Count('0');
        setMgmtG2Count('0');
        setMgmtG3Count('0');
        fetchLatestInfo();
        if (onSuccess) onSuccess();
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
    <div className="glass-panel control-card" style={{ marginTop: '0' }}>
      <h2 className="section-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Quản lý & Nhập liệu kỳ quay
      </h2>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`tab-btn ${mgmtTab === 'quick' ? 'active' : ''}`}
          onClick={() => { setMgmtTab('quick'); setMgmtMsg({ text: '', type: '' }); if(isEditing) handleCancelEdit(); }}
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
          {isEditing ? `Sửa kỳ quay #${editingDrawId}` : 'Nhập thủ công'}
        </button>
        <button
          type="button"
          className={`tab-btn ${mgmtTab === 'list' ? 'active' : ''}`}
          onClick={() => { setMgmtTab('list'); setMgmtMsg({ text: '', type: '' }); if(isEditing) handleCancelEdit(); }}
          style={{
            background: 'none',
            border: 'none',
            color: mgmtTab === 'list' ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: mgmtTab === 'list' ? '2px solid var(--accent)' : 'none',
            padding: '4px 8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.85rem'
          }}
        >
          Danh sách kỳ quay
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
          <option value="535">Lotto 5/35</option>
        </select>
      </div>

      {mgmtTab === 'quick' && (
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
      )}

      {mgmtTab === 'manual' && (
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Nhập nhanh bằng cách Paste text */}
          <div className="form-group" style={{ marginBottom: '14px', border: '1px dashed rgba(255,255,255,0.12)', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
            <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--accent)', fontWeight: 'bold' }}>
              <span>Dán (Paste) nội dung sao chép</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Tự phân tách loại vé, kỳ quay, ngày, bộ số)</span>
            </label>
            <textarea
              rows="2"
              className="input-field"
              style={{ height: '55px', fontSize: '0.75rem', marginTop: '6px', resize: 'none', padding: '6px 10px', background: 'rgba(0,0,0,0.2)' }}
              placeholder="Dán nội dung sao chép vào đây...&#10;Ví dụ: Kỳ quay thưởng #00708 ngày 17/06/2026&#10;1214181933|06"
              onChange={handleRawPaste}
            />
          </div>

          <div className="form-group">
            <label>Mã Kỳ Quay</label>
            <input
              type="number"
              className="input-field"
              placeholder="Ví dụ: 1190"
              value={mgmtDrawId}
              onChange={(e) => setMgmtDrawId(e.target.value)}
              disabled={isSubmittingMgmt || isEditing}
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
            <label>Bộ Số Trúng Thưởng ({mgmtGame === '645' ? '6 số' : (mgmtGame === '655' ? '6 số chính + 1 số ĐB' : '5 số chính + 1 số ĐB')})</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
              {Array.from({ length: mgmtGame === '645' ? 6 : (mgmtGame === '655' ? 7 : 6) }).map((_, idx) => {
                const isBonus = (mgmtGame === '655' && idx === 6) || (mgmtGame === '535' && idx === 5);
                return (
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
                      border: isBonus ? '1px solid var(--warning)' : '1px solid var(--border-color)',
                      background: isBonus ? 'rgba(255, 183, 3, 0.05)' : 'rgba(255,255,255,0.02)'
                    }}
                    placeholder={isBonus ? 'ĐB' : String(idx + 1)}
                    value={mgmtNumbers[idx] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const newNums = [...mgmtNumbers];
                      newNums[idx] = val;
                      setMgmtNumbers(newNums);
                    }}
                    disabled={isSubmittingMgmt}
                  />
                );
              })}
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

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="submit"
              className={`btn btn-primary ${isSubmittingMgmt ? 'btn-disabled' : ''}`}
              disabled={isSubmittingMgmt}
              style={{ flex: 1 }}
            >
              {isSubmittingMgmt ? 'Đang xử lý...' : isEditing ? 'Cập nhật' : 'Lưu kết quả'}
            </button>
            {isEditing && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
                style={{ flex: 1 }}
              >
                Hủy bỏ
              </button>
            )}
          </div>
        </form>
      )}

      {mgmtTab === 'list' && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              50 kỳ quay gần nhất trong database:
            </span>
            <button 
              type="button" 
              onClick={fetchDbDraws} 
              className="btn btn-secondary" 
              style={{ padding: '2px 8px', fontSize: '0.75rem', height: '24px' }}
              disabled={isLoadingList}
            >
              🔄 Tải lại
            </button>
          </div>
          
          {isLoadingList ? (
            <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Đang tải danh sách...
            </div>
          ) : dbDraws.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              Chưa có dữ liệu nào trong database.
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '6px 8px' }}>Kỳ</th>
                    <th style={{ padding: '6px 8px' }}>Ngày</th>
                    <th style={{ padding: '6px 8px' }}>Bộ Số</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {dbDraws.map((draw) => (
                    <tr key={draw.drawId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>#{draw.drawId}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{draw.dateStr}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                          {draw.numbers.map((n, idx) => {
                            const isBonus = (mgmtGame === '655' && idx === 6) || (mgmtGame === '535' && idx === 5);
                            return (
                              <span 
                                key={idx} 
                                style={{ 
                                  padding: '1px 4px', 
                                  borderRadius: '4px', 
                                  background: isBonus ? 'rgba(255, 183, 3, 0.2)' : 'rgba(255,255,255,0.08)',
                                  color: isBonus ? 'var(--warning)' : 'white',
                                  fontSize: '0.75rem',
                                  border: isBonus ? '1px solid rgba(255, 183, 3, 0.4)' : 'none'
                                }}
                              >
                                {n}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button 
                          type="button"
                          onClick={() => handleStartEdit(draw)}
                          style={{
                            background: 'rgba(74, 150, 236, 0.15)',
                            border: '1px solid rgba(74, 150, 236, 0.3)',
                            color: '#4a96ec',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                        >
                          Sửa
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteDraw(draw.drawId)}
                          style={{
                            background: 'rgba(230, 57, 70, 0.15)',
                            border: '1px solid rgba(230, 57, 70, 0.3)',
                            color: 'var(--error)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.7rem'
                          }}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
  );
}

export default ManagementPanel;
