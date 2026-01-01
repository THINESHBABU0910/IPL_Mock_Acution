import { useState, useEffect } from 'react';
import { useAuctionStore } from '../store/auctionStore';

const TEAM_COLORS = {
    CSK: '#FFCB05', MI: '#004BA0', RCB: '#EC1C24', KKR: '#3A225D',
    SRH: '#F7A721', RR: '#EA1A85', DC: '#0078BC', LSG: '#3BD0E4',
    GT: '#1B2133', PBKS: '#DD1F2D'
};

export default function TeamSelection({ onNavigate }) {
    const teams = useAuctionStore((state) => state.teams);
    const selectTeam = useAuctionStore((state) => state.selectTeam);
    const currentUser = useAuctionStore((state) => state.currentUser);
    const onlineUsers = useAuctionStore((state) => state.onlineUsers);

    const [selected, setSelected] = useState(currentUser?.team || null);
    const [phase, setPhase] = useState('TEAM_SELECT'); // TEAM_SELECT | RETENTION
    const [retentions, setRetentions] = useState([]);
    const [availablePlayers, setAvailablePlayers] = useState([]);
    const [playersData, setPlayersData] = useState([]);

    // Load players data for retention lookup
    useEffect(() => {
        import('../data/players.json').then(data => {
            setPlayersData(data.players);
        });
    }, []);

    // Filter players when team is selected
    useEffect(() => {
        if (selected && playersData.length > 0) {
            const teamPlayers = playersData.filter(p => p.previousTeam === selected);
            setAvailablePlayers(teamPlayers);
            setRetentions([]);
        }
    }, [selected, playersData]);

    const showNotification = useAuctionStore((state) => state.showNotification);

    const handleRetentionToggle = (player) => {
        const isRetained = retentions.find(r => r.id === player.id);

        if (isRetained) {
            setRetentions(retentions.filter(r => r.id !== player.id));
        } else {
            // Validate Limits
            if (retentions.length >= 6) return showNotification("Max 6 Retentions allowed!", "error");

            const cappedCount = retentions.filter(r => r.isCapped).length;
            const uncappedCount = retentions.filter(r => !r.isCapped).length;

            if (player.isCapped) {
                if (cappedCount >= 4) return showNotification("Max 4 Capped players allowed!", "error");
            } else {
                if (uncappedCount >= 2) return showNotification("Max 2 Uncapped players allowed!", "error");
            }

            setRetentions([...retentions, player]);
        }
    };

    const calculateCost = () => {
        const capped = retentions.filter(p => p.isCapped);
        const uncapped = retentions.filter(p => !p.isCapped);

        const cappedCosts = [180000000, 140000000, 110000000, 180000000];
        const uncappedCosts = [40000000, 40000000];

        let total = 0;
        capped.forEach((_, i) => total += (cappedCosts[i] || 0));
        uncapped.forEach((_, i) => total += (uncappedCosts[i] || 0));

        return total;
    };

    const getRTMCount = () => {
        return 6 - retentions.length;
    };

    const handleFinalConfirm = () => {
        if (selected) {
            selectTeam(selected, retentions, getRTMCount(), calculateCost());
            // Wait a bit for server to process, then navigate
            setTimeout(() => {
                onNavigate('auction');
            }, 300);
        }
    };

    if (phase === 'RETENTION') {
        const totalCost = calculateCost();
        const rtmCount = getRTMCount();

        const getRetentionCost = (player, index) => {
            const capped = retentions.filter(p => p.isCapped).indexOf(player);
            const uncapped = retentions.filter(p => !p.isCapped).indexOf(player);
            
            if (player.isCapped) {
                const cappedCosts = [180000000, 140000000, 110000000, 180000000];
                return cappedCosts[capped] || 0;
            } else {
                const uncappedCosts = [40000000, 40000000];
                return uncappedCosts[uncapped] || 0;
            }
        };

        const formatPrice = (price) => {
            if (!price) return '₹0';
            if (price < 10000000) return `₹${(price / 100000).toFixed(0)}L`;
            return `₹${(price / 10000000).toFixed(2)}Cr`;
        };

        return (
            <div className="h-screen bg-black text-white flex flex-col p-6 animate-in fade-in duration-300">
                <div className="mb-4 shrink-0 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none mb-1">
                            Retention <span className="text-amber-500">Phase</span>
                        </h1>
                        <p className="text-[10px] uppercase text-white/40 tracking-widest">{selected} Squad Selection</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase text-white/30">Purse Impact</p>
                        <p className="text-xl font-black text-red-500">-{formatPrice(totalCost)}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-24">
                    {availablePlayers.length === 0 ? (
                        <div className="text-white/30 text-center text-xs mt-10">No players available from previous squad.</div>
                    ) : availablePlayers.map(p => {
                        const isSelected = retentions.some(r => r.id === p.id);
                        const retentionCost = isSelected ? getRetentionCost(p, retentions.indexOf(retentions.find(r => r.id === p.id))) : 0;
                        return (
                            <button
                                key={p.id}
                                onClick={() => handleRetentionToggle(p)}
                                className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all ${isSelected
                                    ? 'bg-amber-500/10 border-amber-500'
                                    : 'bg-[#111] border-white/5 opacity-60 hover:opacity-100'
                                    }`}
                            >
                                <div className="text-left flex-1 min-w-0">
                                    <p className={`font-black text-sm uppercase truncate ${isSelected ? 'text-amber-500' : 'text-white'}`}>{p.name}</p>
                                    <p className="text-[9px] font-bold uppercase text-white/30">{p.role} • {p.isCapped ? 'Capped' : 'Uncapped'}</p>
                                </div>
                                {isSelected && (
                                    <div className="text-right shrink-0 ml-3">
                                        <span className="text-xs font-black text-emerald-500 block">RETAINED</span>
                                        <span className="text-[9px] font-black text-amber-500">{formatPrice(retentionCost)}</span>
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-6 bg-black z-20 border-t border-white/10 space-y-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-white/40">
                        <span>Retained: {retentions.length}/6</span>
                        <span>RTM Cards: {rtmCount}</span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setPhase('TEAM_SELECT')}
                            className="flex-1 h-12 rounded-xl bg-[#222] font-black text-xs uppercase text-white/50"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleFinalConfirm}
                            className="flex-[2] h-12 rounded-xl bg-emerald-600 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/20 active:scale-95"
                        >
                            Confirm Squad
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen bg-black text-white flex flex-col p-6 animate-in slide-in-from-right duration-300">
            <div className="mb-6 shrink-0">
                <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none mb-2">
                    Choose <br /><span className="text-emerald-500">Franchise</span>
                </h1>
                <p className="text-[10px] uppercase text-white/40 tracking-widest">Select your Auction Base</p>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-20">
                {useAuctionStore.getState().IPL_TEAMS.map((teamId) => {
                    const teamData = teams[teamId];
                    const takenBy = onlineUsers.find(u => u.team === teamId && u.name !== currentUser?.name);
                    const isTaken = !!takenBy;
                    const isSelected = selected === teamId;

                    return (
                        <button
                            key={teamId}
                            disabled={isTaken}
                            onClick={() => setSelected(teamId)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isSelected
                                ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                                : isTaken
                                    ? 'bg-[#111] opacity-40 border-transparent cursor-not-allowed'
                                    : 'bg-[#111] border-white/5 active:bg-[#222]'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-1.5 h-8 rounded-full"
                                    style={{ backgroundColor: TEAM_COLORS[teamId] }}
                                ></div>
                                <div className="text-left">
                                    <span className="font-black text-lg uppercase leading-none block">{teamData.name}</span>
                                    {isTaken && <span className="text-[8px] uppercase font-bold tracking-widest text-red-500">Taken by {takenBy.name}</span>}
                                </div>
                            </div>
                            {isSelected && <span className="font-black text-lg text-black">✓</span>}
                        </button>
                    );
                })}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
                {useAuctionStore.getState().room?.config?.allowRetention ? (
                    <button
                        disabled={!selected}
                        onClick={() => setPhase('RETENTION')}
                        className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-[4px] transition-all ${selected
                            ? 'bg-amber-500 text-black shadow-[0_0_30px_rgba(245,158,11,0.4)] active:scale-95'
                            : 'bg-[#222] text-white/20'
                            }`}
                    >
                        Proceed to Retention
                    </button>
                ) : (
                    <button
                        disabled={!selected}
                        onClick={() => {
                            if (selected) {
                                // Default RTM Logic if No Retention Phase: 6 if enabled, else 0
                                const rtmCount = useAuctionStore.getState().room?.config?.allowRTM ? 6 : 0;
                                selectTeam(selected, [], rtmCount, 0);
                                // Wait a bit for server to process, then navigate
                                setTimeout(() => {
                                    onNavigate('auction');
                                }, 300);
                            }
                        }}
                        className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-[4px] transition-all ${selected
                            ? 'bg-emerald-600 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95'
                            : 'bg-[#222] text-white/20'
                            }`}
                    >
                        Confirm Squad {useAuctionStore.getState().room?.config?.allowRTM ? '(+6 RTM)' : '(Mega Auction)'}
                    </button>
                )}
            </div>
        </div>
    );
}
