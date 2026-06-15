import React from 'react';

function LogsConsole({ logs, logContainerRef }) {
  return (
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
  );
}

export default LogsConsole;
