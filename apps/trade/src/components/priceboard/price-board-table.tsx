import { forwardRef, type ForwardedRef, type MutableRefObject, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { List, type ListImperativeAPI, type RowComponentProps, useListRef } from 'react-window';
import type { PriceBoardRow } from './price-board-types';
import { PriceBoardRow as BoardRow } from './price-board-row';
import { PriceBoardTableHeader } from './price-board-table-header';

export type PriceBoardTableProps = {
  displayRows: PriceBoardRow[];
  pinnedSymbols: string[];
  highlightedSymbol: string | null;
  onTogglePin: (symbol: string) => void;
};

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 44;
const TABLE_MIN_WIDTH = 1180;

export type PriceBoardTableHandle = {
  scrollToSymbol: (symbol: string) => void;
};

type VirtualRowData = {
  rows: PriceBoardRow[];
  highlightedSymbol: string | null;
  onTogglePin: (symbol: string) => void;
};

function VirtualRow({
  index,
  style,
  rows,
  highlightedSymbol,
  onTogglePin,
}: RowComponentProps<VirtualRowData>) {
  const row = rows[index];
  if (!row) return null;
  return (
    <div style={style as CSSProperties}>
      <BoardRow
        key={row.symbol}
        row={row}
        isPinned={false}
        isHighlighted={highlightedSymbol === row.symbol}
        onTogglePin={() => onTogglePin(row.symbol)}
      />
    </div>
  );
}

const PriceBoardTableInner = (
  { displayRows, pinnedSymbols, highlightedSymbol, onTogglePin }: PriceBoardTableProps,
  ref: ForwardedRef<PriceBoardTableHandle>,
) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useListRef(null) as MutableRefObject<ListImperativeAPI | null>;
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const pinnedSet = useMemo(() => new Set(pinnedSymbols), [pinnedSymbols]);

  const pinnedRows = useMemo(
    () => pinnedSymbols.map((symbol) => displayRows.find((r) => r.symbol === symbol)).filter(Boolean) as PriceBoardRow[],
    [displayRows, pinnedSymbols],
  );

  const unpinnedRows = useMemo(
    () => displayRows.filter((r) => !pinnedSet.has(r.symbol)),
    [displayRows, pinnedSet],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      setViewportSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pinnedHeight = pinnedRows.length * ROW_HEIGHT;
  const listHeight = Math.max(
    viewportSize.height - HEADER_HEIGHT - pinnedHeight,
    ROW_HEIGHT,
  );
  const listWidth = Math.max(viewportSize.width, TABLE_MIN_WIDTH);
  const virtualData = useMemo(
    () => ({ rows: unpinnedRows, highlightedSymbol, onTogglePin }),
    [highlightedSymbol, onTogglePin, unpinnedRows],
  );

  useImperativeHandle(ref, () => ({
    scrollToSymbol: (symbol: string) => {
      const index = unpinnedRows.findIndex((row) => row.symbol === symbol);
      if (index < 0) return;
      listRef.current?.scrollToRow({ index, align: 'start', behavior: 'instant' });
    },
  }), [listRef, unpinnedRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-board-bg">
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-hidden overscroll-contain"
      >
        <div className="h-full min-w-[1180px]">
          <PriceBoardTableHeader />
          {pinnedRows.map((row, i) => (
            <BoardRow
              key={row.symbol}
              row={row}
              isPinned
              isHighlighted={highlightedSymbol === row.symbol}
              onTogglePin={() => onTogglePin(row.symbol)}
              showPinnedBandBottom={i === pinnedRows.length - 1 && unpinnedRows.length > 0}
            />
          ))}
          {viewportSize.width > 0 && viewportSize.height > 0 && (
            <List
              listRef={listRef}
              className="price-board-virtual-list"
              style={{ width: listWidth, height: listHeight, overflowX: 'hidden' }}
              rowCount={unpinnedRows.length}
              rowHeight={ROW_HEIGHT}
              rowComponent={VirtualRow}
              rowProps={virtualData}
              overscanCount={4}
              defaultHeight={ROW_HEIGHT}
            >
              {null}
            </List>
          )}
        </div>
      </div>
    </div>
  );
};

export const PriceBoardTable = memo(
  forwardRef<PriceBoardTableHandle, PriceBoardTableProps>(PriceBoardTableInner),
);
