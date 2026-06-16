import React, { useState } from 'react';
import { API_BASE } from '../config';

function ManagementPanel({ fetchLatestInfo, onSuccess }) {
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
          <option value="535">Lotto 5/35</option>
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
  );
}

export default ManagementPanel;
