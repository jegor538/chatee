// State
let currentRoom = null;
let currentUser = null;

// Generate room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Format time
function formatTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Create room view
function showCreateRoom() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="container">
            <div class="brutal-box">
                <h1>💀 BRUTAL CHAT</h1>
                <div style="margin-bottom: 30px;">
                    <h2>⚡ CREATE ROOM</h2>
                    <input type="text" id="username" placeholder="YOUR NAME" autocomplete="off">
                    <button id="createBtn">» CREATE «</button>
                </div>
                
                <div style="border-top: 2px solid #00ff00; padding-top: 30px;">
                    <h2>🔗 JOIN ROOM</h2>
                    <input type="text" id="joinCode" placeholder="ROOM CODE" autocomplete="off">
                    <input type="text" id="joinUsername" placeholder="YOUR NAME" autocomplete="off">
                    <button id="joinBtn">» JOIN «</button>
                </div>
            </div>
        </div>
    `;
    
    // Create room handler
    document.getElementById('createBtn').onclick = async () => {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            alert('ENTER YOUR NAME');
            return;
        }
        
        const roomCode = generateRoomCode();
        
        const { error } = await supabase
            .from('rooms')
            .insert([{ room_code: roomCode, created_by: username }]);
        
        if (error) {
            alert('FAILED TO CREATE ROOM');
        } else {
            currentRoom = roomCode;
            currentUser = username;
            showChatRoom();
        }
    };
    
    // Join room handler
    document.getElementById('joinBtn').onclick = async () => {
        const roomCode = document.getElementById('joinCode').value.trim().toUpperCase();
        const username = document.getElementById('joinUsername').value.trim();
        
        if (!roomCode || !username) {
            alert('ENTER ROOM CODE AND YOUR NAME');
            return;
        }
        
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('room_code', roomCode)
            .single();
        
        if (error || !data) {
            alert('ROOM NOT FOUND');
        } else {
            currentRoom = roomCode;
            currentUser = username;
            showChatRoom();
        }
    };
}

// Show chat room
async function showChatRoom() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="room-container">
            <div class="container" style="height: 100vh; display: flex; flex-direction: column;">
                <div class="brutal-box" style="flex: 1; display: flex; flex-direction: column;">
                    <div class="chat-header">
                        <div class="room-code">📡 ROOM: ${currentRoom}</div>
                        <button class="leave-btn" id="leaveBtn">» LEAVE «</button>
                    </div>
                    
                    <div class="messages-container" id="messages">
                        <div class="message">
                            <small>${formatTime()}</small><br>
                            <strong>> SYSTEM</strong><br>
                            JOINED ROOM ${currentRoom}
                        </div>
                    </div>
                    
                    <div class="chat-input">
                        <input type="text" id="messageInput" placeholder="TYPE YOUR MESSAGE" autocomplete="off">
                        <button id="sendBtn">» SEND «</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load existing messages
    loadMessages();
    
    // Subscribe to new messages
    const subscription = supabase
        .channel('messages')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_code=eq.${currentRoom}` },
            (payload) => {
                addMessageToUI(payload.new.username, payload.new.message, payload.new.created_at);
            }
        )
        .subscribe();
    
    // Send message
    document.getElementById('sendBtn').onclick = async () => {
        const message = document.getElementById('messageInput').value.trim();
        if (!message) return;
        
        const { error } = await supabase
            .from('messages')
            .insert([{
                room_code: currentRoom,
                username: currentUser,
                message: message
            }]);
        
        if (!error) {
            document.getElementById('messageInput').value = '';
        }
    };
    
    // Enter key to send
    document.getElementById('messageInput').onkeypress = (e) => {
        if (e.key === 'Enter') {
            document.getElementById('sendBtn').click();
        }
    };
    
    // Leave room
    document.getElementById('leaveBtn').onclick = () => {
        subscription.unsubscribe();
        currentRoom = null;
        currentUser = null;
        showCreateRoom();
    };
}

// Load existing messages
async function loadMessages() {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_code', currentRoom)
        .order('created_at', { ascending: true });
    
    if (data && !error) {
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = '';
        
        data.forEach(msg => {
            addMessageToUI(msg.username, msg.message, msg.created_at);
        });
    }
}

// Add message to UI
function addMessageToUI(username, message, timestamp) {
    const messagesDiv = document.getElementById('messages');
    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : formatTime();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
        <small>${time}</small><br>
        <strong>> ${username.toUpperCase()}</strong><br>
        ${escapeHtml(message)}
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Security: escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start app
showCreateRoom();
