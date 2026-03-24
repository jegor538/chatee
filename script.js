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
            <div style="background: #2d2d2d; padding: 30px;">
                <h1>CHATEE</h1>
                <div style="margin-bottom: 40px;">
                    <h2>CREATE</h2>
                    <input type="text" id="username" placeholder="your name" autocomplete="off">
                    <button id="createBtn">create room</button>
                </div>
                
                <div style="margin-top: 40px;">
                    <h2>JOIN</h2>
                    <input type="text" id="joinCode" placeholder="room code" autocomplete="off" style="text-transform: uppercase;">
                    <input type="text" id="joinUsername" placeholder="your name" autocomplete="off">
                    <button id="joinBtn">join room</button>
                </div>
            </div>
        </div>
    `;
    
    // Create room handler
    document.getElementById('createBtn').onclick = async () => {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            alert('enter your name');
            return;
        }
        
        const roomCode = generateRoomCode();
        
        console.log('Creating room:', roomCode, username);
        
        const { data, error } = await supabase
            .from('rooms')
            .insert([{ room_code: roomCode, created_by: username }])
            .select();
        
        if (error) {
            console.error('Error creating room:', error);
            alert('failed to create room: ' + error.message);
        } else {
            console.log('Room created:', data);
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
            alert('enter room code and your name');
            return;
        }
        
        console.log('Joining room:', roomCode);
        
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('room_code', roomCode);
        
        console.log('Room search result:', data, error);
        
        if (error) {
            alert('error checking room: ' + error.message);
        } else if (!data || data.length === 0) {
            alert('room not found');
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
            <div class="container" style="height: 100vh; display: flex; flex-direction: column; padding: 0;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <div class="chat-header">
                        <div class="room-code">${currentRoom}</div>
                        <button class="leave-btn" id="leaveBtn">leave</button>
                    </div>
                    
                    <div class="messages-container" id="messages">
                        <div class="message">
                            <small>${formatTime()}</small><br>
                            <strong>system</strong><br>
                            joined room ${currentRoom}
                        </div>
                    </div>
                    
                    <div class="chat-input">
                        <input type="text" id="messageInput" placeholder="type message" autocomplete="off">
                        <button id="sendBtn">send</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Load existing messages
    await loadMessages();
    
    // Subscribe to new messages
    const subscription = supabase
        .channel(`room-${currentRoom}`)
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_code=eq.${currentRoom}` },
            (payload) => {
                console.log('New message:', payload);
                addMessageToUI(payload.new.username, payload.new.message, payload.new.created_at);
            }
        )
        .subscribe();
    
    // Send message
    document.getElementById('sendBtn').onclick = async () => {
        const message = document.getElementById('messageInput').value.trim();
        if (!message) return;
        
        console.log('Sending message:', message);
        
        const { error } = await supabase
            .from('messages')
            .insert([{
                room_code: currentRoom,
                username: currentUser,
                message: message
            }]);
        
        if (error) {
            console.error('Error sending message:', error);
            alert('failed to send message');
        } else {
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
    
    console.log('Loading messages:', data);
    
    if (data && !error) {
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            
            data.forEach(msg => {
                addMessageToUI(msg.username, msg.message, msg.created_at);
            });
        }
    }
}

// Add message to UI
function addMessageToUI(username, message, timestamp) {
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;
    
    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : formatTime();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
        <small>${time}</small><br>
        <strong>${username.toLowerCase()}</strong><br>
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
