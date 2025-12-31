import { useState } from 'react';
import { useAuctionStore } from '../store/auctionStore';

export default function Summary({ onNavigate }) {
    const [selectedTeamName, setSelectedTeamName] = useState(null);

    const teams = useAuctionStore((state) => state.teams);
    const currentUser = useAuctionStore((state) => state.currentUser);
    const reset = useAuctionStore((state) => state.reset);

    const formatPrice = (price) => {
        return `₹${(price / 10000000).toFixed(2)} Cr`;
    };

    const teamsList = Object.values(teams);
    const activeTeamName = selectedTeamName || currentUser?.team;
    const selectedTeam = teams[activeTeamName];

    const handleExit = () => {
        if (confirm('Permanently close this session and reset stats?')) {
            reset();
            onNavigate('landing');
        }
    };

    const shareSquad = () => {
        const text = `🏆 ${selectedTeam.name} - FINAL SQUAD\nSpent: ${formatPrice(120_00_00_000 - selectedTeam.purse)}\n\nSquad:\n${selectedTeam.players.map((p, i) => `${i + 1}. ${p.name} (${formatPrice(p.soldPrice)})`).join('\n')}`;
        if (navigator.share) navigator.share({ title: `${selectedTeam.name} Squad`, text });
        else {
            navigator.clipboard.writeText(text);
            alert('Copied to clipboard!');
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col p-6 pb-26 overflow-hidden">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">WAR ROOM<br /><span className="text-amber-500">DEBRIEF</span></h1>
                <p className="text-[10px] font-black text-white/20 tracking-[8px] mt-2 uppercase">Official Results</p>
            </div>

            {/* Team Ribbon */}
            <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
                {teamsList.map(t => (
                    <button
                        key={t.name}
                        onClick={() => setSelectedTeamName(t.name)}
                        className={`flex-shrink-0 px-6 py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${activeTeamName === t.name ? 'border-amber-500 bg-amber-500/10' : 'border-white/5 bg-white/5 text-white/20'}`}
                    >
                        {t.name}
                    </button>
                ))}
            </div>

            {selectedTeam ? (
                <div className="flex-1 overflow-hidden flex flex-col gap-6 animate-in fade-in slide-in-from-bottom duration-500">
                    <div className="glass-card p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter italic leading-none">{selectedTeam.name}</h2>
                                <p className="text-[10px] font-black text-white/20 uppercase mt-2">Franchise Account</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-black text-emerald-400 leading-none">{formatPrice(selectedTeam.purse)}</p>
                                <p className="text-[9px] font-black text-white/20 uppercase mt-1 tracking-widest">Available</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 text-center">
                                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Squad Size</p>
                                <p className="text-xl font-black">{selectedTeam.players.length}</p>
                            </div>
                            <div className="bg-white/5 p-5 rounded-[2rem] border border-white/5 text-center">
                                <p className="text-[9px] font-black text-white/20 uppercase mb-1">Overseas</p>
                                <p className="text-xl font-black">{selectedTeam.overseasCount}/8</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
                        <h3 className="text-[10px] font-black uppercase text-white/30 tracking-widest px-2 mb-2">Acquisitions</h3>
                        {selectedTeam.players.map((p, i) => (
                            <div key={i} className="flex justify-between items-center p-5 bg-white/[0.02] border border-white/5 rounded-[2rem]">
                                <div>
                                    <p className="font-black text-sm uppercase italic leading-none mb-1">{p.name}</p>
                                    <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{p.role}</p>
                                </div>
                                <p className="font-black text-amber-500 text-sm tracking-tighter">{formatPrice(p.soldPrice)}</p>
                            </div>
                        ))}
                        {selectedTeam.players.length === 0 && (
                            <div className="py-24 text-center opacity-20">
                                <p className="font-black uppercase tracking-[8px]">No Trades Finalized</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center opacity-10">
                    <p className="font-black uppercase tracking-[12px]">Select Realm</p>
                </div>
            )}

            {/* FOOTER ACTIONS */}
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-3xl border-t border-white/5 flex gap-4 z-50">
                <button className="flex-1 h-14 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95" onClick={shareSquad}>SHARE SQUAD 📤</button>
                <button className="flex-1 h-14 bg-red-600/10 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-500/20 active:scale-95" onClick={handleExit}>RESET GAME 🔄</button>
            </div>
        </div>
    );
}
