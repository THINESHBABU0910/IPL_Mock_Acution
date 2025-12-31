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

    const [selected, setSelected] = useState(null);

    // Auto-navigate when team is confirmed by server
    useEffect(() => {
        if (currentUser?.team) {
            onNavigate('auction');
        }
    }, [currentUser?.team, onNavigate]);

    const handleConfirm = () => {
        if (selected) {
            selectTeam(selected);
            // Do not navigate immediately, waiting for server confirmation
        }
    };

    return (
        <div className="h-screen bg-black text-white flex flex-col p-6">
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
                                    ? 'bg-amber-500 text-black border-amber-500'
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
                            {isSelected && <span className="font-black text-lg">✓</span>}
                        </button>
                    );
                })}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent">
                <button
                    disabled={!selected}
                    onClick={handleConfirm}
                    className={`w-full h-14 rounded-2xl font-black text-sm uppercase tracking-[4px] transition-all ${selected
                            ? 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95'
                            : 'bg-[#222] text-white/20'
                        }`}
                >
                    Enter Arena
                </button>
            </div>
        </div>
    );
}
