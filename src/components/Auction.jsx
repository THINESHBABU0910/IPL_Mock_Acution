import { useState, useEffect, useRef } from 'react';
import { useAuctionStore } from '../store/auctionStore';

export default function Auction({ onNavigate }) {
    const [activeTab, setActiveTab] = useState('chat');
    const [viewTeam, setViewTeam] = useState(null); // Local filter for Squad tab
    const [showTeamDropdown, setShowTeamDropdown] = useState(false); // Custom dropdown toggle
    const [chatInput, setChatInput] = useState('');
    const [showSetModal, setShowSetModal] = useState(false);
    const [setTab, setSetTab] = useState('upcoming'); // upcoming | sold | unsold
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [hikeValue, setHikeValue] = useState(0);

    const room = useAuctionStore((state) => state.room);
    const currentUser = useAuctionStore((state) => state.currentUser);
    const teams = useAuctionStore((state) => state.teams);
    const shuffledPool = useAuctionStore((state) => state.shuffledPool);
    const currentPlayerIndex = useAuctionStore((state) => state.currentPlayerIndex);
    const currentBid = useAuctionStore((state) => state.currentBid);
    const timer = useAuctionStore((state) => state.timer);
    const timerDuration = useAuctionStore((state) => state.timerDuration);
    const activity = useAuctionStore((state) => state.activity);
    const onlineUsers = useAuctionStore((state) => state.onlineUsers);
    const isConnected = useAuctionStore((state) => state.isConnected);

    const placeBid = useAuctionStore((state) => state.placeBid);
    const addChat = useAuctionStore((state) => state.addChat);
    const updateSettings = useAuctionStore((state) => state.updateSettings);
    const startGame = useAuctionStore((state) => state.startGame);
    const togglePause = useAuctionStore((state) => state.togglePause);
    const rtmDecision = useAuctionStore((state) => state.rtmDecision);
    const showNotification = useAuctionStore((state) => state.showNotification);
    const confirmAction = useAuctionStore((state) => state.confirmAction);
    const endGame = useAuctionStore((state) => state.endGame);
    const exitRoom = useAuctionStore((state) => state.exitRoom);

    const scrollRef = useRef(null);
    const currentPlayer = shuffledPool[currentPlayerIndex];
    const upcomingPlayers = shuffledPool.slice(currentPlayerIndex + 1, currentPlayerIndex + 6);
    const myTeam = teams[currentUser?.team];
    const isAdmin = currentUser?.name === room?.creator;
    const isLive = room?.status === 'LIVE' || room?.status === 'RTM_PHASE';
    const isPaused = room?.isPaused;

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [activity]);

    useEffect(() => {
        // Allow users to spectate even without a team
        // Only redirect to team-selection if room is in WAITING status and user wants to play
        if (!currentUser?.team && room && room.status === 'WAITING') {
            // Room is waiting - user can still spectate, but offer team selection
            // Don't force redirect - allow spectating
        } else if (currentUser?.team && !viewTeam) {
            setViewTeam(currentUser.team);
        } else if (!currentUser?.team && !viewTeam && room) {
            // User is spectating - set viewTeam to first available team or null
            const firstTeam = Object.keys(teams)[0];
            if (firstTeam) setViewTeam(firstTeam);
        }
    }, [currentUser?.team, onNavigate, viewTeam, room, teams]);

    useEffect(() => {
        if (room?.rtmState?.stage === 'HIKE' && room.rtmState.currentBid?.amount) {
            setHikeValue(room.rtmState.currentBid.amount + 20000000); // Default +2 Cr
        }
    }, [room?.rtmState?.stage]);

    const handleBid = () => {
        if (!currentPlayer || !isLive || isPaused) return;
        const res = placeBid(currentPlayer);
        if (res?.success === false) showNotification(res.reason, "error");
    };

    const handleStartGame = () => {
        startGame();
    };

    const handleSendChat = () => {
        if (!chatInput.trim()) return;
        addChat(chatInput);
        setChatInput('');
    };

    const formatPrice = (price) => {
        if (!price) return '₹0';
        if (price < 10000000) return `₹${(price / 100000).toFixed(0)}L`;
        return `₹${(price / 10000000).toFixed(2)}Cr`;
    };

    const getNextBidUI = () => {
        if (!currentPlayer) return '0.00 Cr';
        // New player always starts at base price
        if (!currentBid) {
            return formatPrice(currentPlayer.basePrice);
        }
        
        const amount = currentBid.amount;
        let next;
        // IPL Auction Rules: 2 Cr+ uses 0.25 Cr increments
        if (amount >= 20000000) {
            next = amount + 2500000; // 0.25 Cr increment
        } else if (currentPlayer.basePrice >= 20000000) {
            // Base price is 2 Cr+, use 0.25 Cr increments
            next = amount + 2500000;
        } else {
            // Base price < 2 Cr, use 0.2 Cr increments
            next = amount + 2000000;
        }
        return formatPrice(next);
    };

    // Allow spectating even without a team
    // if (!currentUser?.team) return null;

    // Game Over Screen
    if (!currentPlayer) {
        return (
            <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-4 text-center">
                <h1 className="text-4xl font-black italic uppercase mb-2">Auction Concluded</h1>
                <p className="text-white/40 mb-6 uppercase text-xs tracking-widest">All sets finished</p>
                <button
                    onClick={() => onNavigate('summary')}
                    className="px-8 py-4 bg-emerald-600 rounded-2xl font-black uppercase tracking-widest text-xs"
                >
                    Generate Report
                </button>
            </div>
        )
    }

    return (
        <div className="h-screen w-screen bg-black text-white font-sans flex flex-col overflow-hidden fixed inset-0">

            {/* HEADER: Admin Controls in Top Bar */}
            <div className="h-12 flex items-center justify-between px-3 bg-[#0a0a0a] border-b border-white/5 shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 animate-pulse'}`}></div>
                    <span className="text-amber-500 font-black tracking-widest text-[10px] uppercase">Room {room?.code}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-[9px] uppercase font-bold text-white/40 tracking-wider">Online</span>
                        <span className="text-[10px] font-black text-emerald-500">
                            {new Set(onlineUsers.filter(u => u.isOnline === true && u.team).map(u => u.team)).size}
                        </span>
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-2 border-l border-white/10 pl-2 ml-1">
                            {!isLive ? (
                                <button
                                    onClick={handleStartGame}
                                    className="px-3 py-1 bg-emerald-600 rounded-md text-[10px] font-black uppercase tracking-widest shadow-[0_0_10px_#10b98150] animate-pulse"
                                >
                                    Start
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => togglePause(isPaused)}
                                        className={`w-6 h-6 rounded-md flex items-center justify-center border ${isPaused ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-amber-500/20 border-amber-500 text-amber-500'}`}
                                    >
                                        <span className="material-icons text-[10px] font-black">{isPaused ? '▶' : 'II'}</span>
                                    </button>
                                    <button
                                        onClick={() => confirmAction('End the auction for everyone? This cannot be undone.', endGame)}
                                        className="px-3 py-1 bg-red-600/20 border border-red-600/40 text-red-500 rounded-md text-[9px] font-black uppercase tracking-tighter hover:bg-red-600 hover:text-white transition-all ml-1"
                                    >
                                        End
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    <button onClick={() => setShowExitConfirm(true)} className="text-white/20 hover:text-white font-bold text-[10px] uppercase ml-1 border-l border-white/10 pl-2">Exit</button>
                </div>
            </div>

            {/* PLAYER CARD AREA - Clear View, No Overlay */}
            <div className="p-3 bg-black shrink-0 relative z-10">
                <div className="bg-[#111] rounded-2xl p-4 border border-white/5 relative overflow-hidden h-[200px] flex flex-col justify-between shadow-2xl">

                    {/* Horizontal Timer Bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
                        <div
                            className={`h-full transition-all duration-300 ease-linear ${isPaused ? 'bg-amber-500 w-full' : timer < 5 ? 'bg-red-600 shadow-[0_0_15px_#dc2626]' : 'bg-emerald-500'}`}
                            style={{ width: isPaused || !isLive ? '100%' : `${(timer / timerDuration) * 100}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-start mt-2">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black uppercase text-amber-500 tracking-widest mb-1">{currentPlayer.role}</span>
                            <span className="text-[8px] font-bold uppercase text-white/30 tracking-[3px]">{currentPlayer.country}</span>
                        </div>

                        {/* Status Badge */}
                        {isLive ? (
                            <div className="w-10 h-10 rounded-xl bg-[#050505] border border-white/10 flex items-center justify-center">
                                <span className={`text-xl font-black ${isPaused ? 'text-amber-500' : timer < 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                    {isPaused ? 'II' : timer}
                                </span>
                            </div>
                        ) : (
                            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">
                                LOBBY
                            </div>
                        )}
                    </div>

                    <div className="text-center transform -translate-y-2">
                        <h2 className="text-[32px] font-black uppercase italic leading-[0.9] tracking-tighter truncate px-2">{currentPlayer.name}</h2>
                    </div>

                    <div className="flex justify-between items-end border-t border-white/5 pt-3">
                        <div>
                            <p className="text-[8px] uppercase text-white/20 tracking-wider font-bold">Base Price</p>
                            <p className="text-lg font-black leading-none mt-0.5">{formatPrice(currentPlayer.basePrice)}</p>
                        </div>
                        {currentBid && (
                            <div className="text-right animate-in slide-in-from-right duration-200">
                                <p className="text-[8px] uppercase text-emerald-500 tracking-wider font-bold">Led By {currentBid.team}</p>
                                <p className="text-2xl font-black text-emerald-400 leading-none mt-0.5">{formatPrice(currentBid.amount)}</p>
                            </div>
                        )}
                    </div>

                    {/* PAUSED OVERLAY ONLY (Not for Lobby) */}
                    {isPaused && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                            <div className="text-center">
                                <p className="text-[10px] uppercase font-bold text-amber-500 tracking-widest mb-2">Auction Paused</p>
                                <p className="text-xs font-black uppercase text-white/50">Admin is reviewing...</p>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* QUICK STATS & BID BUTTON - Compact */}
                <div className="px-3 shrink-0 pb-2 z-10">
                {currentUser?.team ? (
                    <div className="flex justify-between items-center px-2 mb-2">
                        <div className="flex flex-col">
                            <span className="text-[8px] uppercase font-bold text-white/30 tracking-wider">Remaining Purse</span>
                            <span className="text-sm font-black text-emerald-400">{formatPrice(myTeam?.purse)}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[8px] uppercase font-bold text-white/30 tracking-wider">Squad Status</span>
                            <span className="text-sm font-black text-white">{myTeam?.players.length} <span className="text-white/30">/ 25</span></span>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center items-center px-2 mb-2 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider">Spectating Mode • Select a team to play</span>
                    </div>
                )}

                <div className="flex gap-2 h-16">
                    {currentUser?.team ? (() => {
                        const nextBidAmount = currentBid ? 
                            (currentBid.amount >= 20000000 ? currentBid.amount + 2500000 : 
                             currentPlayer?.basePrice >= 20000000 ? currentBid.amount + 2500000 : 
                             currentBid.amount + 2000000) : 
                            (currentPlayer?.basePrice || 0);
                        
                        const canBid = isLive && !isPaused && (currentBid?.team !== currentUser?.team);
                        const hasMoney = myTeam && myTeam.purse >= nextBidAmount;
                        const hasOSSlot = !currentPlayer?.isOverseas || (myTeam && myTeam.overseasCount < 8);
                        const hasSquadSlot = myTeam && myTeam.players.length < 25;
                        
                        const isDisabled = !canBid || !hasMoney || !hasOSSlot || !hasSquadSlot;
                        let disabledReason = '';
                        if (!canBid) {
                            disabledReason = !isLive ? 'Waiting for Host' : isPaused ? 'Paused' : 'Your Turn';
                        } else if (!hasMoney) {
                            disabledReason = 'Money Over';
                        } else if (!hasOSSlot) {
                            disabledReason = 'OS Over';
                        } else if (!hasSquadSlot) {
                            disabledReason = 'Squad Full';
                        }
                        
                        return (
                            <button
                                onClick={handleBid}
                                disabled={isDisabled}
                                className={`flex-1 rounded-xl relative overflow-hidden transition-all shadow-[0_0_40px_-5px_#10b98140] ${!isDisabled ? 'bg-emerald-600 active:scale-[0.98]' : 'bg-[#1a1a1a] grayscale opacity-50 cursor-not-allowed'}`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-700 ${isDisabled ? 'hidden' : ''}`}></div>
                                <div className="relative flex flex-col items-center justify-center">
                                    <span className="text-[9px] font-black uppercase text-black/30 tracking-[4px] mb-1">
                                        {disabledReason || 'Make Offer'}
                                    </span>
                                    <span className={`text-2xl font-black italic uppercase leading-none tracking-tight ${isDisabled ? 'opacity-30' : ''}`}>
                                        {isDisabled ? disabledReason.toUpperCase() : `Bid ${getNextBidUI()}`}
                                    </span>
                                </div>
                            </button>
                        );
                    })() : (
                    ) : (
                        <button
                            onClick={() => onNavigate('team-selection')}
                            className="flex-1 rounded-xl bg-amber-600 active:scale-[0.98] transition-all shadow-[0_0_40px_-5px_rgba(245,158,11,0.4)]"
                        >
                            <div className="relative flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black uppercase text-black/30 tracking-[4px] mb-1">
                                    Spectating
                                </span>
                                <span className="text-2xl font-black italic uppercase leading-none tracking-tight">
                                    Join Game
                                </span>
                            </div>
                        </button>
                    )}
                    <button
                        onClick={() => setShowSetModal(true)}
                        className="w-16 bg-[#181818] rounded-xl flex items-center justify-center border border-white/5 active:bg-[#222]"
                    >
                        <div className="flex flex-col gap-1.5 items-center opacity-40">
                            <div className="w-5 h-0.5 bg-white rounded-full"></div>
                            <div className="w-5 h-0.5 bg-white rounded-full"></div>
                            <div className="w-5 h-0.5 bg-white rounded-full"></div>
                        </div>
                    </button>
                </div>
            </div>

            {/* COMPACT TABS NAV */}
            <div className="bg-[#050505] flex border-y border-white/5 shrink-0 z-10">
                {['chat', 'squad', 'teams', 'settings'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        disabled={tab === 'settings' && !isAdmin}
                        className={`flex-1 h-10 text-[9px] font-black uppercase tracking-[2px] transition-colors ${activeTab === tab ? 'text-amber-500 bg-white/5 border-b-2 border-amber-500' : tab === 'settings' && !isAdmin ? 'text-white/5 cursor-not-allowed' : 'text-white/20'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* SCROLLABLE VIEWPORT - Hidden Scrollbar */}
            <div className="flex-1 overflow-hidden relative bg-black w-full">

                {/* CHAT TAB */}
                {activeTab === 'chat' && (
                    <div className="h-full flex flex-col inset-0 absolute">
                        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-3 flex flex-col-reverse gap-2">
                            {activity.map((item, i) => (
                                <div key={i} className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${item.user === currentUser.name ? 'items-end' : 'items-start'}`}>
                                    {item.type === 'sold' ? (
                                        <div className="w-full bg-[#111] border border-white/5 rounded-xl p-3 flex items-center justify-between mb-2 shadow-lg">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs">⚖️</div>
                                                <div>
                                                    <p className="text-[8px] uppercase text-white/30 leading-none mb-1 tracking-wider">Sold To {item.team}</p>
                                                    <p className="text-xs font-black uppercase italic text-white">{item.player.name}</p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-black text-emerald-400">{formatPrice(item.player.soldPrice)}</p>
                                        </div>
                                    ) : item.type === 'system' ? (
                                        <div className="text-[8px] uppercase font-bold text-white/20 text-center py-2 tracking-widest bg-white/[0.02] rounded my-1">
                                            {item.text}
                                        </div>
                                    ) : item.type === 'bid' ? (
                                        <div className="w-full flex items-center gap-2 opacity-40 my-0.5 px-2">
                                            <div className="h-[1px] flex-1 bg-white/10"></div>
                                            <p className="text-[8px] font-bold uppercase text-white/50">{item.team} bids {formatPrice(item.amount)}</p>
                                            <div className="h-[1px] flex-1 bg-white/10"></div>
                                        </div>
                                    ) : (
                                        <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs font-bold leading-relaxed ${item.user === currentUser.name ? 'bg-amber-600 text-white rounded-br-none' : 'bg-[#1a1a1a] text-white/70 rounded-bl-none'}`}>
                                            <span className="text-[7px] mb-0.5 block opacity-50 uppercase tracking-wider">{item.user}</span>
                                            {item.text}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-2 bg-[#0a0a0a] border-t border-white/5 flex gap-2 shrink-0">
                            <input
                                className="flex-1 bg-[#111] rounded-lg px-3 text-xs h-10 focus:ring-1 focus:ring-amber-500 outline-none font-bold"
                                placeholder="COMMS CHANNEL..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                            />
                            <button onClick={handleSendChat} className="w-10 h-10 bg-[#222] rounded-lg flex items-center justify-center text-amber-500 active:bg-amber-600 active:text-white">➤</button>
                        </div>
                    </div>
                )}

                {/* TEAMS LAYOUT */}
                {activeTab === 'teams' && (
                    <div className="h-full overflow-y-auto no-scrollbar p-3">
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(teams).map(t => {
                                const isOnline = onlineUsers.some(u => u.team === t.name && u.isOnline === true);
                                return (
                                    <div key={t.name} className="bg-[#111] p-3 rounded-xl border border-white/5 flex flex-col justify-between h-24 relative overflow-hidden">
                                        {isOnline && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>}
                                        <span className="text-xl font-black uppercase text-white/10 absolute -bottom-2 -right-1">{t.name}</span>
                                        <div>
                                            <p className="text-lg font-black uppercase leading-none">{t.name}</p>
                                            <p className="text-[8px] font-bold text-white/30 uppercase mt-1">{t.players.length} Players</p>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[7px] uppercase text-white/20 font-bold mb-0.5">Purse Left</p>
                                                <p className="text-sm font-black text-emerald-500">{formatPrice(t.purse)}</p>
                                            </div>
                                            {(t.rtmCards > 0) && (
                                                <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded shadow-[0_0_10px_-2px_rgba(245,158,11,0.2)]">
                                                    <span className="text-[8px] font-black italic text-amber-500">RTM</span>
                                                    <span className="text-[9px] font-black text-white">{t.rtmCards}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* SQUAD LAYOUT */}
                {activeTab === 'squad' && (
                    <div className="h-full flex flex-col">
                        {/* Header: Selector & Stats */}
                        <div className="p-3 bg-[#111] border-b border-white/5 shrink-0 space-y-3 z-10">
                            <div className="relative">
                                {/* Custom Trigger */}
                                <button
                                    onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                                    className="w-full bg-[#050505] border border-white/10 rounded-xl h-12 px-4 flex items-center justify-between font-black uppercase text-white hover:border-amber-500 transition-colors"
                                >
                                    <span>
                                        {viewTeam}
                                        {onlineUsers.some(u => u.team === viewTeam && u.isOnline === true)
                                            ? <span className="text-emerald-500 ml-2 text-xs animate-pulse">●</span>
                                            : <span className="text-red-500 ml-2 text-xs">●</span>}
                                    </span>
                                    <span className="text-amber-500 text-[10px]">▼</span>
                                </button>

                                {/* Dropdown Menu */}
                                {showTeamDropdown && (
                                    <div className="absolute top-14 left-0 w-full bg-[#111] border border-white/10 rounded-xl z-50 overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar">
                                        {Object.values(teams).map(t => {
                                            const isOnline = onlineUsers.some(u => u.team === t.name && u.isOnline === true);
                                            const onlineCount = onlineUsers.filter(u => u.team === t.name && u.isOnline === true).length;
                                            return (
                                                <button
                                                    key={t.name}
                                                    onClick={() => {
                                                        setViewTeam(t.name);
                                                        setShowTeamDropdown(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 font-bold uppercase text-sm border-b border-white/5 last:border-0 flex justify-between items-center"
                                                >
                                                    <span className={viewTeam === t.name ? 'text-amber-500' : 'text-white'}>{t.name}</span>
                                                    {isOnline
                                                        ? <span className="text-emerald-500 text-[8px] tracking-wider flex items-center gap-1">
                                                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                                            ONLINE {onlineCount > 1 ? `(${onlineCount})` : ''}
                                                        </span>
                                                        : <span className="text-red-500 text-[8px] tracking-wider">OFFLINE</span>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {teams[viewTeam] && (
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-[#1a1a1a] rounded p-2 text-center flex flex-col justify-center border border-white/5">
                                        <span className="text-[7px] font-bold uppercase text-white/30 tracking-wider mb-0.5">Players</span>
                                        <span className="font-black text-xs text-white">{teams[viewTeam].players.length}<span className="text-white/20 text-[8px]">/25</span></span>
                                    </div>
                                    <div className="bg-[#1a1a1a] rounded p-2 text-center flex flex-col justify-center border border-white/5">
                                        <span className="text-[7px] font-bold uppercase text-white/30 tracking-wider mb-0.5">Overseas</span>
                                        <span className="font-black text-xs text-amber-500">{teams[viewTeam].overseasCount}<span className="text-white/20 text-[8px]">/8</span></span>
                                    </div>
                                    <div className="bg-[#1a1a1a] rounded p-2 text-center flex flex-col justify-center border border-white/5">
                                        <span className="text-[7px] font-bold uppercase text-white/30 tracking-wider mb-0.5">Indian</span>
                                        <span className="font-black text-sm text-blue-400">{teams[viewTeam].players.length - teams[viewTeam].overseasCount}</span>
                                    </div>
                                    <div className="bg-[#1a1a1a] rounded p-2 text-center flex flex-col justify-center border border-white/5">
                                        <span className="text-[7px] font-bold uppercase text-white/30 tracking-wider mb-0.5">RTM Left</span>
                                        <span className="font-black text-sm text-amber-500">{teams[viewTeam].rtmCards || 0}</span>
                                    </div>
                                    <div className="bg-[#1a1a1a] rounded p-2 text-center flex flex-col items-center justify-center border border-white/5 col-span-2">
                                        <span className="text-[7px] font-bold uppercase text-white/30 tracking-wider mb-0.5">Spent</span>
                                        <span className="font-black text-sm text-white leading-tight">{formatPrice(teams[viewTeam].totalSpent)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* List - Compact without stats */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1.5">
                            {teams[viewTeam]?.players.map((p, i) => (
                                <div key={i} className="flex justify-between items-center p-2 bg-[#111] rounded-lg border border-white/5">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="font-black text-[10px] uppercase text-white tracking-tight truncate">{p.name}</span>
                                        {p.isRetained && (
                                            <span className="px-1 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[5px] font-black uppercase text-amber-500 shrink-0">
                                                R
                                            </span>
                                        )}
                                        {p.isRTM && !p.isRetained && (
                                            <span className="px-1 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[5px] font-black uppercase text-amber-500 shrink-0">
                                                RTM
                                            </span>
                                        )}
                                        {p.isOverseas && (
                                            <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0"></span>
                                        )}
                                    </div>
                                    <span className="font-black text-[10px] text-emerald-400 shrink-0 ml-2">{formatPrice(p.soldPrice)}</span>
                                </div>
                            ))}
                            {teams[viewTeam]?.players.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 pb-10">
                                    <p className="font-black uppercase tracking-widest text-xs">No Acquisitions</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SETTINGS - Admin Only */}
                {activeTab === 'settings' && isAdmin && (
                    <div className="h-full p-4 flex flex-col gap-6">
                        <div className="bg-[#111] p-4 rounded-xl border border-white/5">
                            <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-3">Hammer Speed</p>
                            <div className="grid grid-cols-3 gap-2">
                                {[10, 15, 20].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => updateSettings(s)}
                                        className={`py-2 rounded-lg font-black text-xs border border-transparent ${timerDuration === s ? 'bg-amber-600 text-white' : 'bg-black text-white/30 border-white/10'}`}
                                    >
                                        {s}s
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[#111] p-4 rounded-xl border border-white/5 opacity-50 pointer-events-none">
                            <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-3">Admin Rules</p>
                            <p className="text-[10px] text-white/50">Only host can control the flow. Pause or End from the header.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            {showSetModal && (
                <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-6 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <div>
                            <h3 className="text-3xl font-black italic uppercase tracking-tighter">Auction <span className="text-amber-500">Intel</span></h3>
                            <p className="text-[9px] font-bold uppercase text-white/30 tracking-widest">Real-time Player Database</p>
                        </div>
                        <button onClick={() => setShowSetModal(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold hover:bg-white/20 transition-colors">✕</button>
                    </div>

                    {/* Modal Tabs */}
                    <div className="flex border-b border-white/10 mb-4 shrink-0">
                        {['upcoming', 'sold', 'unsold'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setSetTab(tab)}
                                className={`px-6 py-3 text-[10px] font-black uppercase tracking-[2px] transition-colors border-b-2 ${setTab === tab ? 'text-white border-amber-500' : 'text-white/30 border-transparent hover:text-white/60'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar relative">
                        {/* UPCOMING TAB */}
                        {setTab === 'upcoming' && (
                            <div className="space-y-6">
                                {(() => {
                                    // Group upcoming players by set
                                    const upcoming = shuffledPool.slice(currentPlayerIndex + 1);
                                    if (upcoming.length === 0) return <div className="text-white/30 text-center py-10 font-black uppercase text-xs tracking-widest">No players remaining</div>;

                                    // Simple manual grouping to avoid complex Object.groupBy for compatibility
                                    const grouped = {};
                                    upcoming.forEach(p => {
                                        const setKey = p.set || 'Unset';
                                        if (!grouped[setKey]) grouped[setKey] = [];
                                        grouped[setKey].push(p);
                                    });

                                    return Object.entries(grouped).map(([set, players]) => (
                                        <div key={set}>
                                            <h4 className="text-emerald-500 font-black text-xs uppercase tracking-widest mb-2 sticky top-0 bg-black/95 py-2 z-10">{set} ({players[0]?.category || 'Pool'})</h4>
                                            <div className="space-y-2">
                                                {players.map((p, i) => (
                                                    <div key={i} className="p-3 bg-[#111] rounded-xl border border-white/5 flex justify-between items-center opacity-80 hover:opacity-100 hover:border-white/10 transition-all">
                                                        <div>
                                                            <p className="font-black text-sm uppercase">{p.name}</p>
                                                            <p className="text-[8px] font-bold uppercase text-white/40">{p.role} • {p.country}</p>
                                                        </div>
                                                        <span className="text-xs font-bold text-white/30">{formatPrice(p.basePrice)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}

                        {/* SOLD TAB */}
                        {setTab === 'sold' && (
                            <div className="space-y-2">
                                {(() => {
                                    // Aggregate all sold players from teams
                                    const allSold = Object.values(teams).flatMap(t => t.players).sort((a, b) => b.soldPrice - a.soldPrice);
                                    if (allSold.length === 0) return <div className="text-white/30 text-center py-10 font-black uppercase text-xs tracking-widest">No players sold yet</div>;

                                    return allSold.map((p, i) => (
                                        <div key={i} className="p-3 bg-[#111] rounded-xl border border-white/5 flex justify-between items-center">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="font-black text-amber-500 text-lg w-8 text-center shrink-0">{i + 1}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-black text-sm uppercase truncate">{p.name}</p>
                                                        {p.isRetained && (
                                                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[7px] font-black uppercase text-amber-500 shrink-0">
                                                                RETAINED
                                                            </span>
                                                        )}
                                                        {p.isRTM && !p.isRetained && (
                                                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[7px] font-black uppercase text-amber-500 shrink-0">
                                                                RTM
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[8px] font-bold uppercase text-white/40">
                                                        {p.isRetained ? 'Retained by' : 'Sold to'} {p.winner}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-emerald-400 shrink-0 ml-3">{formatPrice(p.soldPrice)}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}

                        {/* UNSOLD TAB */}
                        {setTab === 'unsold' && (
                            <div className="space-y-2">
                                {(() => {
                                    const unsold = room?.unsold || [];
                                    if (unsold.length === 0) return <div className="text-white/30 text-center py-10 font-black uppercase text-xs tracking-widest">No unsold players</div>;

                                    return unsold.map((p, i) => (
                                        <div key={i} className="p-3 bg-[#111] rounded-xl border border-white/5 flex justify-between items-center">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm uppercase text-red-400/80 line-through truncate">{p.name}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <p className="text-[8px] font-bold uppercase text-white/40">{p.role}</p>
                                                    {p.country && <p className="text-[8px] font-bold uppercase text-white/30">{p.country}</p>}
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-white/30 shrink-0 ml-3">{formatPrice(p.basePrice)}</span>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showExitConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8">
                    <div className="bg-[#151515] p-6 rounded-2xl w-full max-w-sm border border-white/10 text-center shadow-2xl">
                        <h3 className="text-lg font-black uppercase italic mb-2">Exit Arena?</h3>
                        <p className="text-xs text-white/40 mb-6">You can return to this room anytime from Recent games.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowExitConfirm(false)} className="py-3 rounded-xl bg-white/5 font-bold text-xs hover:bg-white/10">CANCEL</button>
                            <button 
                                onClick={() => {
                                    // Exit room - disconnect and clear state (preserves history)
                                    exitRoom();
                                    // Navigate to landing page
                                    setShowExitConfirm(false);
                                    onNavigate('landing');
                                    // Update URL to landing
                                    window.history.pushState({}, '', '/');
                                }} 
                                className="py-3 rounded-xl bg-red-600 font-bold text-xs hover:bg-red-700"
                            >
                                CONFIRM
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GLOBAL RTM MODAL */}
            {room?.status === 'RTM_PHASE' && room.rtmState && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-[#0a0a0a] border border-amber-500/20 rounded-[3rem] p-8 text-center shadow-[0_0_100px_-20px_rgba(245,158,11,0.2)] animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        {/* Decorative Background Element */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50"></div>

                        <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <span className="text-4xl font-black text-amber-500 italic">RTM</span>
                        </div>

                        {room.rtmState.stage === 'INTENT' ? (
                            <>
                                <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tighter text-white">Exercise RTM?</h3>
                                <p className="text-[11px] text-white/40 mb-8 uppercase tracking-[2px] leading-relaxed px-4">
                                    {room.rtmState.previousTeam} can challenge <span className="text-white font-bold">{room.rtmState.currentBid.team}</span>'s bid of <span className="text-emerald-400 font-bold">{formatPrice(room.rtmState.currentBid.amount)}</span>.
                                </p>

                                {currentUser?.team === room.rtmState.previousTeam ? (
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={() => rtmDecision('USE_RTM')}
                                            className="w-full h-16 bg-amber-500 hover:bg-amber-400 text-black font-black py-3 px-4 rounded-[1.5rem] uppercase italic tracking-widest text-xs shadow-xl shadow-amber-900/20 active:scale-95 transition-all"
                                        >
                                            USE RTM ⚡
                                        </button>
                                        <button
                                            onClick={() => rtmDecision('PASS')}
                                            className="w-full h-14 bg-white/5 hover:bg-white/10 text-white/30 font-black py-3 px-4 rounded-[1.5rem] uppercase italic tracking-tighter text-[10px] border border-white/5"
                                        >
                                            Pass on Player
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-[9px] font-black uppercase tracking-[4px] text-amber-500/50 animate-pulse">Waiting for {room.rtmState.previousTeam}</p>
                                    </div>
                                )}
                            </>
                        ) : room.rtmState.stage === 'HIKE' ? (
                            <>
                                <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tighter text-white">Increase Your Bid</h3>
                                <p className="text-[11px] text-white/40 mb-6 uppercase tracking-[2px] leading-relaxed px-4">
                                    {room.rtmState.currentBid.team}, you have one chance to hike the price.
                                </p>

                                {currentUser?.team === room.rtmState.currentBid.team ? (
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                                            <button
                                                onClick={() => setHikeValue(Math.max(room.rtmState.currentBid.amount, hikeValue - 20000000))}
                                                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-xl hover:bg-white/10 active:scale-90 transition-all text-red-500"
                                            >
                                                -
                                            </button>
                                            <div className="flex-1">
                                                <p className="text-2xl font-black text-white italic tracking-tighter">{formatPrice(hikeValue)}</p>
                                                <p className={`text-[8px] font-black uppercase mt-1 ${hikeValue > room.rtmState.currentBid.amount ? 'text-emerald-500' : 'text-white/20'}`}>
                                                    Hiked by {formatPrice(hikeValue - room.rtmState.currentBid.amount)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setHikeValue(hikeValue + 20000000)}
                                                className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-xl hover:bg-white/10 active:scale-90 transition-all text-emerald-500"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => rtmDecision('SUBMIT_HIKE', hikeValue)}
                                            className="w-full h-16 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 px-4 rounded-[1.5rem] uppercase italic tracking-widest text-xs shadow-xl shadow-emerald-900/20 active:scale-95 transition-all"
                                        >
                                            CONFIRM HIKE 🔨
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-[9px] font-black uppercase tracking-[4px] text-emerald-500/50 animate-pulse">Waiting for {room.rtmState.currentBid.team} to hike</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <h3 className="text-2xl font-black uppercase italic mb-2 tracking-tighter text-white">The Final Decision</h3>
                                <p className="text-[11px] text-white/40 mb-8 uppercase tracking-[2px] leading-relaxed px-4">
                                    Price hiked to <span className="text-amber-500 font-bold">{formatPrice(room.rtmState.newAmount)}</span>.<br />
                                    <span className="text-white">{room.rtmState.previousTeam}</span>, will you match?
                                </p>

                                {currentUser?.team === room.rtmState.previousTeam ? (
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={() => rtmDecision('MATCH')}
                                            className="w-full h-16 bg-amber-500 hover:bg-amber-400 text-black font-black py-3 px-4 rounded-[1.5rem] uppercase italic tracking-widest text-xs shadow-xl shadow-amber-900/20 active:scale-95 transition-all"
                                        >
                                            MATCH @ {formatPrice(room.rtmState.newAmount)} 🤝
                                        </button>
                                        <button
                                            onClick={() => rtmDecision('PASS')}
                                            className="w-full h-14 bg-white/5 hover:bg-white/10 text-white/30 font-black py-3 px-4 rounded-[1.5rem] uppercase italic tracking-tighter text-[10px] border border-white/5"
                                        >
                                            Pass Player
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-[9px] font-black uppercase tracking-[4px] text-amber-500/50 animate-pulse">Match Decision: {room.rtmState.previousTeam}</p>
                                    </div>
                                )}
                            </>
                        )}
                        <div className="mt-8 flex items-center justify-center gap-2">
                            <span className="text-[10px] font-black text-red-500 uppercase animate-pulse">{timer}s</span>
                            <div className="flex-1 w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${(timer / 15) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
