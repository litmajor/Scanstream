import React, { useRef, useState, useEffect, CSSProperties } from 'react';

interface VirtualListProps<ItemType> {
  items: ItemType[];
  height: number; // viewport height in px
  itemHeight: number; // fixed item height in px
  renderItem: (item: ItemType, index: number) => React.ReactNode;
  overscan?: number;
}

/**
 * Very small virtual list implementation (fixed-height items)
 * - No external deps
 * - Use for large lists where rendering all items causes jank
 * Note: This is intentionally minimal. For production, consider `react-window`.
 */
export function VirtualList<ItemType>({ items, height, itemHeight, renderItem, overscan = 5 }: VirtualListProps<ItemType>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const total = items.length;
  const viewportItems = Math.ceil(height / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(total - 1, startIndex + viewportItems + overscan * 2);

  const offsetY = startIndex * itemHeight;

  const innerStyle: CSSProperties = {
    height: total * itemHeight,
    position: 'relative',
  };

  const itemWrapperStyle: CSSProperties = {
    position: 'absolute',
    top: offsetY,
    left: 0,
    right: 0,
  };

  return (
    <div ref={containerRef} style={{ height, overflow: 'auto' }}>
      <div style={innerStyle}>
        <div style={itemWrapperStyle}>
          {items.slice(startIndex, endIndex + 1).map((it, i) => (
            <div key={startIndex + i} style={{ height: itemHeight, boxSizing: 'border-box' }}>
              {renderItem(it, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VirtualList;
