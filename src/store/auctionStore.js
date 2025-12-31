import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const IPL_TEAMS = ['CSK', 'MI', 'RCB', 'KKR', 'SRH', 'RR', 'DC', 'LSG', 'GT', 'PBKS'];

const INITIAL_TEAMS = IPL_TEAMS.reduce((acc, team) => ({
    ...acc,
    [team]: {
        name: team,
        purse: 1200000000,
        players: [],
        overseasCount: 0,
        totalSpent: 0
    }
}), {});

let socket = null;

export const useAuctionStore = create()(
    persist(
        (set, get) => ({
            room: null,
            currentUser: null,
            teams: INITIAL_TEAMS,
            activeTab: 'live',
            shuffledPool: [],
            currentPlayerIndex: 0,
            currentBid: null,
            timer: 15,
            timerDuration: 15,
            activity: [],
            onlineUsers: [],
            recentArenas: [],
            IPL_TEAMS: IPL_TEAMS,
            isConnected: false,
            notification: null, // { message, type }
            confirmation: null, // { message, onConfirm }

            connect: (userName, roomCode, action = 'JOIN', config = {}) => {
                if (socket) socket.close();
                const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8081';
                socket = new WebSocket(wsUrl);

                socket.onopen = () => {
                    set({ isConnected: true });
                    if (action === 'CREATE') {
                        socket.send(JSON.stringify({
                            type: 'CREATE_ROOM',
                            userName,
                            initialTeams: INITIAL_TEAMS,
                            config
                        }));
                    } else {
                        socket.send(JSON.stringify({ type: 'JOIN_ROOM', code: roomCode, userName }));
                    }
                };

                socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);

                    if (data.type === 'ROOM_CREATED' || data.type === 'JOIN_SUCCESS') {
                        const { room } = data;
                        set({
                            room: {
                                code: room.code,
                                creator: room.creator,
                                config: room.config,
                                status: room.status,
                                rtmState: room.rtmState
                            },
                            teams: room.teams,
                            shuffledPool: room.pool,
                            currentPlayerIndex: room.currentPlayerIndex,
                            currentBid: room.currentBid,
                            timer: room.timer,
                            timerDuration: room.timerDuration,
                            activity: room.activity,
                            currentUser: { name: userName, team: null } // Team update will come from STATE_UPDATE
                        });
                    }

                    if (data.type === 'STATE_UPDATE') {
                        const { room, playersList } = data;
                        set(state => ({
                            room: { ...state.room, status: room.status, isPaused: room.isPaused, config: room.config, rtmState: room.rtmState },
                            teams: room.teams,
                            shuffledPool: room.pool, // Added: Ensure pool stays in sync
                            currentPlayerIndex: room.currentPlayerIndex,
                            currentBid: room.currentBid,
                            timerDuration: room.timerDuration,
                            activity: room.activity,
                            onlineUsers: playersList
                        }));

                        // Update my own team if it changed on server
                        const myData = playersList.find(p => p.name === get().currentUser?.name);
                        if (myData && myData.team) {
                            set(state => ({ currentUser: { ...state.currentUser, team: myData.team } }));
                        }
                    }

                    if (data.type === 'TIMER_UPDATE') {
                        set({ timer: data.timer });
                    }

                    if (data.type === 'ERROR') {
                        get().showNotification(data.message, 'error');
                    }
                };

                socket.onclose = () => {
                    set({ isConnected: false });
                    // Basic Auto-Reconnect
                    setTimeout(() => {
                        if (!get().isConnected && get().room?.code && get().currentUser?.name) {
                            console.log("Attempting reconnect...");
                            get().joinRoom(get().room.code, get().currentUser.name);
                        }
                    }, 3000);
                };
            },

            createRoom: (userName, config = {}) => {
                get().connect(userName, null, 'CREATE', config);
            },

            joinRoom: (code, userName) => {
                get().connect(userName, code, 'JOIN');
            },

            selectTeam: (teamName, retentions = [], rtmCount = 6, retentionCost = 0) => {
                if (socket && socket.readyState === 1) {
                    // Optimistic update to prevent loop-back redirection
                    set(state => ({ currentUser: { ...state.currentUser, team: teamName } }));

                    socket.send(JSON.stringify({
                        type: 'SELECT_TEAM',
                        team: teamName,
                        retentions,
                        rtmCount,
                        retentionCost
                    }));
                }
            },

            placeBid: (player) => {
                // Validation first
                const { currentBid, currentUser, teams } = get();
                if (!currentUser?.team) return { success: false, reason: "Select a team first!" };

                const team = teams[currentUser.team];
                // Calculate locally to validate (server will double check)
                const amount = currentBid?.amount || (player.basePrice - 2000000); // Hacky local check, server is auth

                // Just send the bid intent
                if (socket && socket.readyState === 1) {
                    const nextAmount = get().getNextBidAmount(currentBid?.amount, player.basePrice);
                    if (team.purse < nextAmount) return { success: false, reason: "Insufficient Purse!" };
                    if (player.isOverseas && team.overseasCount >= 8) return { success: false, reason: "OS limit reached!" };
                    if (team.players.length >= 25) return { success: false, reason: "Squad limit reached!" };

                    socket.send(JSON.stringify({ type: 'PLACE_BID', amount: nextAmount }));
                    return { success: true };
                }
                return { success: false, reason: "Connection lost" };
            },

            addChat: (text) => {
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({ type: 'CHAT', text }));
                }
            },

            startGame: () => {
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({ type: 'START_GAME' }));
                }
            },

            togglePause: (isPaused) => {
                if (socket && socket.readyState === 1) {
                    const type = isPaused ? 'RESUME_GAME' : 'PAUSE_GAME';
                    socket.send(JSON.stringify({ type }));
                }
            },

            endGame: () => {
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({ type: 'END_GAME' }));
                }
            },

            updateSettings: (newDuration) => {
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({ type: 'UPDATE_SETTINGS', timerDuration: newDuration }));
                }
            },

            rtmDecision: (decision, amount = null) => {
                if (socket && socket.readyState === 1) {
                    socket.send(JSON.stringify({ type: 'RTM_DECISION', decision, amount }));
                }
            },

            getNextBidAmount: (currentAmount, basePrice) => {
                if (!currentAmount || currentAmount < basePrice) return basePrice;
                if (currentAmount < 50000000) return currentAmount + 2000000;
                if (currentAmount < 100000000) return currentAmount + 5000000;
                return currentAmount + 10000000;
            },

            showNotification: (message, type = 'info') => {
                set({ notification: { message, type } });
                setTimeout(() => set({ notification: null }), 3000);
            },

            confirmAction: (message, onConfirm) => {
                set({ confirmation: { message, onConfirm } });
            },

            reset: () => {
                if (socket) socket.close();
                set({ room: null, currentUser: null, teams: INITIAL_TEAMS });
            }
        }),
        {
            name: 'auction-storage-ws',
            partialize: (state) => ({ currentUser: state.currentUser }), // Only persist user info
        }
    )
);
