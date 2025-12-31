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
  }, [room?.code]);

  const navigate = (screen) => {
    setActiveScreen(screen);
  };

  return (
    <div className="font-sans">
      {activeScreen === 'landing' && <Landing onNavigate={navigate} />}
      {activeScreen === 'team-selection' && <TeamSelection onNavigate={navigate} />}
      {activeScreen === 'auction' && <Auction onNavigate={navigate} />}
      {activeScreen === 'summary' && <Summary onNavigate={navigate} />}
    </div>
  );
}
