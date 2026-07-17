import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DrawTable from './DrawTable';
import MobileCards from './MobileCards';
import StatsPanel from './StatsPanel';
import TrendAnalysisPanel from './TrendAnalysisPanel';
import PredictionPanel from './PredictionPanel';
import PredictionV2Panel from './PredictionV2Panel';

function RightPanel({
  activeTab,
  setActiveTab,
  visibleResults,
  filteredResults,
  searchQuery,
  setSearchQuery,
  isScraping,
  progress,
  game,
  calculateDeltas,
  statsConfigV2,
  predictionTickets,
  setPredictionTickets,
  predictionStrategy,
  setPredictionStrategy,
  predictionTicketCount,
  setPredictionTicketCount,
  predictionTicketsV2,
  setPredictionTicketsV2,
  predictionTicketCountV2,
  setPredictionTicketCountV2
}) {
  return (
    <div className="glass-panel preview-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '400px' }}>
      <div className="preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          Xem trước dữ liệu & Phân tích
        </h2>
        {visibleResults.length > 0 && (
          <span className="preview-count" style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            Đã tải {visibleResults.length} kỳ quay
          </span>
        )}
      </div>

      {/* Tab Navigation (Desktop only, hidden on mobile in index.css) */}
      {visibleResults.length > 0 && (
        <div className="tabs-navigation desktop-tabs" style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '16px', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
          paddingBottom: '4px' 
        }}>
          {[
            { id: 'preview', label: 'Xem trước dữ liệu' },
            { id: 'stats', label: 'Thống kê vắng mặt' },
            { id: 'prediction', label: 'Gợi ý số AI' },
            { id: 'prediction-v2', label: 'AI V2 (Scoring)' },
            { id: 'trends', label: 'Phân tích xu hướng' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '3px solid var(--primary)' : '3px solid transparent',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.9rem',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Crawl Progress Bar */}
      {isScraping && (
        <div className="progress-container" style={{ margin: '8px 0 20px 0' }}>
          <div className="progress-info" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
            <span>{progress.message}</span>
            <strong>{progress.percent}% ({progress.progress}/{progress.total})</strong>
          </div>
          <div className="progress-track" style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <div 
              className="progress-bar skeleton-box" 
              style={{ 
                width: `${progress.percent}%`, 
                height: '100%', 
                background: 'linear-gradient(90deg, var(--primary) 0%, var(--warning) 100%)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Tab Content with Framer Motion transitions */}
      <div className="tab-content-wrapper" style={{ flexGrow: 1, position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + '_' + game}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ width: '100%', height: '100%' }}
          >
            {visibleResults.length > 0 ? (
              activeTab === 'preview' ? (
                <>
                  {/* Search Box */}
                  <div className="search-container" style={{ marginBottom: '16px', padding: '0 4px' }}>
                    <div className="input-group" style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        placeholder="Tìm kiếm kỳ quay, ngày, số (ví dụ: 15) hoặc bộ số (ví dụ: 15 23 34)..."
                        className="input-field"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ paddingLeft: '38px', width: '100%', minHeight: '44px' }}
                      />
                      <svg 
                        width="18" 
                        height="18" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5" 
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
                            fontSize: '1.4rem',
                            lineHeight: '1',
                            padding: '4px'
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {searchQuery && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', paddingLeft: '4px' }}>
                        Tìm thấy <strong>{filteredResults.length}</strong> / {visibleResults.length} kỳ quay khớp điều kiện.
                      </div>
                    )}
                  </div>

                  {/* Desktop View */}
                  <DrawTable 
                    game={game} 
                    filteredResults={filteredResults} 
                    calculateDeltas={calculateDeltas} 
                    statsConfig={statsConfigV2}
                  />

                  {/* Mobile View */}
                  <MobileCards 
                    game={game} 
                    filteredResults={filteredResults} 
                    calculateDeltas={calculateDeltas} 
                    statsConfig={statsConfigV2}
                  />
                </>
              ) : activeTab === 'stats' ? (
                <StatsPanel 
                  game={game} 
                  visibleResults={visibleResults} 
                />
              ) : activeTab === 'trends' ? (
                <TrendAnalysisPanel 
                  game={game} 
                  visibleResults={visibleResults} 
                  statsConfig={statsConfigV2}
                />
              ) : activeTab === 'prediction-v2' ? (
                <PredictionV2Panel 
                  game={game} 
                  visibleResults={visibleResults}
                  statsConfig={statsConfigV2}
                  generatedTickets={predictionTicketsV2}
                  setGeneratedTickets={setPredictionTicketsV2}
                  ticketCount={predictionTicketCountV2}
                  setTicketCount={setPredictionTicketCountV2}
                />
              ) : (
                <PredictionPanel 
                  game={game} 
                  visibleResults={visibleResults} 
                  generatedTickets={predictionTickets}
                  setGeneratedTickets={setPredictionTickets}
                  strategy={predictionStrategy}
                  setStrategy={setPredictionStrategy}
                  ticketCount={predictionTicketCount}
                  setTicketCount={setPredictionTicketCount}
                />
              )
            ) : (
              /* Empty State (Skeleton Loading when cào, or instruct user) */
              isScraping ? (
                <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="skeleton-box" style={{ height: '40px', width: '100%' }}></div>
                  <div className="skeleton-box" style={{ height: '80px', width: '100%' }}></div>
                  <div className="skeleton-box" style={{ height: '80px', width: '100%' }}></div>
                  <div className="skeleton-box" style={{ height: '80px', width: '100%' }}></div>
                </div>
              ) : (
                <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
                  <svg className="empty-icon" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--text-dimmed)', marginBottom: '16px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: '700' }}>Chưa có dữ liệu xem trước</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '360px', margin: 0 }}>
                    Chọn loại vé, khoảng ngày bên cột trái và nhấn nút cào để hiển thị bảng dữ liệu trước khi xuất Excel.
                  </p>
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default RightPanel;
