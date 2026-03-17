import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  ShieldAlert, 
  Send, 
  Layers, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  X,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Broadcast {
  id: number;
  priority: 'P1' | 'P2';
  message: string;
  channels: string[];
  timestamp: string;
  reached: number;
  total: number;
  hash: string;
}

interface BroadcastPageProps {
  nodesCount: number;
}

export const BroadcastPage: React.FC<BroadcastPageProps> = ({ nodesCount }) => {
  const [priority, setPriority] = useState<'P1' | 'P2'>('P1');
  const [channels, setChannels] = useState({ mesh: true, pa: true, signage: true });
  const [message, setMessage] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const [attempts, setAttempts] = useState(3);
  const [lockout, setLockout] = useState(0);
  const [isConfirmingP2, setIsConfirmingP2] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deliveryProgress, setDeliveryProgress] = useState(0);
  
  // Mock connection status
  const paOnline = true;
  const signageOnline = true;

  const CORRECT_PIN = "1234";

  const p1Templates = [
    "⚠️ NOTFALL: Bitte bewahren Sie Ruhe und folgen Sie den Anweisungen des Personals.",
    "🔥 FEUERALARM: Bitte verlassen Sie das Gelände umgehend über die nächsten Notausgänge.",
    "⛈️ UNWETTERWARNUNG: Bitte suchen Sie Schutz in den markierten festen Gebäuden."
  ];

  const p2Templates = [
    "ℹ️ INFO: Der Einlass zur Mainstage verzögert sich um ca. 15 Minuten.",
    "💧 TRINKWASSER: Kostenlose Wasserstellen befinden sich links neben dem Infopoint.",
    "🚌 SHUTTLE: Die letzten Busse zum Bahnhof fahren heute um 01:30 Uhr."
  ];

  useEffect(() => {
    if (lockout > 0) {
      const timer = setInterval(() => setLockout(l => l - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [lockout]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => setCooldown(c => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handlePriorityChange = (p: 'P1' | 'P2') => {
    setPriority(p);
    if (p === 'P2') {
      setChannels({ mesh: true, pa: false, signage: false });
    } else {
      setChannels({ mesh: true, pa: true, signage: true });
    }
  };

  const handleTemplateClick = (t: string) => {
    setMessage(t);
  };

  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value !== '' && index < 3) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleSend = () => {
    if (priority === 'P1') {
      setIsModalOpen(true);
      setPin(['', '', '', '']);
      setPinError(false);
    } else {
      setIsConfirmingP2(true);
    }
  };

  const executeBroadcast = () => {
    if (priority === 'P1' && pin.join('') !== CORRECT_PIN) {
      setPinError(true);
      setAttempts(a => a - 1);
      if (attempts <= 1) {
        setLockout(60);
        setAttempts(3);
        setIsModalOpen(false);
      }
      setTimeout(() => setPinError(false), 500);
      return;
    }

    const activeChannels = Object.entries(channels)
      .filter(([_, active]) => active)
      .map(([name]) => name);

    const newBc: Broadcast = {
      id: Date.now(),
      priority,
      message,
      channels: activeChannels,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reached: nodesCount,
      total: nodesCount,
      hash: Math.random().toString(36).substring(2, 15)
    };

    // Add to global state
    if (!(window as any).SEB) (window as any).SEB = {};
    if (!(window as any).SEB.broadcasts) (window as any).SEB.broadcasts = [];
    (window as any).SEB.broadcasts = [newBc, ...(window as any).SEB.broadcasts];

    setIsModalOpen(false);
    setIsConfirmingP2(false);
    setShowSuccess(true);
    setCooldown(30);
    setDeliveryProgress(0);
    
    // Animate delivery
    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) {
        setDeliveryProgress(1);
        clearInterval(interval);
      } else {
        setDeliveryProgress(progress);
      }
    }, 100);

    setTimeout(() => setShowSuccess(false), 5000);
    setMessage('');
  };

  const broadcasts: Broadcast[] = (window as any).SEB?.broadcasts || [];
  const lastBc = broadcasts[0];
  const rate = lastBc ? Math.round((lastBc.reached / lastBc.total) * 100) : 0;

  return (
    <div className="flex gap-8 h-full">
      {/* Left Column: Composer */}
      <div className="flex-1 bg-white p-8 rounded-[40px] border border-black/5 shadow-sm space-y-8 overflow-y-auto custom-scrollbar relative">
        <AnimatePresence>
          {showSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50 flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              Broadcast erfolgreich gesendet
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-serif font-bold text-claude-accent">Broadcast Composer</h2>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider">System Online</span>
          </div>
        </div>

        {/* Section 1: Priority */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Priorität</h3>
          <div className="flex gap-4">
            <button 
              onClick={() => handlePriorityChange('P1')}
              className={`flex-1 py-4 rounded-2xl border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                priority === 'P1' 
                ? 'bg-[#fef2f2] border-[#dc2626] text-[#dc2626]' 
                : 'bg-claude-sidebar border-black/5 text-claude-muted'
              }`}
            >
              <ShieldAlert size={18} />
              P1 — Notfall
            </button>
            <button 
              onClick={() => handlePriorityChange('P2')}
              className={`flex-1 py-4 rounded-2xl border-2 font-medium transition-all flex items-center justify-center gap-2 ${
                priority === 'P2' 
                ? 'bg-[#fefce8] border-[#ca8a04] text-[#ca8a04]' 
                : 'bg-claude-sidebar border-black/5 text-claude-muted'
              }`}
            >
              <Megaphone size={18} />
              P2 — Info
            </button>
          </div>
          {priority === 'P2' && (
            <p className="text-[10px] text-amber-600 font-bold italic">
              * P2-Broadcasts nur via Mesh — PA/Signage optional zuschaltbar
            </p>
          )}
        </div>

        {/* Section 2: Channels */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Kanäle</h3>
          <div className="flex gap-3">
            <div className="relative group">
              <button 
                disabled
                className="px-6 py-3 rounded-full bg-[#E8ECFA] border-2 border-[#1D348A] text-[#1D348A] text-sm font-bold flex items-center gap-2 cursor-not-allowed opacity-80"
              >
                <Layers size={16} />
                Mesh
              </button>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Mesh-Kanal kann nicht deaktiviert werden
              </div>
            </div>
            
            <button 
              onClick={() => setChannels({...channels, pa: !channels.pa})}
              className={`px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 border-2 transition-all ${
                channels.pa 
                ? 'bg-[#E8ECFA] border-[#1D348A] text-[#1D348A]' 
                : 'bg-claude-sidebar border-black/5 text-claude-muted'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${paOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              PA-Anlage
            </button>

            <button 
              onClick={() => setChannels({...channels, signage: !channels.signage})}
              className={`px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2 border-2 transition-all ${
                channels.signage 
                ? 'bg-[#E8ECFA] border-[#1D348A] text-[#1D348A]' 
                : 'bg-claude-sidebar border-black/5 text-claude-muted'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${signageOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              Signage
            </button>
          </div>
        </div>

        {/* Section 3: Templates */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Vorlagen</h3>
          <div className="space-y-2">
            {p1Templates.map((t, i) => (
              <button 
                key={i}
                onClick={() => handleTemplateClick(t)}
                className="w-full text-left p-3 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50 transition-colors text-xs text-red-700 font-medium"
              >
                {t}
              </button>
            ))}
            {priority === 'P2' && p2Templates.map((t, i) => (
              <button 
                key={i}
                onClick={() => handleTemplateClick(t)}
                className="w-full text-left p-3 rounded-xl border border-amber-100 bg-amber-50/30 hover:bg-amber-50 transition-colors text-xs text-amber-700 font-medium"
              >
                {t}
              </button>
            ))}
            <button className="w-full py-3 border-2 border-dashed border-black/5 rounded-xl text-xs font-bold text-claude-muted hover:border-claude-accent/20 hover:text-claude-accent transition-all">
              + Eigene Vorlage
            </button>
          </div>
        </div>

        {/* Section 4: Message */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-claude-muted">Nachricht</h3>
            <span className={`text-[10px] font-bold ${message.length > 500 ? 'text-red-500' : 'text-claude-muted'}`}>
              {message.length} / 500
            </span>
          </div>
          <div className="relative">
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Geben Sie hier Ihre Nachricht ein..."
              className="w-full bg-claude-sidebar border border-black/5 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-claude-accent/10 transition-all outline-none resize-none"
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-claude-muted font-bold">
            <span>Vorschau auf Nutzer-Gerät:</span>
            <div className="px-3 py-1.5 bg-claude-sidebar rounded-full border border-black/5 italic max-w-[200px] truncate">
              {message || "Nachrichtenvorschau..."}
            </div>
          </div>
        </div>

        {/* Section 5: Send Button */}
        <div className="pt-4">
          {nodesCount === 0 ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 mb-4">
              <AlertCircle size={18} className="text-red-600" />
              <p className="text-xs font-bold text-red-800">Keine aktiven Knoten — Broadcast nicht möglich</p>
            </div>
          ) : cooldown > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3 mb-4">
              <Clock size={18} className="text-amber-600" />
              <p className="text-xs font-bold text-amber-800">Letzter Broadcast vor {30 - cooldown}s — Bitte {cooldown}s warten</p>
            </div>
          ) : null}

          {priority === 'P1' ? (
            <button 
              onClick={handleSend}
              disabled={message.length === 0 || message.length > 500 || nodesCount === 0 || cooldown > 0}
              className="w-full py-4 bg-[#dc2626] text-white rounded-2xl font-bold shadow-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldAlert size={20} />
              P1-Broadcast vorbereiten →
            </button>
          ) : (
            <div className="space-y-4">
              {isConfirmingP2 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between"
                >
                  <p className="text-xs font-bold text-blue-800">Soll der Info-Broadcast gesendet werden?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setIsConfirmingP2(false)} className="px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-100 rounded-lg">Abbrechen</button>
                    <button onClick={executeBroadcast} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md">Bestätigen</button>
                  </div>
                </motion.div>
              )}
              <button 
                onClick={handleSend}
                disabled={message.length === 0 || message.length > 500 || nodesCount === 0 || cooldown > 0 || isConfirmingP2}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={20} />
                Info-Broadcast senden →
              </button>
            </div>
          )}
        </div>

        {/* P1 Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-[380px] overflow-hidden relative z-10 flex flex-col min-h-[400px]"
              >
                <div className="p-6 space-y-6 flex-1">
                  <div className="space-y-1">
                    <h3 className="text-lg font-serif font-bold text-red-600">P1-Notfall-Broadcast bestätigen</h3>
                    <p className="text-[10px] text-claude-muted font-bold uppercase tracking-widest">Sicherheits-Protokoll Level 4</p>
                  </div>

                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-xs text-red-700 font-medium italic">"{message}"</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-emerald-500 flex items-center justify-center text-white">
                        <CheckCircle2 size={12} />
                      </div>
                      <span className="text-xs font-bold">Mesh ({nodesCount.toLocaleString()} aktive Knoten)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded flex items-center justify-center text-white ${channels.pa ? (paOnline ? 'bg-emerald-500' : 'bg-red-500') : 'bg-gray-300'}`}>
                        {channels.pa && paOnline ? <CheckCircle2 size={12} /> : <X size={12} />}
                      </div>
                      <span className={`text-xs font-bold ${channels.pa && !paOnline ? 'text-red-600' : ''}`}>
                        PA-Anlage {channels.pa ? (paOnline ? '(verbunden)' : '(NICHT VERBUNDEN)') : '(deaktiviert)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded flex items-center justify-center text-white ${channels.signage ? (signageOnline ? 'bg-emerald-500' : 'bg-red-500') : 'bg-gray-300'}`}>
                        {channels.signage && signageOnline ? <CheckCircle2 size={12} /> : <X size={12} />}
                      </div>
                      <span className="text-xs font-bold">Digital Signage {channels.signage ? (signageOnline ? '(6 Displays)' : '(offline)') : '(deaktiviert)'}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-claude-muted">Sicherheits-PIN eingeben</label>
                      {lockout > 0 && <span className="text-[10px] text-red-600 font-bold">Sperre: {lockout}s</span>}
                    </div>
                    <div className={`flex justify-between gap-3 ${pinError ? 'animate-shake' : ''}`}>
                      {pin.map((digit, i) => (
                        <input 
                          key={i}
                          id={`pin-${i}`}
                          type="password"
                          maxLength={1}
                          value={digit}
                          disabled={lockout > 0}
                          onChange={(e) => handlePinChange(i, e.target.value)}
                          className={`w-11 h-11 text-center text-xl font-bold rounded-xl border-2 transition-all outline-none ${
                            pin.every(d => d !== '') && pin.join('') === CORRECT_PIN 
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
                            : pinError ? 'border-red-500 bg-red-50' : 'border-black/5 bg-claude-sidebar focus:border-claude-accent/20'
                          }`}
                        />
                      ))}
                    </div>
                    {pinError && lockout === 0 && (
                      <p className="text-[10px] text-red-600 font-bold text-center">{attempts} Versuche verbleibend</p>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-claude-sidebar border-t border-black/5 space-y-3">
                  <button 
                    onClick={executeBroadcast}
                    disabled={pin.join('') !== CORRECT_PIN || lockout > 0}
                    className="w-full py-4 bg-[#dc2626] text-white rounded-2xl font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    Jetzt senden — alle Kanäle
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="w-full py-2 text-xs font-bold text-claude-muted hover:text-claude-text transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Column: Status + History */}
      <div className="w-[280px] flex flex-col gap-6">
        {/* Card 1: Delivery Status */}
        <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-claude-muted">Letzter Broadcast</h3>
          
          {lastBc ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-claude-muted uppercase">Mesh-Knoten</span>
                  <span>{Math.round(lastBc.reached * deliveryProgress)} / {lastBc.total} · {Math.round(rate * deliveryProgress)}%</span>
                </div>
                <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${rate * deliveryProgress}%` }}
                    className={`h-full transition-all ${rate > 90 ? 'bg-[#16a34a]' : rate > 70 ? 'bg-[#d97706]' : 'bg-[#dc2626]'}`}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-claude-muted uppercase">PA-Anlage</span>
                  <span className={lastBc.channels.includes('pa') ? 'text-emerald-600' : 'text-claude-muted'}>
                    {lastBc.channels.includes('pa') ? 'Bestätigt' : 'Nicht verbunden'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-claude-muted uppercase">Signage</span>
                  <span className={lastBc.channels.includes('signage') ? 'text-emerald-600' : 'text-claude-muted'}>
                    {lastBc.channels.includes('signage') ? 'Bestätigt' : 'Fehlgeschlagen'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-claude-muted uppercase">Protokoll</span>
                  <span className="text-emerald-600 flex items-center gap-1">Signiert ✓ · {lastBc.hash.slice(0, 6)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-claude-muted italic">Keine Sendedaten verfügbar</p>
            </div>
          )}
        </div>

        {/* Card 2: History */}
        <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm flex-1 flex flex-col min-h-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-claude-muted mb-4">Verlauf</h3>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {broadcasts.length > 0 ? broadcasts.map((bc) => (
              <button 
                key={bc.id}
                className="w-full text-left p-3 rounded-2xl bg-claude-sidebar border border-black/5 hover:border-claude-accent/20 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                    bc.priority === 'P1' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {bc.priority}
                  </span>
                  <span className="text-[8px] text-claude-muted font-bold">{bc.timestamp}</span>
                </div>
                <p className="text-[10px] font-medium text-claude-text line-clamp-2 mb-1">{bc.message}</p>
                <p className="text-[8px] text-claude-muted font-bold uppercase">Mesh: {Math.round((bc.reached/bc.total)*100)}% · {bc.channels.join(', ')}</p>
              </button>
            )) : (
              <div className="text-center py-12">
                <Megaphone size={24} className="text-black/5 mx-auto mb-2" />
                <p className="text-[10px] text-claude-muted font-bold uppercase tracking-widest">Kein Verlauf</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};
