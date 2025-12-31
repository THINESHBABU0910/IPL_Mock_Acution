import { useState, useEffect } from 'react';
import { useAuctionStore } from '../store/auctionStore';

export default function Landing({ onNavigate }) {
    const [name, setName] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [mode, setMode] = useState('create'); // 'create' or 'join'
    const [config, setConfig] = useState({ allowRetention: false, allowRTM: true });

    const createRoom = useAuctionStore((state) => state.createRoom);
    const joinRoom = useAuctionStore((state) => state.joinRoom);
    const currentUser = useAuctionStore((state) => state.currentUser);
    const recentArenas = useAuctionStore((state) => state.recentArenas);

    // Auto-fill name from persisted session
    useEffect(() => {
        if (currentUser?.name) {
            setName(currentUser.name);
        }
    }, [currentUser]);

    useEffect(() => {
        const path_code = window.location.pathname.substring(1);
        if (path_code && path_code.length === 6) {
            setMode('join');
            setRoomCode(path_code.toUpperCase());
        }
    }, []);

    const showNotification = useAuctionStore((state) => state.showNotification);

    const handleAction = () => {
        if (!name.trim()) return showNotification('Identify yourself, Commander.', 'error');

        if (mode === 'create') {
            createRoom(name, config);
            onNavigate('team-selection');
        } else {
            if (!roomCode.trim()) return showNotification('Enter a Room Code to join.', 'error');
            joinRoom(roomCode.toUpperCase(), name);
            onNavigate('team-selection');
        }
    };

    const handleResume = (room) => {
        if (!name.trim()) {
            return showNotification("Enter your name first!", "error");
        } else {
            joinRoom(room.code, name);
        }
        onNavigate('auction');
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
                        )}

                        <button
                            onClick={handleAction}
                            className={`w-full h-14 rounded-xl font-black uppercase tracking-widest text-xs active:scale-[0.98] transition-all shadow-lg mt-2 ${mode === 'create' ? 'bg-amber-600 shadow-amber-900/20' : 'bg-emerald-600 shadow-emerald-900/20'}`}
                        >
                            {mode === 'create' ? 'Initialize Arena' : 'Connect to Sector'}
                        </button>
                    </div>
                </div>

                {recentArenas && recentArenas.length > 0 && (
                    <div className="pt-2">
                        <p className="text-[9px] font-black uppercase text-white/20 tracking-widest mb-3 ml-1">Recent Sectors</p>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
                            {recentArenas.map((room) => (
                                <button
                                    key={room.code}
                                    onClick={() => handleResume(room)}
                                    className="flex-shrink-0 w-28 bg-[#111] border border-white/5 p-3 rounded-xl text-left active:bg-[#222]"
                                >
                                    <span className="text-amber-500 font-black text-xs block mb-1">#{room.code}</span>
                                    <span className="text-[8px] uppercase text-white/30 block truncate">Host: {room.creator}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 text-[8px] font-black uppercase text-white/10 tracking-[4px]">v2.1.0 • Secure Link</div>
        </div >
    );
}
