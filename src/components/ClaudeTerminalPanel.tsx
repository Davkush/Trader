import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, AlertTriangle, Loader2, Activity } from 'lucide-react';
import { ChartPaneState, CandleData, IndicatorSettings } from '../types';
import { calcSmartSignals } from './TradingChart';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ClaudeTerminalPanelProps {
  pane: ChartPaneState;
  data: CandleData[];
  onUpdatePane: (fields: Partial<ChartPaneState>) => void;
}

export const ClaudeTerminalPanel: React.FC<ClaudeTerminalPanelProps> = ({ pane, data, onUpdatePane }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'You are an elite quantitative AI trading assistant. Your sole purpose is to analyze strategies, propose improvements, run backtests, and maximize the win ratio. Do NOT execute trades or connect to a broker.'
    },
    {
      role: 'assistant',
      content: `Terminal Initialized.\\nAsset: ${pane.symbol}\\nTimeframe: ${pane.timeframe}\\n\\nHow can I assist you with analyzing your strategy, backtesting, or improving your win ratio on ${pane.symbol}?`
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<{params: any, description: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedModel, setSelectedModel] = useState('nvidia/nemotron-3-super-120b-a12b:free');
  
  const runBacktest = (paramsOverride?: any) => {
    const params = paramsOverride || pane.indicators.smartSignalParams;
    if (data.length < 100) {
      setMessages(prev => [...prev, { role: 'system', content: '⚠ Not enough data to backtest (need at least 100 candles).' }]);
      return;
    }
    const signals = calcSmartSignals(data, params);
    let w = 0; let l = 0;
    signals.forEach((sig) => {
      const idx = data.findIndex(d => d?.time === sig.time);
      if (idx > -1 && idx < data.length - 1) {
        for (let i = idx + 1; i < data.length; i++) {
          const c = data[i];
          if (!c) continue;
          if (sig.signal === 'BUY') {
            if (c.high >= sig.tp) { w++; break; }
            if (c.low <= sig.sl) { l++; break; }
          } else {
            if (c.low <= sig.tp) { w++; break; }
            if (c.high >= sig.sl) { l++; break; }
          }
        }
      }
    });
    const resolved = w + l;
    const winRate = resolved > 0 ? ((w / resolved) * 100).toFixed(1) : '0.0';
    setMessages(prev => [...prev, {
      role: 'system',
      content: `📊 Backtest Results (${pane.symbol} ${pane.timeframe}):\n` +
        `• Total signals: ${signals.length}\n` +
        `• Resolved trades: ${resolved}\n` +
        `• Wins: ${w} | Losses: ${l}\n` +
        `• Win Rate: ${winRate}%\n` +
        `• Parameters: EMA ${params.emaFast}/${Math.round(params.emaMed)}/${Math.round(params.emaSlow)}, RSI ${params.rsiLength}`
    }]);
  };

  const runOptimizationLoop = async () => {
    if (isLoading || data.length < 100) return;
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'system', content: 'Starting parameter auto-optimization loop...\nScanning combinations to maximize win rate...' }]);
    
    // Allow UI to update
    await new Promise(r => setTimeout(r, 100));

    let bestParams = { ...pane.indicators.smartSignalParams };
    let bestWinRate = 0;
    
    // Quick grid search or random search for parameter optimization
    // We will do a structured grid to find the best configuration
    const variations = [];
    const emaFasts = [14, 20, 25];
    const rsiLengths = [10, 14, 21];
    const rsiBuyMins = [35, 40, 45];
    const rsiSellMaxs = [55, 60, 65];

    let totalCals = emaFasts.length * rsiLengths.length * rsiBuyMins.length * rsiSellMaxs.length;
    let computed = 0;

    for (const f of emaFasts) {
      for (const rlen of rsiLengths) {
        for (const rmin of rsiBuyMins) {
          for (const rmax of rsiSellMaxs) {
            const p = {
              emaFast: f, emaMed: f * 2.5, emaSlow: f * 4,
              rsiLength: rlen,
              rsiBuyMin: rmin, rsiBuyMax: rmin + 25,
              rsiSellMin: rmax - 25, rsiSellMax: rmax,
              volRatio: 1.1
            };
            
            const signals = calcSmartSignals(data, p);
            let w = 0; let l = 0;
            signals.forEach((sig) => {
              const idx = data.findIndex(d => d?.time === sig.time);
              if (idx > -1 && idx < data.length - 1) {
                for (let i = idx + 1; i < data.length; i++) {
                  const c = data[i];
                  if (!c) continue;
                  if (sig.signal === 'BUY') {
                    if (c.high >= sig.tp) { w++; break; }
                    if (c.low <= sig.sl) { l++; break; }
                  } else {
                    if (c.low <= sig.tp) { w++; break; }
                    if (c.high >= sig.sl) { l++; break; }
                  }
                }
              }
            });
            const resolved = w + l;
            if (resolved > 0) {
              const rate = w / resolved;
              if (rate > bestWinRate) {
                bestWinRate = rate;
                bestParams = { ...p };
              }
            }
            computed++;
          }
        }
      }
    }

    const rateStr = (bestWinRate * 100).toFixed(1) + "%";
    
    if (bestWinRate >= 0.75) {
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Search complete (${computed} iterations).\nFound optimal parameters with ${rateStr} win rate.\nProposing changes below. Click "ACCEPT" to apply.` 
      }]);
      setPendingProposal({
        params: bestParams,
        description: `Local Auto-Optimization Result (${rateStr} Win Rate)`
      });
    } else {
      setMessages(prev => [...prev, { 
        role: 'system', 
        content: `Search complete.\nCould not find a parameter set exceeding 75% win rate (max found: ${rateStr}).\nTry different assets or timeframes.` 
      }]);
    }
    
    setIsLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Calculate current backtest result
      let btWinRate = "0.0%";
      let btTotal = 0;
      let btWins = 0;
      let btLosses = 0;
      if (data.length >= 100) {
        const signals = calcSmartSignals(data, pane.indicators.smartSignalParams);
        if (signals.length > 0) {
          signals.forEach((sig) => {
            const idx = data.findIndex(d => d?.time === sig.time);
            if (idx > -1 && idx < data.length - 1) {
              for (let i = idx + 1; i < data.length; i++) {
                const c = data[i];
                if (!c) continue;
                if (sig.signal === 'BUY') {
                  if (c.high >= sig.tp) { btWins++; break; }
                  if (c.low <= sig.sl) { btLosses++; break; }
                } else {
                  if (c.low <= sig.tp) { btWins++; break; }
                  if (c.high >= sig.sl) { btLosses++; break; }
                }
              }
            }
          });
          
          btTotal = signals.length;
          const resolved = btWins + btLosses;
          if (resolved > 0) {
             btWinRate = ((btWins / resolved) * 100).toFixed(1) + "%";
          }
        }
      }

      const currentParamsStr = JSON.stringify(pane.indicators.smartSignalParams || {
        emaFast: 20, emaMed: 50, emaSlow: 80,
        rsiLength: 14, rsiBuyMin: 40, rsiBuyMax: 65,
        rsiSellMin: 35, rsiSellMax: 60, volRatio: 1.1
      }, null, 2);

      const systemPrompt = `You are an elite quantitative AI trading assistant. Your sole role is to analyze strategies, propose parameter improvements, evaluate backtests, and improve the win ratio for ${pane.symbol} on the ${pane.timeframe} timeframe. Do NOT attempt to execute trades or connect to a broker. We will connect to a broker later.
Current smart signal parameters:
${currentParamsStr}

Current backtest performance over recent history (goal is >= 75% win rate):
- Total closed trades: ${btTotal}
- Wins: ${btWins}
- Win rate: ${btWinRate}

If you decide to improve and update the parameters, you MUST output a JSON block formatted exactly like this anywhere in your response:
\`\`\`json
{
  "command": "UPDATE_PARAMS",
  "params": {
    "emaFast": 20, "emaMed": 50, "emaSlow": 80,
    "rsiLength": 14, "rsiBuyMin": 40, "rsiBuyMax": 65,
    "rsiSellMin": 35, "rsiSellMax": 60, "volRatio": 1.1
  }
}
\`\`\`
Provide analysis before or after the JSON block.
`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
          ]
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        const errorMsg = result.error || `HTTP error ${response.status}`;
        if (response.status === 429 || errorMsg.includes('429') || errorMsg.includes('rate-limited')) {
          throw new Error(`Model ${selectedModel.split('/').pop()} is currently rate-limited. Please select a different model from the dropdown above and try again.`);
        }
        throw new Error(errorMsg);
      }

      if (result.choices && result.choices.length > 0) {
        const aiMessage = result.choices[0].message.content;
        setMessages(prev => [...prev, { role: 'assistant', content: aiMessage }]);
        
        // Auto-parse JSON
        const jsonMatch = aiMessage.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.command === 'UPDATE_PARAMS' && parsed.params) {
              setPendingProposal({
                params: parsed.params,
                description: 'AI parameter proposal.'
              });
              setMessages(prev => [...prev, { role: 'system', content: 'Received new parameter proposal. Click "ACCEPT" to apply or "DISCARD" to ignore.' }]);
            }
          } catch(e) {
            console.error("Failed to parse JSON parameters from LLM", e);
          }
        }
      } else {
        throw new Error("No response choices returned by AI.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while connecting to OpenRouter. Ensure OPENROUTER_API_KEY is set via the Secrets panel.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#121620] relative">
      <div className="flex flex-col items-center justify-center py-4 border-b border-[#2e3242] shrink-0">
        <TerminalIcon className="w-8 h-8 text-violet-400 mb-2" />
        <h3 className="font-bold text-gray-100 tracking-wide">QUANT TERMINAL</h3>
        <p className="text-[10px] text-gray-500 font-mono mt-1 mb-3 uppercase tracking-wider">
          LLM Strategy Fine-Tuner
        </p>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-[#1a1f2e] border border-[#2e3242] text-violet-300 text-[10px] font-mono rounded px-2 py-1 outline-none focus:border-violet-500/50"
        >
          <option value="google/gemma-4-31b-it:free">Google (Free)</option>
          <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
          <option value="qwen/qwen-2-7b-instruct:free">Qwen 2 7B (Free)</option>
          <option value="nousresearch/hermes-3-llama-3.1-405b:free">Hermes</option>
          <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
          <option value="google/gemini-flash-1.5-8b">Gemini 1.5 Flash 8B</option>
          <option value="google/gemini-pro-1.5">Gemini 1.5 Pro</option>
          <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
          <option value="openrouter/free">Openrouter</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
        {messages.filter(m => m.role !== 'system' || m.content.startsWith('✓') || m.content.startsWith('✗') || m.content.startsWith('📊') || m.content.startsWith('⚠') || m.content.startsWith('Search') || m.content.startsWith('Starting') || m.content.startsWith('Received') || m.content.startsWith('AI AutoTrade')).map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className={`text-[9px] uppercase tracking-wider mb-1 ${msg.role === 'user' ? 'text-gray-500' : 'text-violet-400'}`}>
              {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Terminal AI'}
            </span>
            <div className={`p-2.5 rounded max-w-[90%] whitespace-pre-wrap ${
              msg.role === 'user' 
              ? 'bg-[#1a1f2e] text-gray-300 border border-[#2e3242] rounded-tr-none' 
              : msg.role === 'system'
              ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-violet-900/20 text-violet-200 border border-violet-500/30 rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start">
            <span className="text-[9px] text-violet-400 uppercase tracking-wider mb-1">Terminal AI</span>
            <div className="p-2.5 bg-violet-900/20 rounded border border-violet-500/30 rounded-tl-none flex items-center gap-2 text-violet-300">
              <Loader2 className="w-3 h-3 animate-spin" /> Processing request...
            </div>
          </div>
        )}

        {pendingProposal && (
          <div className="p-3 bg-emerald-900/20 border border-emerald-500/30 rounded text-emerald-400 flex flex-col gap-2 mt-2">
            <div className="font-bold text-[10px] uppercase tracking-wide border-b border-emerald-500/20 pb-1.5">{pendingProposal.description}</div>
            <pre className="text-[9px] bg-[#0d1017] p-2 rounded text-emerald-300/80 overflow-x-auto">
              {JSON.stringify(pendingProposal.params, null, 2)}
            </pre>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  const newParams = pendingProposal.params;
                  onUpdatePane({ indicators: { ...pane.indicators, smartSignalParams: newParams } });
                  setMessages(prev => [...prev, { role: 'system', content: '✓ Parameters successfully applied. Running backtest with new params...' }]);
                  setPendingProposal(null);
                  // Auto-run backtest with the newly accepted params
                  setTimeout(() => runBacktest(newParams), 200);
                }}
                className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 py-1.5 rounded text-[10px] uppercase font-bold transition-colors border border-emerald-500/30"
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setMessages(prev => [...prev, { role: 'system', content: '✗ Proposal discarded.' }]);
                  setPendingProposal(null);
                }}
                className="flex-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 py-1.5 rounded text-[10px] uppercase font-bold transition-colors border border-rose-500/30"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 flex flex-col gap-1.5 items-start mt-2">
            <div className="flex items-center gap-1.5 font-bold">
               <AlertTriangle className="w-3.5 h-3.5" /> Connection Failed
            </div>
            <span className="text-[10px] font-sans break-words w-full">{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-[#0d1017] border-t border-[#2e3242] shrink-0 flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => runBacktest()}
            disabled={isLoading || data.length < 100}
            className="flex-1 bg-[#1a1f2e] text-emerald-400 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded flex items-center justify-center gap-2 border border-emerald-500/20 hover:bg-emerald-900/20 disabled:opacity-50 transition-colors"
          >
            <Activity className="w-3 h-3" />
            Backtest
          </button>
          <button
            onClick={runOptimizationLoop}
            disabled={isLoading || data.length < 100}
            className="flex-1 bg-[#1a1f2e] text-blue-400 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded flex items-center justify-center gap-2 border border-[#2e3242] hover:bg-[#252a36] disabled:opacity-50 transition-colors"
          >
            <Activity className="w-3 h-3" />
            Auto-Optimize
          </button>
        </div>
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            className="w-full bg-[#161b28] border border-[#2e3242] rounded px-3 py-2 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500/50 pr-10"
            placeholder="Type command..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 text-gray-500 hover:text-violet-400 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-2 text-center text-[9px] text-gray-600 font-mono tracking-widest uppercase">
          Powered by OpenRouter
        </div>
      </div>
    </div>
  );
}
