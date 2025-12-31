import { useState, useEffect } from 'react';
import Landing from './components/Landing';
import TeamSelection from './components/TeamSelection';
import Auction from './components/Auction';
import Summary from './components/Summary';
import { useAuctionStore } from './store/auctionStore';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('landing');
  const room = useAuctionStore((state) => state.room);

  // Sync URL with Room Code
  useEffect(() => {
    if (room?.code) {
      window.history.pushState({}, '', `/${room.code}`);
    } else {
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
    }

    if (room?.status === 'FINISHED') {
      setActiveScreen('summary');
    }
  }, [room?.code, room?.status]);

  const navigate = (screen) => {
    setActiveScreen(screen);
  };

  return (
    <div className="font-sans relative">
      {activeScreen === 'landing' && <Landing onNavigate={navigate} />}
      {activeScreen === 'team-selection' && <TeamSelection onNavigate={navigate} />}
      {activeScreen === 'auction' && <Auction onNavigate={navigate} />}
      {activeScreen === 'summary' && <Summary onNavigate={navigate} />}

      <Notification />
      <ConfirmModal />
    </div>
  );
}

function ConfirmModal() {
  const confirmation = useAuctionStore(state => state.confirmation);
  const set = useAuctionStore.setState;

  if (!confirmation) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xs bg-[#111] border border-white/10 rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">⚡</span>
        </div>
        <h3 className="text-lg font-black uppercase italic tracking-tighter mb-2 text-white">Are you sure?</h3>
        <p className="text-[10px] font-bold uppercase text-white/30 tracking-widest leading-relaxed mb-8 px-2">{confirmation.message}</p>
        <div className="flex gap-3">
          <button
            onClick={() => set({ confirmation: null })}
            className="flex-1 py-4 rounded-2xl bg-white/5 font-black text-[10px] uppercase tracking-widest text-white/40 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              confirmation.onConfirm();
              set({ confirmation: null });
            }}
            className="flex-1 py-4 rounded-2xl bg-red-600 font-black text-[10px] uppercase tracking-widest text-white shadow-lg shadow-red-900/40 active:scale-95 transition-all"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function Notification() {
  const notification = useAuctionStore(state => state.notification);
  if (!notification) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-xs animate-in slide-in-from-top-4 duration-300">
      <div className={`px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 ${notification.type === 'error'
        ? 'bg-red-500/10 border-red-500/20 text-red-500'
        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
        }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${notification.type === 'error' ? 'bg-red-500/20' : 'bg-emerald-500/20'
            }`}>
            {notification.type === 'error' ? '⚠️' : '✅'}
          </div>
          <p className="text-[11px] font-black uppercase tracking-wider">{notification.message}</p>
        </div>
      </div>
    </div>
  );
}
