import { useState, useRef } from 'react';
import { useAuctionStore } from '../store/auctionStore';

export default function Summary({ onNavigate }) {
    const [view, setView] = useState('overview'); // overview | squads
    const [selectedTeamName, setSelectedTeamName] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const exportRef = useRef(null);

    const teams = useAuctionStore((state) => state.teams);
    const currentUser = useAuctionStore((state) => state.currentUser);
    const room = useAuctionStore((state) => state.room);
    const showNotification = useAuctionStore((state) => state.showNotification);
    const confirmAction = useAuctionStore((state) => state.confirmAction);
    const reset = useAuctionStore((state) => state.reset);

    const formatPrice = (price) => {
        if (!price) return '₹0';
        return `₹${(price / 10000000).toFixed(2)} Cr`;
    };

    const teamsList = Object.values(teams);

    // Global Stats Calculation
    const allPlayers = teamsList.flatMap(t => t.players);
    const mostExpensive = allPlayers.length > 0 ? [...allPlayers].sort((a, b) => b.soldPrice - a.soldPrice)[0] : null;
    const totalSpent = teamsList.reduce((acc, t) => acc + t.totalSpent, 0);
    const topSpender = [...teamsList].sort((a, b) => b.totalSpent - a.totalSpent)[0];

    const roleStats = allPlayers.reduce((acc, p) => {
        acc[p.role] = (acc[p.role] || 0) + p.soldPrice;
        return acc;
    }, {});

    const activeTeamName = selectedTeamName || currentUser?.team;
    const selectedTeam = teams[activeTeamName];

    const handleExit = () => {
        confirmAction('Reset session? You can still access all rooms from Recent games.', () => {
            reset();
            onNavigate('landing');
            // Update URL to landing
            window.history.pushState({}, '', '/');
        });
    };

    const shareSquad = async () => {
        if (!selectedTeam || isGenerating) return;

        if (!window.htmlToImage) {
            const text = `🏆 ${selectedTeam.name} - FINAL SQUAD\nSpent: ${formatPrice(selectedTeam.totalSpent)}\n\nSquad:\n${selectedTeam.players.map((p, i) => `${i + 1}. ${p.name} (${formatPrice(p.soldPrice)})`).join('\n')}`;
            if (navigator.share) {
                navigator.share({ title: `${selectedTeam.name} Squad`, text });
            } else {
                navigator.clipboard.writeText(text).then(() => {
                    showNotification('Squad copied to clipboard!', 'success');
                });
            }
            return;
        }

        setIsGenerating(true);
        try {
            await new Promise(r => setTimeout(r, 100));
            const dataUrl = await window.htmlToImage.toPng(exportRef.current, {
                backgroundColor: '#050505',
                quality: 1,
                pixelRatio: 3
            });

            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `${selectedTeam.name.replace(/\s+/g, '_')}_Squad.png`, { type: 'image/png' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `${selectedTeam.name} Final Squad`,
                    text: `Check out my final ${selectedTeam.name} squad from the IPL Auction!`
                });
            } else {
                const link = document.createElement('a');
                link.download = `${selectedTeam.name.replace(/\s+/g, '_')}_Squad.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showNotification('Squad image saved to downloads!', 'success');
            }
        } catch (error) {
            console.error('Export failed', error);
            showNotification('Image generation failed.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col p-6 pb-32 overflow-hidden fixed inset-0">
            {/* HIDDEN EXPORT TEMPLATE */}
            <div className="fixed left-[-9999px] top-0 pointer-events-none">
                <div ref={exportRef} className="w-[800px] bg-[#050505] p-12 text-white font-sans flex flex-col border-[20px] border-[#111]">
                    <div className="text-center mb-12">
                        <h1 className="text-6xl font-black italic tracking-tighter uppercase leading-[0.8] mb-4">AUCTION<br /><span className="text-amber-500">DEBRIEF 2025</span></h1>
                        <p className="text-base font-black text-white/30 uppercase tracking-[15px]">Official Franchise Roster</p>
                    </div>

                    <div className="bg-[#111] p-10 rounded-[4rem] border border-white/5 mb-10">
                        <div className="flex justify-between items-center mb-10">
                            <div className="max-w-[60%]">
                                <h2 className="text-5xl font-black uppercase italic tracking-tighter text-white truncate">{selectedTeam?.name}</h2>
                                <p className="text-xl font-bold text-white/40 uppercase tracking-widest mt-2">{selectedTeam?.players.length} Players Secured</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-5xl font-black text-emerald-400">{formatPrice(selectedTeam?.totalSpent)}</p>
                                <p className="text-xl font-bold text-white/40 uppercase tracking-widest mt-2">Total Investment</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="bg-white/5 p-6 rounded-3xl text-center border border-white/5">
                                <p className="text-lg font-black text-white/20 uppercase mb-1">Overseas Stars</p>
                                <p className="text-4xl font-black">{selectedTeam?.overseasCount} / 8</p>
                            </div>
                            <div className="bg-white/5 p-6 rounded-3xl text-center border border-white/5">
                                <p className="text-lg font-black text-white/20 uppercase mb-1">RTM Utilized</p>
                                <p className="text-4xl font-black text-amber-500">{selectedTeam?.players.filter(p => p.isRTM).length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {selectedTeam?.players.sort((a, b) => b.soldPrice - a.soldPrice).map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-6 bg-white/[0.03] border border-white/5 rounded-[2rem]">
                                <div className="overflow-hidden mr-4 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-black text-xl uppercase italic leading-none truncate">{p.name}</p>
                                        {p.isRetained && (
                                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[8px] font-black uppercase text-amber-500 shrink-0">
                                                RETAINED
                                            </span>
                                        )}
                                        {p.isRTM && !p.isRetained && (
                                            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[8px] font-black uppercase text-amber-500 shrink-0">
                                                RTM
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold text-white/20 uppercase tracking-widest">{p.role}</p>
                                </div>
                                <p className="font-black text-amber-500 text-xl tracking-tighter shrink-0">{formatPrice(p.soldPrice)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-16 pt-8 border-t border-white/10 flex justify-between items-center opacity-30">
                        <p className="text-lg font-black uppercase tracking-widest italic">IPL MEGA AUCTION SIMULATOR</p>
                        <p className="text-lg font-black uppercase tracking-widest">WAR ROOM OFFICIAL</p>
                    </div>
                </div>
            </div>
            <div className="mb-6 text-center animate-in fade-in duration-700">
                <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-[0.8]">AUCTION<br /><span className="text-amber-500">SUMMARY</span></h1>
                <div className="flex justify-center gap-4 mt-4">
                    <button
                        onClick={() => setView('overview')}
                        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${view === 'overview' ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 text-white/40'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setView('squads')}
                        className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${view === 'squads' ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-white/5 text-white/40'}`}
                    >
                        Squads
                    </button>
                </div>
            </div>

            {view === 'overview' ? (
                <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar animate-in zoom-in-95 duration-300 pb-10">
                    {/* Global Cards */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#111] border border-white/5 p-3 rounded-2xl">
                            <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Total Valuation</p>
                            <p className="text-sm font-black text-emerald-400">{formatPrice(totalSpent)}</p>
                        </div>
                        <div className="bg-[#111] border border-white/5 p-3 rounded-2xl">
                            <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Players Sold</p>
                            <p className="text-sm font-black text-white">{allPlayers.length}</p>
                        </div>
                        <div className="bg-[#111] border border-white/5 p-3 rounded-2xl">
                            <p className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Unsold</p>
                            <p className="text-sm font-black text-red-400">{room?.unsold?.length || 0}</p>
                        </div>
                    </div>

                    {/* Spotlight */}
                    {mostExpensive && (
                        <div className="bg-gradient-to-br from-amber-500/20 to-transparent border border-amber-500/20 p-5 rounded-[2.5rem] relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <span className="material-icons text-5xl italic font-black">STAR</span>
                            </div>
                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-[4px] mb-3">Record Purchase</p>
                            <h3 className="text-2xl font-black italic uppercase leading-none mb-1 tracking-tighter">{mostExpensive.name}</h3>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 bg-black/40 rounded text-[8px] font-black uppercase text-white/60">{mostExpensive.team}</span>
                                <span className="text-emerald-400 font-black text-lg">{formatPrice(mostExpensive.soldPrice)}</span>
                            </div>
                        </div>
                    )}

                    {/* Spender List */}
                    <div className="bg-[#111] border border-white/5 rounded-[2.5rem] p-6">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-5">Financial Analysis</h3>
                        <div className="space-y-4">
                            {teamsList.sort((a, b) => b.totalSpent - a.totalSpent).map((t, i) => (
                                <div key={t.name} className="flex flex-col gap-1">
                                    <div className="flex justify-between items-end">
                                        <span className={`text-[10px] font-black uppercase ${i === 0 ? 'text-amber-500' : 'text-white/60'}`}>{t.name}</span>
                                        <span className="text-[10px] font-black text-white">{formatPrice(t.totalSpent)}</span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${i === 0 ? 'bg-amber-500' : 'bg-white/20'}`} style={{ width: `${(t.totalSpent / 120_00_00_000) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Role Distribution */}
                    <div className="bg-[#111] border border-white/5 rounded-[2.5rem] p-6 mb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-5">Role-Based Spending</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(roleStats).map(([role, amount]) => (
                                <div key={role} className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-white/20 tracking-widest mb-1">{role}</span>
                                    <span className="text-sm font-black text-white">{formatPrice(amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Unsold Players */}
                    {room?.unsold && room.unsold.length > 0 && (
                        <div className="bg-[#111] border border-white/5 rounded-[2.5rem] p-6 mb-8">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Unsold Players ({room.unsold.length})</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                                {room.unsold.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                                        <div>
                                            <p className="font-black text-[10px] uppercase text-red-400/80 line-through">{p.name}</p>
                                            <p className="text-[7px] font-bold uppercase text-white/30">{p.role} • {p.country}</p>
                                        </div>
                                        <span className="text-[9px] font-bold text-white/20">{formatPrice(p.basePrice)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex flex-col gap-4 animate-in slide-in-from-right duration-300">
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-1">
                        {teamsList.map(t => (
                            <button
                                key={t.name}
                                onClick={() => setSelectedTeamName(t.name)}
                                className={`flex-shrink-0 px-5 py-2 rounded-xl font-black text-[9px] uppercase border transition-all ${activeTeamName === t.name ? 'border-amber-500 bg-amber-500/10 text-amber-500' : 'border-white/5 bg-white/5 text-white/20'}`}
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>

                    {selectedTeam ? (
                        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
                            <div className="bg-[#111] border border-white/5 p-6 rounded-[2.5rem] shrink-0">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="overflow-hidden mr-4">
                                        <h2 className="text-xl font-black uppercase italic tracking-tighter leading-none truncate">{selectedTeam.name}</h2>
                                        <div className="flex gap-2 mt-2">
                                            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Avg. {formatPrice(selectedTeam.totalSpent / (selectedTeam.players.length || 1))} / player</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-emerald-400 leading-none">{formatPrice(selectedTeam.purse)}</p>
                                        <p className="text-[8px] font-black text-white/30 uppercase mt-1 tracking-widest">Remaining</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-white/5 p-3 rounded-2xl text-center">
                                        <p className="text-[7px] font-black text-white/20 uppercase mb-0.5">Size</p>
                                        <p className="text-xs font-black">{selectedTeam.players.length}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl text-center">
                                        <p className="text-[7px] font-black text-white/20 uppercase mb-0.5">Overseas</p>
                                        <p className="text-xs font-black">{selectedTeam.overseasCount}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl text-center">
                                        <p className="text-[7px] font-black text-white/20 uppercase mb-0.5">RTM</p>
                                        <p className="text-xs font-black text-amber-500">{selectedTeam.players.filter(p => p.isRTM).length}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar pb-8 px-1">
                                {selectedTeam.players.sort((a, b) => b.soldPrice - a.soldPrice).map((p, i) => (
                                    <div key={i} className="flex justify-between items-center p-2.5 bg-white/[0.03] border border-white/5 rounded-xl">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-[8px] font-black text-white/30 shrink-0">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <p className="font-black text-[10px] uppercase italic leading-tight truncate">{p.name}</p>
                                                    {p.isRetained && (
                                                        <span className="px-1 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[5px] font-black uppercase text-amber-500 shrink-0">
                                                            RETAINED
                                                        </span>
                                                    )}
                                                    {p.isRTM && !p.isRetained && (
                                                        <span className="px-1 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded text-[5px] font-black uppercase text-amber-500 shrink-0">
                                                            RTM
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <span className="text-[6px] font-bold text-white/30 uppercase">{p.role}</span>
                                                    {p.isOverseas && <span className="text-[6px] font-bold text-amber-500/60 uppercase">OS</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="font-black text-amber-500 text-[9px] tracking-tighter shrink-0 ml-2">{formatPrice(p.soldPrice)}</p>
                                    </div>
                                ))}
                                {selectedTeam.players.length === 0 && (
                                    <div className="py-20 text-center opacity-10">
                                        <p className="font-black uppercase tracking-[8px] text-[10px]">No Acquisitions</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center opacity-10">
                            <p className="font-black uppercase tracking-[10px] text-xs">Select Squad</p>
                        </div>
                    )}
                </div>
            )}

            {/* FOOTER ACTIONS */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-3xl border-t border-white/5 flex gap-3 z-50">
                <button
                    disabled={!selectedTeam || isGenerating}
                    className={`flex-1 h-12 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all ${isGenerating ? 'bg-amber-500 text-black' : 'bg-white text-black'}`}
                    onClick={shareSquad}
                >
                    {isGenerating ? 'GENERATING POSTER...' : `SHARE ${view === 'squads' ? 'SQUAD' : 'STATS'} 🖼️`}
                </button>
                <button className="flex-1 h-12 bg-red-600/10 text-red-500 rounded-xl font-black text-[9px] uppercase tracking-widest border border-red-500/20 active:scale-95" onClick={handleExit}>RESET SESSION 🔄</button>
            </div>
        </div>
    );
}
