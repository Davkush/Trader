import React from 'react';
import { History, Download, Trash, ThumbsUp, ThumbsDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Position } from '../types';

interface TradeHistoryProps {
  closedTrades: Position[];
  onClearHistory: () => void;
}

export const TradeHistory: React.FC<TradeHistoryProps> = ({ closedTrades, onClearHistory }) => {
  
  // CSV exporter script
  const handleExportCSV = () => {
    if (closedTrades.length === 0) return;
    
    // Header
    const headers = ['ID', 'Pane ID', 'Symbol', 'Direction', 'Quantity', 'Entry Price', 'Exit Price', 'P&L ($)', 'P&L (%)', 'Exit Time'];
    
    // Records
    const rows = closedTrades.map((t) => [
      t.id,
      t.paneId,
      t.symbol,
      t.direction,
      t.quantity,
      t.entryPrice,
      t.exitPrice || 0,
      t.pnl || 0,
      t.pnlPercent || 0,
      t.exitTime ? new Date(t.exitTime * 1000).toISOString() : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((val) => `"${val}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `trade-journal-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#171b26] border border-[#2a2e39] rounded-xl p-4.5 flex flex-col max-h-[350px]">
      <div className="flex items-center justify-between border-b border-[#2a2e39] pb-2.5 mb-3">
        <div className="flex items-center gap-1.5">
          <History className="w-4 h-4 text-blue-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">TRADE JOURNAL</h3>
        </div>

        {closedTrades.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="p-1 hover:bg-[#202431] rounded-md text-gray-400 hover:text-blue-400 cursor-pointer transition-colors"
              title="Download journal as CSV file"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear your trade history ledger? This will erase all journals.')) {
                  onClearHistory();
                }
              }}
              className="p-1 hover:bg-[#202431] rounded-md text-gray-400 hover:text-rose-400 cursor-pointer transition-colors"
              title="Wipe historical journals"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {closedTrades.length === 0 ? (
        <div className="text-center py-6 text-xs text-gray-550 space-y-1">
          <p>Historical journal ledger empty.</p>
          <p className="text-[10px] text-gray-655 font-mono">Fill entry orders to record metrics.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {closedTrades.slice().reverse().map((trade, i) => {
            const isWin = (trade.pnl || 0) > 0;
            return (
              <div
                key={`${trade.id}-${i}`}
                className={`p-2.5 rounded border text-xs flex items-center justify-between transition-all hover:bg-gray-800/10 ${
                  isWin ? 'bg-emerald-950/10 border-emerald-900/30' : 'bg-rose-950/10 border-rose-900/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[9px] font-mono font-black rounded px-1 py-0.5 uppercase tracking-wide ${
                      trade.direction === 'BUY' ? 'bg-green-600/10 text-green-400' : 'bg-red-600/10 text-red-400'
                    }`}>
                      {trade.direction}
                    </span>
                    <span className="font-bold text-gray-200 tracking-wide">{trade.symbol}</span>
                    <span className="text-[10px] text-gray-500 font-mono">x{trade.quantity}</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500">
                    entry: <strong className="text-gray-400">${trade.entryPrice}</strong>
                    <span className="mx-1">→</span>
                    exit: <strong className="text-gray-400">${trade.exitPrice}</strong>
                  </div>
                </div>

                <div className="text-right space-y-0.5 font-mono">
                  <div className={`font-bold flex items-center justify-end ${isWin ? 'text-emerald-400' : 'text-rose-450'}`}>
                    {isWin ? <ArrowUpRight className="w-3.5 h-3.5 animate-bounce-y mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                    <span>{isWin ? '+' : ''}${trade.pnl?.toFixed(2)}</span>
                  </div>
                  <div className={`text-[10px] ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isWin ? '+' : ''}{trade.pnlPercent?.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
