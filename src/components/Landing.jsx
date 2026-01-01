import { useState, useEffect } from 'react';
import { useAuctionStore } from '../store/auctionStore';

export default function Landing({ onNavigate }) {
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [mode, setMode] = useState('create'); // 'create' or 'join' or 'recent'
    const [config, setConfig] = useState({ allowRetention: false, allowRTM: true });

    const createRoom = useAuctionStore((state) => state.createRoom);
    const joinRoom = useAuctionStore((state) => state.joinRoom);
    const currentUser = useAuctionStore((state) => state.currentUser);
    const recentArenas = useAuctionStore((state) => state.recentArenas || []);
    const lastRoomCode = useAuctionStore((state) => state.lastRoomCode);
    const room = useAuctionStore((state) => state.room);
    const isConnected = useAuctionStore((state) => state.isConnected);

    // Auto-fill name from persisted session
    useEffect(() => {
        if (currentUser?.name) {
            setName(currentUser.name);
        }
    }, [currentUser]);

    // Helper to get saved name from localStorage
    const getSavedName = () => {
        if (currentUser?.name) return currentUser.name;
        try {
            const stored = localStorage.getItem('auction-storage-ws');
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed?.state?.currentUser?.name;
            }
        } catch (e) {}
        return null;
    };

    // Auto-join logic: ONLY if URL has room code (not on landing page)
    useEffect(() => {
        const path_code = window.location.pathname.substring(1);
        // Only auto-join if URL has a room code (not just landing page)
        if (path_code && path_code.length === 6) {
            const code = path_code.toUpperCase();
            setMode('join');
            setRoomCode(code);
            
            // Auto-join if user has name saved
            const savedName = getSavedName();
            
            if (savedName && savedName.trim()) {
                // Auto-join to the room from URL
                setTimeout(() => {
                    joinRoom(code, savedName);
                    // Navigation will be handled by App.jsx based on room status
                }, 100);
            }
        } else {
            // Landing page - reset mode to create, don't auto-join
            if (path_code === '' || path_code === '/') {
                setMode('create');
                setRoomCode('');
            }
        }
    }, []); // Only run once on mount

    // Navigate to team-selection when room is created (only if we're still on landing)
    useEffect(() => {
        if (room && room.status === 'WAITING' && isConnected && mode === 'create' && currentUser?.name === name.trim()) {
            // Room was just created by this user, navigate to team selection
            // Use a small delay to ensure state is updated
            const timer = setTimeout(() => {
                onNavigate('team-selection');
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [room?.code, isConnected, mode, currentUser?.name, name]);

    const showNotification = useAuctionStore((state) => state.showNotification);

    const handleAction = () => {
        if (!name.trim()) return showNotification('Identify yourself, Commander.', 'error');

        if (mode === 'create') {
            // Create room - retention selection happens in TeamSelection component
            // Navigation will happen automatically when room is created (see useEffect above)
            createRoom(name, config);
        } else if (mode === 'join') {
            if (!roomCode.trim()) return showNotification('Enter a Room Code to join.', 'error');
            joinRoom(roomCode.toUpperCase(), name);
            // Navigation will be handled by App.jsx based on room status
        }
    };

    const handleResume = (room) => {
        const userName = name.trim() || getSavedName();
        if (!userName) {
            return showNotification("Enter your name first!", "error");
        }
        // Update URL to room code
        window.history.pushState({}, '', `/${room.code}`);
        joinRoom(room.code, userName);
        // Navigation will be handled by App.jsx based on room status
    };

    return (
        <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)] z-0"></div>

            <div className="w-full max-w-sm z-10 flex flex-col gap-6">
                <header className="text-center mb-4">
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none mb-2">
                        Play <span className="text-amber-500">Mock</span>
                    </h1>
                    <p className="text-[9px] font-black uppercase text-white/20 tracking-[8px]">The Auction Arena</p>
                </header>

                {/* Control Center */}
                <div className="bg-[#111] border border-white/5 rounded-2xl p-4 space-y-4">
                    {/* Tabs */}
                    <div className="flex bg-black p-1 rounded-xl">
                        <button
                            onClick={() => setMode('create')}
                            className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'create' ? 'bg-amber-600 text-white shadow-lg' : 'text-white/30'}`}
                        >
                            Create
                        </button>
                        <button
                            onClick={() => setMode('join')}
                            className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'join' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/30'}`}
                        >
                            Join
                        </button>
                        <button
                            onClick={() => setMode('recent')}
                            className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'recent' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/30'}`}
                        >
                            Recent
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <p className="text-[8px] uppercase font-bold text-white/30 ml-1 mb-1 tracking-wider">Pilot Name</p>
                            <input
                                type="text"
                                placeholder="ENTER ID..."
                                className="w-full bg-[#050505] border border-white/10 h-12 px-4 rounded-xl font-black uppercase text-sm outline-none focus:border-amber-500/50 transition-colors placeholder:text-white/10"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        {mode === 'join' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <p className="text-[8px] uppercase font-bold text-white/30 ml-1 mb-1 tracking-wider">Sector Code</p>
                                <input
                                    type="text"
                                    placeholder="X7K9P2"
                                    className="w-full bg-[#050505] border border-white/10 h-12 px-4 rounded-xl font-black uppercase text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-white/10"
                                    value={roomCode}
                                    onChange={(e) => setRoomCode(e.target.value)}
                                />
                            </div>
                        )}

                        {mode === 'create' && (
                            <>
                                <div className="flex gap-2">
                                    <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-[#050505] border border-white/10 rounded-xl cursor-pointer hover:border-amber-500/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={config.allowRetention}
                                            onChange={e => {
                                                const val = e.target.checked;
                                                setConfig({ ...config, allowRetention: val, allowRTM: val ? false : config.allowRTM });
                                            }}
                                            className="accent-amber-500 w-4 h-4"
                                        />
                                        <span className="text-[9px] font-black uppercase text-white/60 tracking-wider">Retention</span>
                                    </label>
                                    <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-[#050505] border border-white/10 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={config.allowRTM}
                                            onChange={e => {
                                                const val = e.target.checked;
                                                setConfig({ ...config, allowRTM: val, allowRetention: val ? false : config.allowRetention });
                                            }}
                                            className="accent-emerald-500 w-4 h-4"
                                        />
                                        <span className="text-[9px] font-black uppercase text-white/60 tracking-wider">RTM Cards</span>
                                    </label>
                                </div>
                                
                                {config.allowRetention && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <p className="text-[8px] font-black uppercase text-amber-500 tracking-widest mb-1">Retention Mode Active</p>
                                        <p className="text-[9px] text-white/60">You'll select retention players after choosing your team.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {mode === 'recent' && (
                            <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
                                {recentArenas.length === 0 ? (
                                    <div className="text-center py-8 text-white/20 text-[9px] uppercase tracking-widest">
                                        No Recent Rooms
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-[8px] uppercase text-white/30 mb-2 px-1">
                                            {recentArenas.length} Room{recentArenas.length !== 1 ? 's' : ''} • All History Preserved
                                        </div>
                                        {recentArenas.map((room) => (
                                            <button
                                                key={room.code}
                                                onClick={() => handleResume(room)}
                                                className="w-full bg-[#050505] border border-white/10 p-3 rounded-xl text-left hover:border-blue-500/50 transition-colors active:bg-[#111]"
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-blue-500 font-black text-sm">#{room.code}</span>
                                                    <span className={`text-[7px] uppercase font-bold px-2 py-0.5 rounded ${
                                                        room.status === 'LIVE' ? 'bg-emerald-500/20 text-emerald-500' :
                                                        room.status === 'FINISHED' ? 'bg-amber-500/20 text-amber-500' :
                                                        'bg-white/10 text-white/40'
                                                    }`}>
                                                        {room.status || 'WAITING'}
                                                    </span>
                                                </div>
                                                <p className="text-[8px] uppercase text-white/40 truncate">Host: {room.creator}</p>
                                                {room.lastAccessed && (
                                                    <p className="text-[7px] text-white/20 mt-1">
                                                        Last played: {new Date(room.lastAccessed).toLocaleDateString()} {new Date(room.lastAccessed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                )}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}

                        {mode !== 'recent' && (
                            <button
                                onClick={handleAction}
                                className={`w-full h-14 rounded-xl font-black uppercase tracking-widest text-xs active:scale-[0.98] transition-all shadow-lg mt-2 ${mode === 'create' ? 'bg-amber-600 shadow-amber-900/20' : 'bg-emerald-600 shadow-emerald-900/20'}`}
                            >
                                {mode === 'create' ? 'Initialize Arena' : 'Connect to Sector'}
                            </button>
                        )}
                    </div>
                </div>

            </div>

            <div className="absolute bottom-6 text-[8px] font-black uppercase text-white/10 tracking-[4px]">v2.1.0 • Secure Link</div>
        </div >
    );
}
