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
            lastRoomCode: null, // Track last room for auto-rejoin

            connect: (userName, roomCode, action = 'JOIN', config = {}) => {
                // Close existing connection safely (but DON'T clear room data - it's preserved on server)
                if (socket) {
                    // Only close if socket is in a state that allows closing
                    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                        try {
                            socket.close();
                        } catch (e) {
                            console.log('Socket already closed or closing');
                        }
                    }
                    socket = null;
                }
                
                // If joining a different room, clear current room VIEW state (not server data)
                // Server data is always preserved - we just clear the local view
                const currentRoom = get().room?.code;
                if (currentRoom && roomCode && currentRoom !== roomCode) {
                    // Switching to a different room - clear local view state only
                    // Server still has all the data for both rooms
                    set({
                        teams: INITIAL_TEAMS,
                        shuffledPool: [],
                        currentPlayerIndex: 0,
                        currentBid: null,
                        timer: 15,
                        activity: [],
                        onlineUsers: []
                    });
                }
                
                const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8081';
                
                try {
                    socket = new WebSocket(wsUrl);
                } catch (error) {
                    console.error('Failed to create WebSocket:', error);
                    get().showNotification('Failed to connect to server. Please check if server is running.', 'error');
                    set({ isConnected: false });
                    return;
                }

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
                        
                        // Update recent arenas - NO LIMIT, keep ALL rooms forever
                        const recentArenas = get().recentArenas || [];
                        const existingIndex = recentArenas.findIndex(r => r.code === room.code);
                        const roomEntry = {
                            code: room.code,
                            creator: room.creator,
                            status: room.status,
                            lastAccessed: Date.now()
                        };
                        
                        if (existingIndex >= 0) {
                            // Update existing room entry with new lastAccessed time
                            recentArenas[existingIndex] = roomEntry;
                        } else {
                            // Add new room to the beginning (most recent first)
                            recentArenas.unshift(roomEntry);
                            // NO LIMIT - keep all rooms forever for history
                        }
                        
                        // Check if user already has a team in this SPECIFIC room
                        // Server sends room.players object which contains player data for THIS room
                        let userTeam = null;
                        if (room.players && room.players[userName]) {
                            userTeam = room.players[userName].team || null;
                        }
                        
                        // Also check playersList if provided
                        if (!userTeam && data.playersList) {
                            const myData = data.playersList.find(p => p.name === userName);
                            if (myData && myData.team) {
                                userTeam = myData.team;
                            }
                        }
                        
                        // COMPLETELY REPLACE state with this room's data
                        // This ensures each room has its own isolated state
                        set({
                            room: {
                                code: room.code,
                                creator: room.creator,
                                config: room.config,
                                status: room.status,
                                rtmState: room.rtmState,
                                unsold: room.unsold || []
                            },
                            // Replace ALL room-specific data with this room's data
                            teams: { ...room.teams }, // Deep copy to ensure isolation
                            shuffledPool: [...(room.pool || [])], // Deep copy
                            currentPlayerIndex: room.currentPlayerIndex || 0,
                            currentBid: room.currentBid ? { ...room.currentBid } : null,
                            timer: room.timer || 15,
                            timerDuration: room.timerDuration || 15,
                            activity: [...(room.activity || [])], // Deep copy
                            currentUser: { name: userName, team: userTeam }, // Team is room-specific
                            lastRoomCode: room.code,
                            recentArenas: recentArenas,
                            onlineUsers: data.playersList || []
                        });
                    }

                    if (data.type === 'STATE_UPDATE') {
                        const { room, playersList } = data;
                        
                        // Only update if this is for the current room
                        // This ensures room isolation - updates from other rooms are ignored
                        const currentRoomCode = get().room?.code;
                        if (currentRoomCode && room?.code && room.code !== currentRoomCode) {
                            // This update is for a different room, ignore it
                            console.log(`Ignoring STATE_UPDATE for different room: ${room.code} (current: ${currentRoomCode})`);
                            return;
                        }
                        
                        // If we don't have a room yet, this shouldn't happen, but be safe
                        if (!currentRoomCode && room?.code) {
                            // We received an update but don't have a room - might be stale, ignore
                            return;
                        }
                        
                        set(state => ({
                            room: { 
                                ...state.room, 
                                status: room.status, 
                                isPaused: room.isPaused, 
                                config: room.config, 
                                rtmState: room.rtmState,
                                unsold: room.unsold || []
                            },
                            // Update with deep copies to ensure room isolation
                            teams: { ...room.teams },
                            shuffledPool: [...(room.pool || [])],
                            currentPlayerIndex: room.currentPlayerIndex,
                            currentBid: room.currentBid ? { ...room.currentBid } : null,
                            timerDuration: room.timerDuration,
                            activity: [...(room.activity || [])],
                            onlineUsers: playersList || []
                        }));

                        // Update my own team if it changed on server (for this room)
                        const myData = playersList?.find(p => p.name === get().currentUser?.name);
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

                socket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    set({ isConnected: false });
                    get().showNotification('Connection error. Retrying...', 'error');
                    // Retry connection after delay
                    setTimeout(() => {
                        if (!get().isConnected && get().room?.code && get().currentUser?.name) {
                            console.log("Attempting reconnect after error...");
                            get().joinRoom(get().room.code, get().currentUser.name);
                        }
                    }, 2000);
                };

                socket.onclose = (event) => {
                    set({ isConnected: false });
                    // Only auto-reconnect if it wasn't a manual close
                    if (event.code !== 1000 && event.code !== 1001) {
                        // Unexpected close - try to reconnect
                        setTimeout(() => {
                            if (!get().isConnected && get().room?.code && get().currentUser?.name) {
                                console.log("Attempting reconnect after close...");
                                get().joinRoom(get().room.code, get().currentUser.name);
                            }
                        }, 3000);
                    }
                };
            },

            createRoom: (userName, config = {}) => {
                // Clear any existing room state before creating new room
                get().clearRoomState();
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
                if (!currentUser?.team) return { success: false, reason: "Select a team first to bid!" };

                const team = teams[currentUser.team];
                if (!team) return { success: false, reason: "Team not found!" };

                // Calculate next bid amount using IPL rules
                const nextAmount = get().getNextBidAmount(currentBid?.amount, player.basePrice);
                
                // Validate all constraints
                if (team.purse < nextAmount) return { success: false, reason: "Money Over!" };
                if (player.isOverseas && team.overseasCount >= 8) return { success: false, reason: "OS Over!" };
                if (team.players.length >= 25) return { success: false, reason: "Squad Full!" };

                // Just send the bid intent
                if (socket && socket.readyState === WebSocket.OPEN) {

                    socket.send(JSON.stringify({ type: 'PLACE_BID', amount: nextAmount }));
                    return { success: true };
                }
                return { success: false, reason: "Connection lost" };
            },

            addChat: (text) => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'CHAT', text }));
                } else {
                    get().showNotification('Not connected. Please wait...', 'error');
                }
            },

            startGame: () => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'START_GAME' }));
                } else {
                    get().showNotification('Not connected. Please wait...', 'error');
                }
            },

            togglePause: (isPaused) => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    const type = isPaused ? 'RESUME_GAME' : 'PAUSE_GAME';
                    socket.send(JSON.stringify({ type }));
                } else {
                    get().showNotification('Not connected. Please wait...', 'error');
                }
            },

            endGame: () => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'END_GAME' }));
                } else {
                    get().showNotification('Not connected. Please wait...', 'error');
                }
            },

            updateSettings: (newDuration) => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'UPDATE_SETTINGS', timerDuration: newDuration }));
                } else {
                    get().showNotification('Not connected. Please wait...', 'error');
                }
            },

            rtmDecision: (decision, amount = null) => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'RTM_DECISION', decision, amount }));
                } else {
                    get().showNotification('Not connected. Please wait...', 'error');
                }
            },

            getNextBidAmount: (currentAmount, basePrice) => {
                // IPL Auction Rules:
                // - Start at base price
                // - If base price >= 2 Cr (20M), increments are 0.25 Cr (2.5M)
                // - If base price < 2 Cr, increments are 0.2 Cr (2M) up to 2 Cr, then 0.25 Cr
                if (!currentAmount || currentAmount < basePrice) return basePrice;
                
                // If current amount is >= 2 Cr (20M), increment by 0.25 Cr (2.5M)
                if (currentAmount >= 20000000) {
                    return currentAmount + 2500000; // 0.25 Cr increment
                }
                
                // If base price >= 2 Cr, always use 0.25 Cr increments
                if (basePrice >= 20000000) {
                    return currentAmount + 2500000; // 0.25 Cr increment
                }
                
                // For base price < 2 Cr, increment by 0.2 Cr (2M) until we reach 2 Cr
                return currentAmount + 2000000; // 0.2 Cr increment
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
                // Complete reset - clear current session but PRESERVE recentArenas history
                // This allows users to see all their rooms even after reset
                const recentArenas = get().recentArenas || []; // Preserve history
                set({ 
                    room: null, 
                    currentUser: null, 
                    teams: INITIAL_TEAMS,
                    shuffledPool: [],
                    currentPlayerIndex: 0,
                    currentBid: null,
                    timer: 15,
                    timerDuration: 15,
                    activity: [],
                    onlineUsers: [],
                    isConnected: false,
                    lastRoomCode: null,
                    recentArenas: recentArenas // Keep all room history
                });
            },
            
            // Helper to clear room state when leaving a room (preserves history)
            clearRoomState: () => {
                // Close socket connection safely
                if (socket) {
                    try {
                        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                            socket.close(1000, 'User leaving room'); // Normal closure
                        }
                    } catch (e) {
                        console.log('Socket already closed');
                    }
                    socket = null;
                }
                // Clear current room state but preserve user info and room history
                set({
                    room: null,
                    teams: INITIAL_TEAMS,
                    shuffledPool: [],
                    currentPlayerIndex: 0,
                    currentBid: null,
                    timer: 15,
                    activity: [],
                    onlineUsers: [],
                    isConnected: false
                    // Keep: currentUser, lastRoomCode, recentArenas
                });
            },
            
            // Exit room - disconnect and go to landing (preserves all history)
            exitRoom: () => {
                get().clearRoomState();
            }
        }),
        {
            name: 'auction-storage-ws',
            partialize: (state) => ({ 
                currentUser: state.currentUser,
                lastRoomCode: state.lastRoomCode,
                recentArenas: state.recentArenas || []
            }), // Persist user info, last room, and recent arenas
        }
    )
);
