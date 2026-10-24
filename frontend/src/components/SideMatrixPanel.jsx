import React, { useState } from 'react';
import NumberMatrixGrid from './NumberMatrixGrid';

/**
 * SideMatrixPanel
 * Bảng Ma trận số 8 cột hiển thị cố định ở bên phải khu vực Xem trước dữ liệu
 * Tự động cập nhật theo kỳ quay được chọn (click hoặc phím mũi tên ↑ ↓ / ← →)
 */
function SideMatrixPanel({
  game,
  currentDraw,
  sortedDraws = [],
  onSelectDrawId,
  absenceMap = null,
  statsConfig = null,
  onClose = null
}) {
  const [showAbsence, setShowAbsence] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!currentDraw) {
    return (
      <div 
        className="glass-panel side-matrix-panel empty"
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          borderRadius: '16px'
        }}
      >
        <span>Chưa có dữ liệu kỳ quay để hiển thị ma trận.</span>
      </div>
    );
  }

  const maxNumber = game === '645' ? 45 : (game === '655' ? 55 : 35);
  const gameName = game === '645' ? 'MEGA 6/45' : (game === '655' ? 'POWER 6/55' : 'Lotto 5/35');
  const mainLength = game === '535' ? 5 : 6;
  const isPower = game === '655';
  const isLotto535 = game === '535';

  const numbers = currentDraw.numbers || [];
  const mainNumbers = numbers.slice(0, mainLength);
  const bonusNumber = isPower ? numbers[6] : (isLotto535 ? numbers[5] : null);

  // Tìm index hiện tại trong danh sách sortedDraws (mới nhất -> cũ nhất)
  const currentIndex = sortedDraws.findIndex(d => d.drawId === currentDraw.drawId);
  const hasOlder = currentIndex < sortedDraws.length - 1; // cũ hơn (bấm sang kỳ trước)
  const hasNewer = currentIndex > 0; // mới hơn (bấm sang kỳ sau)

  const handlePrevDraw = () => {
    if (hasOlder && onSelectDrawId) {
      onSelectDrawId(sortedDraws[currentIndex + 1].drawId);
    }
  };

  const handleNextDraw = () => {
    if (hasNewer && onSelectDrawId) {
      onSelectDrawId(sortedDraws[currentIndex - 1].drawId);
    }
  };

  const handleCopyNumbers = () => {
    let text = mainNumbers.join(' ');
    if (bonusNumber) {
      text += ` | ${bonusNumber}`;
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Tính thống kê nhanh của kỳ quay này
  const mainNumsInt = mainNumbers.map(n => parseInt(n, 10));
  const sum = mainNumsInt.reduce((a, b) => a + b, 0);
  const oddCount = mainNumsInt.filter(n => n % 2 !== 0).length;
  const evenCount = mainNumsInt.length - oddCount;
  const midPoint = game === '645' ? 23 : (game === '655' ? 28 : 18);
  const lowCount = mainNumsInt.filter(n => n < midPoint).length;
  const highCount = mainNumsInt.length - lowCount;

  // Lấy thông tin Jackpot của kỳ này
  let jackpotText = '';
  if (currentDraw.prizes && Array.isArray(currentDraw.prizes)) {
    const jp = currentDraw.prizes.find(p => p.name && p.name.toLowerCase().includes('jackpot'));
    if (jp && jp.valueStr) {
      jackpotText = jp.valueStr;
    }
  }

  return (
    <div 
      className="glass-panel side-matrix-panel"
      style={{
        position: 'sticky',
        top: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
        borderRadius: '16px',
        background: 'linear-gradient(180deg, rgba(20, 27, 45, 0.85) 0%, rgba(10, 15, 29, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(16px)',
        zIndex: 10
      }}
    >
      {/* 1. Header Bar: Tiêu đề + Game Badge + Phím tắt hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'radial-gradient(circle at 30% 30%, var(--primary), #9e1c27)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(230, 57, 70, 0.35)',
              flexShrink: 0
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '800', fontSize: '0.98rem', color: '#fff', letterSpacing: '0.3px' }}>
                Bảng Ma Trận Số
              </span>
              <span className={`badge ${game === '645' ? 'badge-mega' : 'badge-power'}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                {gameName}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Quy cách 8 số/dòng • 1 đến {maxNumber}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Phím tắt badge */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.7rem',
              color: 'var(--accent)',
              background: 'rgba(168, 218, 220, 0.1)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(168, 218, 220, 0.2)'
            }}
            title="Dùng phím mũi tên Lên/Xuống trên bàn phím để chuyển kỳ nhanh"
          >
            <kbd style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 5px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>↑</kbd>
            <kbd style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 5px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>↓</kbd>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-muted)',
                borderRadius: '8px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.2rem',
                lineHeight: 1,
                transition: 'all 0.2s',
                padding: 0
              }}
              title="Đóng bảng ma trận (Xem toàn màn hình bảng kết quả)"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(230, 57, 70, 0.2)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = 'rgba(230, 57, 70, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Controls: Nút Kỳ trước, Dropdown chọn kỳ, Nút Kỳ sau */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '6px 8px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        <button
          onClick={handlePrevDraw}
          disabled={!hasOlder}
          style={{
            background: hasOlder ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: hasOlder ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
            color: hasOlder ? '#fff' : 'var(--text-dimmed)',
            cursor: hasOlder ? 'pointer' : 'not-allowed',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.78rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease'
          }}
          title="Xem kỳ quay cũ hơn (Phím ↓)"
        >
          ◀ Trước
        </button>

        <select
          value={currentDraw.drawId}
          onChange={(e) => onSelectDrawId && onSelectDrawId(parseInt(e.target.value, 10))}
          style={{
            flex: 1,
            background: 'rgba(10, 15, 29, 0.95)',
            border: '1px solid rgba(230, 57, 70, 0.4)',
            color: '#fff',
            borderRadius: '6px',
            padding: '6px 8px',
            fontSize: '0.82rem',
            fontWeight: '700',
            cursor: 'pointer',
            textAlign: 'center',
            outline: 'none',
            maxWidth: '200px'
          }}
        >
          {sortedDraws.map((d) => (
            <option key={d.drawId} value={d.drawId}>
              #{d.drawIdStr} - {d.dateStr}
            </option>
          ))}
        </select>

        <button
          onClick={handleNextDraw}
          disabled={!hasNewer}
          style={{
            background: hasNewer ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: hasNewer ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
            color: hasNewer ? '#fff' : 'var(--text-dimmed)',
            cursor: hasNewer ? 'pointer' : 'not-allowed',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '0.78rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease'
          }}
          title="Xem kỳ quay mới hơn (Phím ↑)"
        >
          Sau ▶
        </button>
      </div>

      {/* 3. Thẻ tóm tắt kỳ đang xem: Số kỳ, ngày quay, bóng kết quả, nút copy */}
      <div 
        style={{
          background: 'rgba(230, 57, 70, 0.08)',
          border: '1px solid rgba(230, 57, 70, 0.25)',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Đang xem kết quả kỳ:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--accent)' }}>
                #{currentDraw.drawIdStr}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: '600' }}>
                ({currentDraw.dateStr})
              </span>
            </div>
          </div>

          <button
            onClick={handleCopyNumbers}
            style={{
              background: copied ? 'rgba(46, 196, 182, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: copied ? '1px solid rgba(46, 196, 182, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: copied ? '#2ec4b6' : 'var(--text-muted)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
            title="Sao chép toàn bộ bộ số"
          >
            {copied ? '✓ Đã chép' : 'Sao chép'}
          </button>
        </div>

        {/* Dãy bóng kết quả */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', paddingTop: '4px' }}>
          {mainNumbers.map((num, i) => (
            <div key={i} className="ball-wrapper" style={{ width: '32px' }}>
              <span className="ball" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                {num}
              </span>
            </div>
          ))}
          {bonusNumber && (
            <>
              <span style={{ color: 'var(--border-color)', fontSize: '1.2rem', margin: '0 2px' }}>|</span>
              <div className="ball-wrapper" style={{ width: '32px' }}>
                <span className="ball power-bonus" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                  {bonusNumber}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Toolbar: Toggle hiện chu kỳ vắng */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Lưới số trúng thưởng:
        </span>
        {absenceMap && (
          <button
            onClick={() => setShowAbsence(!showAbsence)}
            style={{
              background: showAbsence ? 'rgba(46, 196, 182, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: showAbsence ? '1px solid rgba(46, 196, 182, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: showAbsence ? '#2ec4b6' : 'var(--text-muted)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
            title="Bật/Tắt hiển thị số kỳ vắng mặt dưới mỗi con số trong ma trận"
          >
            {showAbsence ? '✓ Hiện kỳ vắng' : 'Ẩn kỳ vắng'}
          </button>
        )}
      </div>

      {/* 5. Khối Ma Trận Số 8 Cột (NumberMatrixGrid) */}
      <div 
        style={{
          background: 'rgba(10, 15, 29, 0.75)',
          padding: '16px 8px',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: 'inset 0 2px 12px rgba(0, 0, 0, 0.4)',
          overflowX: 'auto'
        }}
      >
        <NumberMatrixGrid
          game={game}
          numbers={currentDraw.numbers}
          compact={true}
          absenceMap={absenceMap}
          showAbsence={showAbsence}
        />
      </div>

      {/* 6. Chú thích màu sắc (Legend) */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '14px',
          fontSize: '0.74rem',
          color: 'var(--text-muted)',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span 
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #e63946, #c1121f)',
              display: 'inline-block',
              boxShadow: '0 0 6px rgba(230,57,70,0.8)'
            }}
          />
          <span>Trúng thưởng</span>
        </div>

        {bonusNumber && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span 
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 30% 30%, #ffd166, #f3a712)',
                display: 'inline-block',
                boxShadow: '0 0 6px rgba(255,183,3,0.8)'
              }}
            />
            <span>Đặc biệt (Bonus)</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span 
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'inline-block'
            }}
          />
          <span>Không về</span>
        </div>
      </div>

      {/* 7. Chỉ số thống kê nhanh của kỳ này (Quick Stats Summary) */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '10px',
          padding: '10px 8px',
          textAlign: 'center'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Tổng số</span>
          <strong style={{ fontSize: '0.95rem', color: '#fff' }}>{sum}</strong>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Chẵn / Lẻ</span>
          <strong style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>{evenCount}C - {oddCount}L</strong>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Thấp / Cao</span>
          <strong style={{ fontSize: '0.85rem', color: '#ffd166' }}>{lowCount}T - {highCount}C</strong>
        </div>
      </div>

      {/* 8. Gợi ý điều hướng */}
      <div 
        style={{
          fontSize: '0.7rem',
          color: 'var(--text-dimmed)',
          textAlign: 'center',
          lineHeight: '1.4',
          fontStyle: 'italic'
        }}
      >
        💡 Nhấp chuột vào bất kỳ hàng nào trong bảng hoặc dùng phím mũi tên <kbd style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>↑</kbd> <kbd style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>↓</kbd> để chuyển nhanh kỳ quay.
      </div>
    </div>
  );
}

export default SideMatrixPanel;

