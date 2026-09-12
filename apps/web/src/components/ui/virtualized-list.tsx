import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const FALLBACK_VIEWPORT_PX = 480;

export function VirtualizedList({
  count,
  estimateSize,
  overscan = 8,
  className,
  ariaLabel,
  getItemKey,
  children,
}: {
  count: number;
  estimateSize: number;
  overscan?: number;
  className?: string;
  ariaLabel?: string;
  getItemKey?: (index: number) => string | number;
  children: (index: number) => ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey,
    initialRect: { width: 288, height: FALLBACK_VIEWPORT_PX },
    observeElementRect: (instance, callback) => {
      const fire = () => {
        const element = instance.scrollElement as HTMLElement | null;
        callback({
          width: element && element.clientWidth > 0 ? element.clientWidth : 288,
          height: element && element.clientHeight > 0 ? element.clientHeight : FALLBACK_VIEWPORT_PX,
        });
      };
      fire();
      const element = instance.scrollElement as HTMLElement | null;
      if (!element || typeof ResizeObserver === 'undefined') return () => undefined;
      const observer = new ResizeObserver(fire);
      observer.observe(element);
      return () => observer.disconnect();
    },
    measureElement: (element) => {
      const height = element.getBoundingClientRect().height;
      return height > 0 ? height : estimateSize;
    },
  });

  return (
    <div ref={parentRef} className={cn('overflow-y-auto', className)}>
      <div
        role="list"
        aria-label={ariaLabel}
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            role="listitem"
            aria-setsize={count}
            aria-posinset={item.index + 1}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {children(item.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
