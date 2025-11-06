document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('auth-modal');
    const form = document.getElementById('auth-form');
    const title = document.getElementById('auth-title');
    const toggle = document.getElementById('toggle-auth');
    const chatForm = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-container');
    const status = document.getElementById('user-status');
    const chatList = document.getElementById('chat-list');
    const newChatBtn = document.getElementById('new-chat');
    const upgrade = document.getElementById('upgrade');
    const logout = document.getElementById('logout');
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const closeSidebar = document.getElementById('close-sidebar');
    const overlay = document.getElementById('overlay');

    let isLogin = false;
    let premium = false;
    let count = 0;
    let currentChatId = null;
    let chats = [];

    const showModal = () => modal.classList.remove('hidden');
    const hideModal = () => modal.classList.add('hidden');
    const updateStatus = () => {
        const left = 10 - count;
        status.textContent = `${premium ? 'Premium' : 'Free'} | ${left} Alpha tersisa`;
    };

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) return showModal();
        try {
            const r = await axios.get('/api/user/me', { headers: { Authorization: `Bearer ${token}` } });
            premium = r.data.isPremium;
            count = r.data.chatCount;
            chats = r.data.chats;
            updateStatus();
            hideModal();
            renderChatList();
            if (chats.length === 0) createNewChat();
            else loadChat(chats[0].id);
        } catch {
            localStorage.removeItem('token');
            showModal();
        }
    };

    const renderChatList = () => {
        chatList.innerHTML = '';
        chats.forEach(c => {
            const div = document.createElement('div');
            div.className = `p-2 rounded cursor-pointer hover:bg-gray-700 ${c.id === currentChatId ? 'bg-gray-700' : ''}`;
            div.textContent = c.title;
            div.onclick = () => loadChat(c.id);
            const del = document.createElement('button');
            del.innerHTML = '×';
            del.className = 'float-right text-red-400';
            del.onclick = (e) => { e.stopPropagation(); deleteChat(c.id); };
            div.appendChild(del);
            chatList.appendChild(div);
        });
    };

    const createNewChat = async () => {
        const r = await axios.post('/api/chat/new', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        const newChat = { id: r.data.id, title: 'New Chat' };
        chats.unshift(newChat);
        renderChatList();
        loadChat(newChat.id);
    };

    const loadChat = async (id) => {
        currentChatId = id;
        const r = await axios.get(`/api/chat/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        container.innerHTML = '';
        r.data.messages.forEach(m => addMessage(m.role, m.content));
        renderChatList();
    };

    const deleteChat = async (id) => {
        if (!confirm('Hapus chat ini?')) return;
        await axios.delete(`/api/chat/${id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        chats = chats.filter(c => c.id !== id);
        renderChatList();
        if (currentChatId === id) createNewChat();
    };

    const addMessage = (role, content) => {
        const div = document.createElement('div');
        div.className = 'mb-4 p-3 bg-white rounded shadow';
        div.innerHTML = `<strong class="${role === 'user' ? 'text-blue-600' : 'text-green-600'}">${role === 'user' ? 'Kamu' : 'Alpha AI'}:</strong> <div class="mt-1">${marked.parse(content)}</div>`;
        copyBtn(div);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    };

    const copyBtn = (el) => {
        el.querySelectorAll('pre code').forEach(code => {
            if (code.parentElement.querySelector('.copy-btn')) return;
            const btn = document.createElement('button');
            btn.textContent = 'Copy';
            btn.className = 'copy-btn float-right text-xs bg-gray-200 px-2 py-1 rounded mt-1';
            btn.onclick = () => {
                navigator.clipboard.writeText(code.textContent);
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = 'Copy', 2000);
            };
            code.parentElement.style.position = 'relative';
            code.parentElement.appendChild(btn);
        });
    };

    chatForm.onsubmit = async (e) => {
        e.preventDefault();
        const msg = input.value.trim();
        if (!msg) return;
        addMessage('user', msg);
        input.value = '';

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ message: msg, mode: premium || count < 10 ? 'alpha' : 'strict', chatId: currentChatId })
        });

        const reader = res.body.getReader();
        let aiText = '';
        const aiDiv = document.createElement('div');
        aiDiv.className = 'mb-4 p-3 bg-white rounded shadow';
        aiDiv.innerHTML = '<strong class="text-green-600">Alpha AI:</strong> <span></span>';
        container.appendChild(aiDiv);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            aiText += new TextDecoder().decode(value);
            aiDiv.querySelector('span').innerHTML = marked.parse(aiText);
            copyBtn(aiDiv);
        }
        if (!premium && count < 10) { count++; updateStatus(); }
    };

    newChatBtn.onclick = createNewChat;
    upgrade.onclick = () => axios.post('/api/midtrans/token', {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => snap.pay(r.data.token));
    logout.onclick = () => { if (confirm('Yakin logout?')) { localStorage.removeItem('token'); location.reload(); } };

    // Mobile
    hamburger.onclick = () => { sidebar.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); };
    closeSidebar.onclick = overlay.onclick = () => { sidebar.classList.add('-translate-x-full'); overlay.classList.add('hidden'); };

    // Auth
    toggle.onclick = () => {
        isLogin = !isLogin;
        title.textContent = isLogin ? 'Login' : 'Daftar';
        toggle.textContent = isLogin ? 'Ke Daftar' : 'Ke Login';
    };
    form.onsubmit = async (e) => {
        e.preventDefault();
        const url = isLogin ? '/api/login' : '/api/register';
        const r = await axios.post(url, { email: document.getElementById('email').value, password: document.getElementById('password').value });
        localStorage.setItem('token', r.data.token);
        checkAuth();
    };

    checkAuth();
});