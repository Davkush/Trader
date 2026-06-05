import React from 'react';
import { X, Volume2, VolumeX, Keyboard, RefreshCw, Smartphone, DollarSign, Percent, AlertTriangle } from 'lucide-react';
import { SystemPreferences } from '../types';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  prefs: SystemPreferences;
  onUpdatePrefs: (fields: Partial<SystemPreferences>) => void;
  onWipeData: () => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  prefs,
  onUpdatePrefs,
  onWipeData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-sm h-full bg-[#171b26] border-l border-[#2a2e39] shadow-2xl flex flex-col z-10 text-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2e39]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100 flex items-center gap-2">
            <span>Terminal Configurations</span>
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[#202431] rounded-md text-gray-400 hover:text-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configurations scroll area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section: Sound Options */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-semibold text-blue-400 uppercase tracking-widest">AUDIO SIGNALS</h3>
            <div className="bg-[#131722] border border-[#2a2e39]/60 rounded-lg p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-200">Sound Effects Enabled</div>
                <div className="text-[10px] text-gray-500">Play feedback beeps on order fills and exits</div>
              </div>
              <button
                onClick={() => onUpdatePrefs({ soundEnabled: !prefs.soundEnabled })}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  prefs.soundEnabled ? 'bg-blue-600/20 border border-blue-500 text-blue-400' : 'bg-gray-800 border border-gray-700 text-gray-500'
                }`}
              >
                {prefs.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Section: Shortcuts */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-semibold text-blue-400 uppercase tracking-widest">KEYBOARD CODES</h3>
            <div className="bg-[#131722] border border-[#2a2e39]/60 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-200">Hotkey Binds Actionable</div>
                  <div className="text-[10px] text-gray-500">Trigger market requests with keys B, S, Space</div>
                </div>
                <button
                  onClick={() => onUpdatePrefs({ hotkeysEnabled: !prefs.hotkeysEnabled })}
                  className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer transition-colors ${
                    prefs.hotkeysEnabled ? 'bg-green-600/20 border border-green-500 text-green-400' : 'bg-gray-800 border border-gray-700 text-gray-500'
                  }`}
                >
                  {prefs.hotkeysEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {prefs.hotkeysEnabled && (
                <div className="pt-2 border-t border-gray-800 space-y-1.5 text-[10px] text-gray-400 font-mono">
                  <div className="flex justify-between"><span>[B] Key</span> <span>BUY Limit order fill</span></div>
                  <div className="flex justify-between"><span>[S] Key</span> <span>SELL Limit order fill</span></div>
                  <div className="flex justify-between"><span>[Space] Link</span> <span>Play / Pause Backtest</span></div>
                  <div className="flex justify-between"><span>[←] / [→]</span> <span>Step Candle Forward</span></div>
                  <div className="flex justify-between"><span>[R] Key</span> <span>Toggle Replay mode</span></div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Balance Engine */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-semibold text-blue-400 uppercase tracking-widest">ACCOUNT SEED</h3>
            <div className="bg-[#131722] border border-[#2a2e39]/60 rounded-lg p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-gray-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" /> Account Net Worth ($)
                </label>
                <input
                  type="number"
                  value={prefs.accountBalance}
                  onChange={(e) => onUpdatePrefs({ accountBalance: Math.max(1, Number(e.target.value)) })}
                  className="w-full bg-[#171b26] border border-[#2a2e39] rounded px-3 py-2 text-xs font-mono font-bold text-gray-105 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-mono text-gray-400 flex items-center gap-1">
                  <Percent className="w-3 h-3 text-amber-500" /> Capital Risk Percentage (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={prefs.riskPercent}
                    onChange={(e) => onUpdatePrefs({ riskPercent: parseFloat(e.target.value) })}
                    className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-gray-850 rounded"
                  />
                  <span className="text-xs font-mono font-bold text-amber-400">{prefs.riskPercent.toFixed(1)}%</span>
                </div>
                <div className="text-[9px] text-gray-500 font-mono leading-tight">
                  Calculates size as ({prefs.riskPercent}% of Balance) per 10pts stop margin.
                </div>
              </div>
            </div>
          </div>

          {/* Wipe Local Cache Storage */}
          <div className="pt-2">
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Wipe Database Memory</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Revert to defaults and restore original settings: clears trade journals, layout states, and starting worth profiles.
              </p>
              <button
                onClick={() => {
                  if (confirm('Verify: Restore all default split chart screens and wipe active state database? This cannot be undone.')) {
                    onWipeData();
                    onClose();
                  }
                }}
                className="w-full bg-rose-900 hover:bg-rose-800 text-white font-semibold text-xs py-2 px-3 rounded cursor-pointer transition-colors active:scale-98"
              >
                Erase Custom Cache
              </button>
            </div>
          </div>
        </div>

        {/* Footer info banner */}
        <div className="bg-[#131722] border-t border-[#2a2e39] py-3 px-4 text-center text-[10px] text-gray-500 font-mono">
          SPLIT-SCREEN TERMINAL v4.6
        </div>
      </div>
    </div>
  );
};
