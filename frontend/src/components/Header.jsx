import React from 'react';

function Header({ game, latestInfo }) {
  const getGameName = () => {
    if (game === '645') return 'Mega 6/45';
    if (game === '655') return 'Power 6/55';
    if (game === '535') return 'Lotto 5/35';
    return '';
  };

  return (
    <header className="app-header responsive-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
      <div className="app-title-group" style={{ display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <svg className="app-logo" width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#e63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="#e63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="#e63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ letterSpacing: '-0.5px' }}>SCRAPER</span>
        </h1>
        <p className="header-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
          Hệ thống quản lý dữ liệu xổ số chuyên nghiệp
        </p>
      </div>

      {latestInfo && (
        <div className="glass-panel live-badge-chip" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '6px 12px', 
          borderRadius: '20px', 
          fontSize: '0.85rem',
          border: '1px solid rgba(230, 57, 70, 0.25)',
          background: 'rgba(230, 57, 70, 0.05)'
        }}>
          <span className="pulse-dot"></span>
          <span style={{ color: 'var(--text-muted)' }}>Mới nhất ({getGameName()}):</span>
          <strong style={{ color: 'var(--primary)' }}>#{latestInfo.drawId}</strong>
          <span style={{ color: 'var(--text-dimmed)', fontSize: '0.75rem' }}>({latestInfo.dateStr})</span>
        </div>
      )}
    </header>
  );
}

export default Header;
