import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'rooms_data.json');

// Load initial data
const playersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'data', 'players.json'), 'utf8'));

const PORT = process.env.PORT || 8081;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Auction Server is Live! 🏏');
});

const wss = new WebSocketServer({ server });

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Persistence Layer
// IMPORTANT: Rooms are NEVER deleted - all room data is preserved forever
// Players can join multiple rooms, play with different teams, and return anytime
// All room history, teams, players, and auction data is permanently stored
let rooms = {};
if (fs.existsSync(DATA_FILE)) {
    try {
        rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        console.log(`Loaded ${Object.keys(rooms).length} rooms from persistence`);
        // Reset player connections on restart (they need to reconnect)
        Object.values(rooms).forEach(room => {
            // Keep the players object but ensure no hanging socket references (JSON.parse handles this naturally, 
            // but we ensure they start as offline)
            Object.values(room.players).forEach(p => {
                p.isOnline = false;
                p.ws = null;
            });
        });
    } catch (e) {
        console.error("Failed to load rooms:", e);
    }
}

const saveRooms = () => {
    // Save ALL rooms - never delete any room data
    // This ensures players can return to any room anytime, even weeks later
    const dataToSave = {};
    Object.entries(rooms).forEach(([code, room]) => {
        // Serialize players: keep ALL data (name, team assignments), remove socket references
        const serializedPlayers = {};
        Object.entries(room.players).forEach(([name, p]) => {
            serializedPlayers[name] = {
                name: p.name,
                team: p.team, // Preserve team assignment per room
                isOnline: false // Always save as offline, they reconnect to become online
            };
        });

        // Save complete room state: teams, players, pool, activity, unsold, etc.
        dataToSave[code] = {
            ...room,
            players: serializedPlayers,
            timerInterval: null // Don't persist timer intervals
        };
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    console.log(`Saved ${Object.keys(dataToSave).length} rooms to persistence`);
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const generatePool = () => {
    const sets = playersData.categories.flatMap(c => c.sets);
    let pool = [];
    sets.forEach(setName => {
        const setPlayers = playersData.players.filter(p => p.set === setName);
        pool = [...pool, ...shuffleArray(setPlayers)];
    });
    return pool;
};

wss.on('connection', (ws) => {
    let currentUser = null;
    let currentRoom = null;

    // Handle connection errors gracefully
    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        // Don't crash - just log the error
    });

    ws.on('message', (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (error) {
            console.error('Failed to parse message:', error.message);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
            return;
        }

        // CREATE_ROOM
        if (data.type === 'CREATE_ROOM') {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            rooms[code] = {
                code,
                creator: data.userName,
                players: {},
                teams: data.initialTeams,
                pool: generatePool(),
                currentPlayerIndex: 0,
                currentBid: null,
                timer: 15,
                timerDuration: 15,
                timerInterval: null,
                activity: [],
                status: 'WAITING', // WAITING | LIVE
                isPaused: false,
                unsold: [],
                config: data.config || { allowRetention: false, allowRTM: true }
            };

            currentRoom = code;
            currentUser = data.userName;
            rooms[code].players[currentUser] = { ws, team: null, isOnline: true };

            // Send safe room object (without timerInterval and WebSocket references)
            const safeRoom = getSafeRoom(rooms[code]);
            try {
                ws.send(JSON.stringify({ type: 'ROOM_CREATED', code, room: safeRoom }));
            } catch (error) {
                console.error('Error sending ROOM_CREATED:', error.message);
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to create room data' }));
            }
            broadcastRoomUpdate(code);
            saveRooms();
        }

        // JOIN_ROOM
        if (data.type === 'JOIN_ROOM') {
            const { code, userName } = data;
            if (rooms[code]) {
                currentRoom = code;
                currentUser = userName;

                // Restore player's team if they had one (for this room)
                // Timer continues running in background regardless of player connections
                const existing = rooms[code].players[currentUser];
                rooms[code].players[currentUser] = { ws, team: existing?.team || null, isOnline: true };

                // Send current room state including current timer value
                // Player will see the game state as it is, even if they were disconnected
                // Use safe room object (without timerInterval and WebSocket references)
                const safeRoom = getSafeRoom(rooms[code]);
                const playersList = Object.entries(rooms[code].players || {}).map(([name, data]) => ({ 
                    name, 
                    team: data.team || null, 
                    isOnline: data.isOnline || false
                }));
                
                try {
                    ws.send(JSON.stringify({ 
                        type: 'JOIN_SUCCESS', 
                        room: safeRoom,
                        playersList 
                    }));
                } catch (error) {
                    console.error('Error sending JOIN_SUCCESS:', error.message);
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to send room data' }));
                }
                broadcastRoomUpdate(code);
                saveRooms(); // Save new player registration if we want to persist teams
            } else {
                ws.send(JSON.stringify({ type: 'ERROR', message: "Room not found" }));
            }
        }

        if (data.type === 'START_GAME') {
            if (rooms[currentRoom] && rooms[currentRoom].creator === currentUser) {
                rooms[currentRoom].status = 'LIVE';
                rooms[currentRoom].isPaused = false;
                rooms[currentRoom].activity.unshift({ type: 'system', text: 'AUCTION STARTED!' });
                broadcastRoomUpdate(currentRoom);
                startTimer(currentRoom);
                saveRooms();
            }
        }

        if (data.type === 'PAUSE_GAME') {
            if (rooms[currentRoom] && rooms[currentRoom].creator === currentUser) {
                rooms[currentRoom].isPaused = true;
                // Stop the timer - only admin can pause
                if (rooms[currentRoom].timerInterval) {
                    clearInterval(rooms[currentRoom].timerInterval);
                    rooms[currentRoom].timerInterval = null;
                }
                rooms[currentRoom].activity.unshift({ type: 'system', text: 'AUCTION PAUSED BY ADMIN' });
                broadcastRoomUpdate(currentRoom);
                saveRooms();
            }
        }

        if (data.type === 'RESUME_GAME') {
            if (rooms[currentRoom] && rooms[currentRoom].creator === currentUser) {
                rooms[currentRoom].isPaused = false;
                rooms[currentRoom].activity.unshift({ type: 'system', text: 'AUCTION RESUMED' });
                broadcastRoomUpdate(currentRoom);
                startTimer(currentRoom);
                saveRooms();
            }
        }

        if (data.type === 'END_GAME') {
            if (rooms[currentRoom] && rooms[currentRoom].creator === currentUser) {
                // Stop the timer permanently - only admin can end game
                if (rooms[currentRoom].timerInterval) {
                    clearInterval(rooms[currentRoom].timerInterval);
                    rooms[currentRoom].timerInterval = null;
                }
                rooms[currentRoom].status = 'FINISHED';
                rooms[currentRoom].isPaused = false; // Clear pause state
                rooms[currentRoom].activity.unshift({ type: 'system', text: 'AUCTION CONCLUDED BY ADMIN' });
                broadcastRoomUpdate(currentRoom);
                saveRooms();
            }
        }

        if (data.type === 'SELECT_TEAM') {
            if (rooms[currentRoom]) {
                const room = rooms[currentRoom];
                const team = room.teams[data.team];

                // Assign user to team
                room.players[currentUser].team = data.team;

                // Process Retentions (if provided and not already processed for this team)
                // Note: In a real app we'd validate this rigorously. Here we trust the client's calc for speed.
                if (data.retentions && data.retentions.length > 0) {
                    // Retention price slabs (as per IPL rules)
                    const cappedCosts = [180000000, 140000000, 110000000, 180000000]; // 18Cr, 14Cr, 11Cr, 18Cr
                    const uncappedCosts = [40000000, 40000000]; // 4Cr, 4Cr
                    
                    // Separate capped and uncapped players
                    const cappedPlayers = data.retentions.filter(p => p.isCapped);
                    const uncappedPlayers = data.retentions.filter(p => !p.isCapped);
                    
                    // Process capped players with their retention prices
                    cappedPlayers.forEach((p, index) => {
                        if (!team.players.some(tp => tp.id === p.id)) {
                            const retentionPrice = cappedCosts[index] || 0;
                            const retainedPlayer = {
                                ...p,
                                soldPrice: retentionPrice, // Assign proper retention price
                                isRetained: true,
                                winner: data.team
                            };
                            team.players.push(retainedPlayer);
                            if (p.isOverseas) team.overseasCount += 1;
                            
                            // REMOVE FROM POOL
                            room.pool = room.pool.filter(poolPlayer => poolPlayer.id !== p.id);
                        }
                    });
                    
                    // Process uncapped players with their retention prices
                    uncappedPlayers.forEach((p, index) => {
                        if (!team.players.some(tp => tp.id === p.id)) {
                            const retentionPrice = uncappedCosts[index] || 0;
                            const retainedPlayer = {
                                ...p,
                                soldPrice: retentionPrice, // Assign proper retention price
                                isRetained: true,
                                winner: data.team
                            };
                            team.players.push(retainedPlayer);
                            if (p.isOverseas) team.overseasCount += 1;
                            
                            // REMOVE FROM POOL
                            room.pool = room.pool.filter(poolPlayer => poolPlayer.id !== p.id);
                        }
                    });

                    // Deduct Purse
                    team.purse -= (data.retentionCost || 0);
                    team.totalSpent += (data.retentionCost || 0); // Count retention cost in spending

                    // Set RTM Cards
                    team.rtmCards = data.rtmCount; // e.g. 6 - retained
                } else {
                    // No retentions, default RTM
                    if (team.players.length === 0) { // Only set if fresh
                        team.rtmCards = 6;
                    }
                }

                broadcastRoomUpdate(currentRoom);
                saveRooms();
            }
        }

        // PLACE_BID
        if (data.type === 'PLACE_BID') {
            const room = rooms[currentRoom];
            if (room && room.status === 'LIVE') {
                if (room.currentBid && data.amount <= room.currentBid.amount) {
                    // Ignore bid if it's not higher (Race condition protection)
                    return;
                }

                room.currentBid = {
                    amount: data.amount,
                    userId: currentUser,
                    team: room.players[currentUser].team
                };

                // Incremental Timer Logic: Add 5 seconds, capped at max duration
                // This ensures quick bidding wars don't drag on forever, but last-second bids give a chance to react.
                room.timer = Math.min(room.timerDuration, room.timer + 5);

                room.activity.unshift({
                    type: 'bid',
                    team: room.players[currentUser].team,
                    user: currentUser,
                    amount: data.amount,
                    timestamp: Date.now()
                });

                broadcastRoomUpdate(currentRoom);
                startTimer(currentRoom);
                saveRooms(); // Optional: might be too frequent, but safe for small local app
            }
        }

        // CHAT
        if (data.type === 'CHAT') {
            if (rooms[currentRoom]) {
                rooms[currentRoom].activity.unshift({
                    type: 'chat',
                    user: currentUser,
                    team: rooms[currentRoom].players[currentUser]?.team || 'Fan',
                    text: data.text,
                    timestamp: Date.now()
                });
                broadcastRoomUpdate(currentRoom);
            }
        }

        if (data.type === 'UPDATE_SETTINGS') {
            if (rooms[currentRoom]) {
                if (data.timerDuration) rooms[currentRoom].timerDuration = data.timerDuration;
                broadcastRoomUpdate(currentRoom);
                saveRooms();
            }
        }

        if (data.type === 'RTM_DECISION') {
            const room = rooms[currentRoom];
            if (!room || room.status !== 'RTM_PHASE') return;
            const rtm = room.rtmState;

            // STAGE 1: Previous Team Intent (INTENT)
            if (rtm.owner === currentUser && rtm.stage === 'INTENT') {
                if (data.decision === 'USE_RTM') {
                    // Previous team says YES, now Winner must hike
                    rtm.stage = 'HIKE';
                    room.timer = 15;
                    room.activity.unshift({ type: 'system', text: `${rtm.previousTeam} wants to use RTM! ${rtm.currentBid.team} can now hike the bid.` });
                    broadcastRoomUpdate(currentRoom);
                    startTimer(currentRoom);
                } else {
                    // PASS - SOLD to previous winner at current price
                    room.status = 'LIVE';
                    const winningTeamName = rtm.currentBid.team;
                    const team = room.teams[winningTeamName];
                    const purchasedPlayer = { ...rtm.player, soldPrice: rtm.currentBid.amount, winner: winningTeamName };
                    team.players.push(purchasedPlayer);
                    team.purse -= rtm.currentBid.amount;
                    team.totalSpent += rtm.currentBid.amount;
                    if (rtm.player.isOverseas) team.overseasCount += 1;
                    room.activity.unshift({ type: 'sold', player: purchasedPlayer, team: winningTeamName });
                    finishRTM(currentRoom);
                }
            }
            // STAGE 2: Original Winner HIKE
            else if (rtm.currentBid.userId === currentUser && rtm.stage === 'HIKE') {
                if (data.decision === 'SUBMIT_HIKE') {
                    rtm.newAmount = data.amount;
                    rtm.stage = 'FINAL_MATCH';
                    room.timer = 15;
                    room.activity.unshift({ type: 'system', text: `${rtm.currentBid.team} hiked bid to ${formatPrice(rtm.newAmount)}! ${rtm.previousTeam}, will you match?` });
                    broadcastRoomUpdate(currentRoom);
                    startTimer(currentRoom);
                }
            }
            // STAGE 3: Previous Team FINAL MATCH
            else if (rtm.owner === currentUser && rtm.stage === 'FINAL_MATCH') {
                const amount = rtm.newAmount;
                const prevTeamName = rtm.previousTeam;
                const winnerTeamName = rtm.currentBid.team;

                if (data.decision === 'MATCH') {
                    // Previous team takes it at hiked price
                    const team = room.teams[prevTeamName];
                    const purchasedPlayer = { ...rtm.player, soldPrice: amount, winner: prevTeamName, isRTM: true };
                    team.players.push(purchasedPlayer);
                    team.purse -= amount;
                    team.totalSpent += amount;
                    team.rtmCards -= 1;
                    if (rtm.player.isOverseas) team.overseasCount += 1;
                    room.activity.unshift({ type: 'sold', player: purchasedPlayer, team: prevTeamName, text: `${prevTeamName} matched the hike!` });
                } else {
                    // Original Winner takes it at hiked price
                    const team = room.teams[winnerTeamName];
                    const purchasedPlayer = { ...rtm.player, soldPrice: amount, winner: winnerTeamName };
                    team.players.push(purchasedPlayer);
                    team.purse -= amount;
                    team.totalSpent += amount;
                    // Previous team still loses RTM card for forcing hike? 
                    // No, usually RTM is only "used" if they actually take the player.
                    // But rules say if they MATCH they get it. If they don't, Winner gets it.
                    // I'll stick to: RTM card only deducted if they take the player.
                    room.activity.unshift({ type: 'sold', player: purchasedPlayer, team: winnerTeamName, text: `${prevTeamName} passed. Sold to ${winnerTeamName} at hiked price.` });
                }
                finishRTM(currentRoom);
            }
            saveRooms();
        }
    });

    ws.on('close', () => {
        try {
            if (currentRoom && rooms[currentRoom] && rooms[currentRoom].players[currentUser]) {
                // Mark player as offline but DON'T stop the timer
                // Timer continues running in the background regardless of player connections
                rooms[currentRoom].players[currentUser].isOnline = false;
                // Don't clear the WebSocket reference - keep it for reconnection
                // rooms[currentRoom].players[currentUser].ws = null; // Keep for potential reconnection tracking
                broadcastRoomUpdate(currentRoom);
                // Timer continues - game proceeds even if all players disconnect
            }
        } catch (error) {
            console.error('Error handling WebSocket close:', error.message);
            // Don't crash - just log the error
        }
    });
});

function startTimer(code) {
    try {
        const room = rooms[code];
        if (!room) return;
        
        // Don't start timer if game is paused or finished
        if (room.isPaused || room.status === 'FINISHED') {
            return;
        }

        // Clear any existing timer
        if (room.timerInterval) {
            clearInterval(room.timerInterval);
            room.timerInterval = null;
        }

        // Timer runs independently of player connections
        // It continues even if all players disconnect
        room.timerInterval = setInterval(() => {
            try {
                // Double-check room still exists
                const currentRoom = rooms[code];
                if (!currentRoom) {
                    if (room.timerInterval) {
                        clearInterval(room.timerInterval);
                        room.timerInterval = null;
                    }
                    return;
                }
                
                // Double-check pause state (defensive programming)
                if (currentRoom.isPaused || currentRoom.status === 'FINISHED') {
                    clearInterval(currentRoom.timerInterval);
                    currentRoom.timerInterval = null;
                    return;
                }
                
                currentRoom.timer -= 1;
                
                // Broadcast timer update to all connected players (if any)
                // Timer continues even if no one is connected
                broadcastToRoom(code, { type: 'TIMER_UPDATE', timer: currentRoom.timer });

                if (currentRoom.timer <= 0) {
                    clearInterval(currentRoom.timerInterval);
                    currentRoom.timerInterval = null;
                    handleHammer(code);
                }
            } catch (error) {
                console.error('Error in timer interval:', error.message);
                // Clear timer on error to prevent infinite error loops
                const currentRoom = rooms[code];
                if (currentRoom && currentRoom.timerInterval) {
                    clearInterval(currentRoom.timerInterval);
                    currentRoom.timerInterval = null;
                }
            }
        }, 1000);
    } catch (error) {
        console.error('Error starting timer:', error.message);
        // Don't crash - just log the error
    }
}

function handleHammer(code) {
    const room = rooms[code];
    if (!room) return;

    if (room.status === 'RTM_PHASE') {
        const state = room.rtmState;

        if (state.stage === 'INTENT') {
            // Stage 1 Expired: Previous team passed automatically
            room.activity.unshift({ type: 'system', text: `RTM Expired! ${state.previousTeam} passed.` });
            room.status = 'LIVE';
            // Fall through to normal sale logic
        } else if (state.stage === 'HIKE') {
            // Stage 2 Expired: Winner didn't hike, move to final match at current price
            state.newAmount = state.currentBid.amount;
            state.stage = 'FINAL_MATCH';
            room.timer = 15;
            room.activity.unshift({ type: 'system', text: `Hike Expired! ${state.previousTeam} can match at original price.` });
            broadcastRoomUpdate(code);
            startTimer(code);
            return;
        } else if (state.stage === 'FINAL_MATCH') {
            // Stage 3 Expired: Previous team passed automatically
            const winningTeamName = state.currentBid.team;
            const team = room.teams[winningTeamName];
            const amount = state.newAmount || state.currentBid.amount;
            const purchasedPlayer = { ...state.player, soldPrice: amount, winner: winningTeamName };
            team.players.push(purchasedPlayer);
            team.purse -= amount;
            team.totalSpent += amount;
            if (state.player.isOverseas) team.overseasCount += 1;

            room.activity.unshift({ type: 'sold', player: purchasedPlayer, team: winningTeamName, text: `RTM Expired! Sold to ${winningTeamName}.` });
            finishRTM(code);
            saveRooms();
            return;
        }
        delete room.rtmState;
    }

    const player = room.pool[room.currentPlayerIndex];
    if (!player) return;

    // Check for RTM Eligibility
    // 1. Must have a winner (currentBid)
    // 2. Room config must allow RTM or Retention
    // 3. Player must have a previous team that is present in the room
    // 4. That previous team must have RTM cards left
    // 5. The previous team must NOT be the current winner
    const winningTeamName = room.currentBid ? room.currentBid.team : null;
    const prevTeamName = player.previousTeam;
    const prevTeam = (prevTeamName && room.teams[prevTeamName]) ? room.teams[prevTeamName] : null;

    // Check if anyone owns the previous team
    const prevTeamOwner = Object.keys(room.players).find(u => room.players[u].team === prevTeamName);

    if (winningTeamName && prevTeam && prevTeamOwner && prevTeam.rtmCards > 0 && winningTeamName !== prevTeamName) {
        // Start RTM Phase
        room.status = 'RTM_PHASE';
        room.rtmState = {
            previousTeam: prevTeamName,
            owner: prevTeamOwner,
            currentBid: room.currentBid,
            player: player,
            stage: 'INTENT' // Changed from DECISION to INTENT
        };
        room.timer = 15; // 15 seconds for RTM decision
        room.activity.unshift({ type: 'system', text: `RTM CHOICE: ${prevTeamName} can match ${winningTeamName}'s bid for ${player.name}!` });
        broadcastRoomUpdate(code);
        startTimer(code); // Re-use startTimer with RTM logic
        saveRooms();
        return;
    }

    // Normal Sale / Unsold Logic
    if (room.currentBid) {
        const team = room.teams[winningTeamName];

        const purchasedPlayer = { ...player, soldPrice: room.currentBid.amount, winner: winningTeamName };

        team.players.push(purchasedPlayer);
        team.purse -= room.currentBid.amount;
        team.totalSpent += room.currentBid.amount;
        if (player.isOverseas) team.overseasCount += 1;

        room.activity.unshift({ type: 'sold', player: purchasedPlayer, team: winningTeamName });
    } else {
        // Track Unsold
        if (!room.unsold) room.unsold = [];
        room.unsold.push(player);
        room.activity.unshift({ type: 'system', text: `${player.name} is UNSOLD!` });
    }

    room.currentBid = null;
    room.currentPlayerIndex += 1;
    room.timer = room.timerDuration;

    // Check if next player exists
    if (room.currentPlayerIndex < room.pool.length) {
        broadcastRoomUpdate(code);
        startTimer(code); // AUTO-START NEXT PLAYER
    } else {
        room.activity.unshift({ type: 'system', text: 'ALL PLAYERS SOLD! GAME OVER.' });
        broadcastRoomUpdate(code);
        // Do not restart timer, game is done.
    }

    saveRooms();
}

// Helper function to create a safe, serializable version of the room object
function getSafeRoom(room) {
    if (!room) return null;
    
    // Create a deep copy without circular references and non-serializable objects
    const safeRoom = {
        code: room.code,
        creator: room.creator,
        status: room.status,
        isPaused: room.isPaused || false,
        config: room.config || {},
        teams: room.teams || {},
        pool: room.pool || [],
        currentPlayerIndex: room.currentPlayerIndex || 0,
        currentBid: room.currentBid || null,
        timer: room.timer || 15,
        timerDuration: room.timerDuration || 15,
        activity: room.activity || [],
        unsold: room.unsold || [],
        rtmState: room.rtmState || null
        // Exclude: timerInterval (Timeout object with circular refs)
        // Exclude: players (contains WebSocket objects)
    };
    
    return safeRoom;
}

function broadcastRoomUpdate(code) {
    const room = rooms[code];
    if (!room) return;
    
    const safeRoom = getSafeRoom(room);
    const playersList = Object.entries(room.players || {}).map(([name, data]) => ({ 
        name, 
        team: data.team || null, 
        isOnline: data.isOnline || false,
        // Exclude: ws (WebSocket object)
    }));
    
    broadcastToRoom(code, {
        type: 'STATE_UPDATE',
        room: safeRoom,
        playersList
    });
}

function broadcastToRoom(code, msg) {
    try {
        const room = rooms[code];
        if (!room || !room.players) return;
        
        // Broadcast to all online players
        // Timer continues even if no players are connected
        Object.values(room.players).forEach(p => {
            // Safety check: ensure WebSocket exists and is open
            if (p && p.ws && p.isOnline && p.ws.readyState === 1) {
                try {
                    p.ws.send(JSON.stringify(msg));
                } catch (error) {
                    // If send fails, mark player as offline
                    console.log(`Failed to send to player: ${error.message}`);
                    if (p) p.isOnline = false;
                }
            }
        });
    } catch (error) {
        console.error('Error in broadcastToRoom:', error.message);
        // Don't crash - just log the error
    }
}

function finishRTM(code) {
    const room = rooms[code];
    room.status = 'LIVE';
    room.currentBid = null;
    room.currentPlayerIndex += 1;
    room.timer = room.timerDuration;
    delete room.rtmState;

    if (room.currentPlayerIndex < room.pool.length) {
        broadcastRoomUpdate(code);
        startTimer(code);
    } else {
        room.activity.unshift({ type: 'system', text: 'ALL PLAYERS SOLD! GAME OVER.' });
        broadcastRoomUpdate(code);
    }
}

function formatPrice(p) {
    if (p >= 10000000) return (p / 10000000).toFixed(2) + ' Cr';
    return (p / 100000).toFixed(0) + ' L';
}
