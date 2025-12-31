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
let rooms = {};
if (fs.existsSync(DATA_FILE)) {
    try {
        rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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
    const dataToSave = {};
    Object.entries(rooms).forEach(([code, room]) => {
        // Serialize players: keep data, remove socket
        const serializedPlayers = {};
        Object.entries(room.players).forEach(([name, p]) => {
            serializedPlayers[name] = {
                name: p.name,
                team: p.team,
                isOnline: false // Always save as offline, they reconnect to become online
            };
        });

        dataToSave[code] = {
            ...room,
            players: serializedPlayers,
            timerInterval: null
        };
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
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

    ws.on('message', (message) => {
        const data = JSON.parse(message);

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

            ws.send(JSON.stringify({ type: 'ROOM_CREATED', code, room: rooms[code] }));
            broadcastRoomUpdate(code);
            saveRooms();
        }

        // JOIN_ROOM
        if (data.type === 'JOIN_ROOM') {
            const { code, userName } = data;
            if (rooms[code]) {
                currentRoom = code;
                currentUser = userName;

                const existing = rooms[code].players[currentUser];
                rooms[code].players[currentUser] = { ws, team: existing?.team || null, isOnline: true };

                ws.send(JSON.stringify({ type: 'JOIN_SUCCESS', room: rooms[code] }));
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
                if (rooms[currentRoom].timerInterval) clearInterval(rooms[currentRoom].timerInterval);
                rooms[currentRoom].activity.unshift({ type: 'system', text: 'AUCTION PAUSED' });
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
                if (rooms[currentRoom].timerInterval) clearInterval(rooms[currentRoom].timerInterval);
                rooms[currentRoom].status = 'FINISHED';
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
                    // Avoid double processing if multiple users somehow select same team (though UI blocks it)
                    // Better: Reset team state first if needed, but for now we append.

                    data.retentions.forEach(p => {
                        // Add to team players if not already there
                        if (!team.players.some(tp => tp.id === p.id)) {
                            // Mark as Sold/Retained
                            const retainedPlayer = {
                                ...p,
                                soldPrice: 0, // Cost is aggregate, individual price tricky in this model, set 0 or avg? 
                                // Actually user gave slab prices. Ideally we assign specific prices.
                                // But since we got a lump sum cost, let's just push them.
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
        if (rooms[currentRoom] && rooms[currentRoom].players[currentUser]) {
            rooms[currentRoom].players[currentUser].isOnline = false;
            broadcastRoomUpdate(currentRoom);
        }
    });
});

function startTimer(code) {
    const room = rooms[code];
    if (!room) return;

    if (room.timerInterval) clearInterval(room.timerInterval);

    room.timerInterval = setInterval(() => {
        room.timer -= 1;
        broadcastToRoom(code, { type: 'TIMER_UPDATE', timer: room.timer });

        if (room.timer <= 0) {
            clearInterval(room.timerInterval);
            handleHammer(code);
        }
    }, 1000);
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

function broadcastRoomUpdate(code) {
    const room = rooms[code];
    const safeRoom = {
        ...room,
        timerInterval: null,
        players: undefined
    };
    const playersList = Object.entries(room.players).map(([name, data]) => ({ name, ...data, ws: undefined }));

    broadcastToRoom(code, {
        type: 'STATE_UPDATE',
        room: safeRoom,
        playersList
    });
}

function broadcastToRoom(code, msg) {
    const room = rooms[code];
    if (!room) return;
    Object.values(room.players).forEach(p => {
        if (p.isOnline && p.ws.readyState === 1) {
            p.ws.send(JSON.stringify(msg));
        }
    });
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
