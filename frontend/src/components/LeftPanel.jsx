import React, { useState } from 'react';
import LogsConsole from './LogsConsole';
import ManagementPanel from './ManagementPanel';

function LeftPanel({
  game,
  setGame,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  crawlOnline,
  setCrawlOnline,
  isScraping,
  handleStartScrape,
  scrapedRange,
  handleDownloadExcel,
  logs,
  logContainerRef,
  fetchLatestInfo,
  progress
}) {
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(false);

  return (
    <div className="left-panel-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Control Card */}
      <div className="glass-panel control-card">
        <h2 className="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
            <option value="535">Lotto 5/35 (Hàng ngày)</option>
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

        {/* Nguồn Dữ Liệu Selector */}
        <div className="form-group" style={{ margin: '14px 0 10px 0' }}>
          <label style={{ marginBottom: '6px', display: 'block' }}>Nguồn Dữ Liệu</label>
          <div className="segmented-control" style={{ 
            display: 'flex', 
            background: 'rgba(10, 15, 29, 0.6)', 
            borderRadius: '10px', 
            padding: '4px',
            border: '1px solid var(--border-color)' 
          }}>
            <button
              type="button"
              className={`segment-btn ${!crawlOnline ? 'active' : ''}`}
              onClick={() => setCrawlOnline(false)}
              disabled={isScraping}
              style={{
                flex: 1,
                padding: '10px 8px',
                background: !crawlOnline ? 'var(--secondary, #457b9d)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: !crawlOnline ? '#fff' : 'var(--text-muted)',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>
              </svg>
              Lấy từ DB
            </button>
            <button
              type="button"
              className={`segment-btn ${crawlOnline ? 'active' : ''}`}
              onClick={() => setCrawlOnline(true)}
              disabled={isScraping}
              style={{
                flex: 1,
                padding: '10px 8px',
                background: crawlOnline ? 'var(--primary, #e63946)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: crawlOnline ? '#fff' : 'var(--text-muted)',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Cào mới online
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <button
            className={`btn btn-primary ${isScraping ? 'btn-disabled' : ''}`}
            onClick={handleStartScrape}
            disabled={isScraping}
          >
            {isScraping ? (
              <>
                <svg className="animate-spin" width="20" height="20" fill="none" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang cào dữ liệu...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Bắt đầu cào dữ liệu
              </>
            )}
          </button>

          {scrapedRange && !isScraping && (
            <button
              className="btn btn-secondary"
              onClick={handleDownloadExcel}
              style={{ background: 'rgba(69, 123, 157, 0.2)', border: '1px solid rgba(69, 123, 157, 0.4)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Tải File Excel (.xlsx)
            </button>
          )}
        </div>

        {/* Collapsible Console Log Panel */}
        <div className="terminal-card glass-panel" style={{ background: 'rgba(0,0,0,0.25)', padding: '12px', marginTop: '12px' }}>
          <div 
            className="terminal-header" 
            onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <div className="terminal-dots">
              <span className="terminal-dot dot-red"></span>
              <span className="terminal-dot dot-yellow"></span>
              <span className="terminal-dot dot-green"></span>
            </div>
            <span className="terminal-status" style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>Console Logs</span>
            <button className="collapsible-header-btn" style={{ marginLeft: 'auto' }}>
              <svg 
                className={`terminal-toggle-icon ${isTerminalExpanded ? 'expanded' : ''}`} 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          <div className={`terminal-body-wrapper ${isTerminalExpanded ? 'expanded' : 'collapsed'}`}>
            <LogsConsole logs={logs} logContainerRef={logContainerRef} />
          </div>
        </div>
      </div>

      {/* Manual & CRUD Operations Panel */}
      <ManagementPanel fetchLatestInfo={fetchLatestInfo} onSuccess={handleStartScrape} />
    </div>
  );
}

export default LeftPanel;
