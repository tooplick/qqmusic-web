/**
 * QQ Music Web - Single-Page Player
 */

// --- 工具函数 ---
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

class DOM {
    static get(id) { return document.getElementById(id); }
    static create(tag, className, html) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (html) el.innerHTML = html;
        return el;
    }
}

// --- 核心类 ---

class UI {
    constructor() {
        this.els = {
            bgLayer1: DOM.get('bg-layer-1'),
            bgLayer2: DOM.get('bg-layer-2'),
            albumCover: DOM.get('current-cover'),
            title: DOM.get('current-title'),
            artist: DOM.get('current-artist'),
            titleMini: DOM.get('title-mini'),
            artistMini: DOM.get('artist-mini'),
            playBtn: DOM.get('play-btn'),
            playerView: document.querySelector('.player-view'),
            currentTime: DOM.get('current-time'),
            totalTime: DOM.get('total-time'),
            progressFill: DOM.get('progress-fill'),

            // Cover/Lyrics Toggle
            coverView: DOM.get('cover-view'),
            lyricsView: DOM.get('lyrics-view'),
            lyricsScroll: DOM.get('lyrics-scroll'),

            // Search Drawer
            searchDrawer: DOM.get('search-drawer'),
            drawerOverlay: DOM.get('drawer-overlay'),
            resultsList: DOM.get('results-list'),
            loadingSpinner: DOM.get('loading-spinner'),

            notificationContainer: DOM.get('notification-container'),

            pagination: DOM.get('pagination'),
            pageInfo: DOM.get('page-info'),
            prevPage: DOM.get('prev-page'),
            nextPage: DOM.get('next-page'),

            // Playlist Drawer
            playlistDrawer: DOM.get('playlist-drawer'),
            playlistList: DOM.get('playlist-list')
        };
        this.currentLyrics = [];
        this.userScrolling = false;
        this.lastHighlightIdx = -1;
        this.scrollTimeout = null;
        this.coverCache = new Map(); // 封面缓存
        this.activeBgLayer = 1; // 当前活跃的背景层 (1 或 2)

        // 监听用户手动滚动歌词
        // 监听用户手动滚动歌词 (Touch & Wheel)
        const resetScrolling = debounce(() => {
            this.userScrolling = false;
        }, 3000);

        const onUserInteract = () => {
            this.userScrolling = true;
            resetScrolling();
        };

        this.els.lyricsScroll.addEventListener('touchstart', onUserInteract, { passive: true });
        this.els.lyricsScroll.addEventListener('touchmove', onUserInteract, { passive: true });
        this.els.lyricsScroll.addEventListener('wheel', onUserInteract, { passive: true });

        // History API 监听：响应系统返回手势
        window.addEventListener('popstate', (e) => this._updateDrawersFromState(e.state));
    }

    // 根据 history state 更新抽屉状态（由 popstate 触发）
    _updateDrawersFromState(state) {
        const overlay = state?.overlay;
        if (overlay === 'search') {
            this._showSearchDrawer();
            this._hidePlaylistDrawer();
        } else if (overlay === 'playlist') {
            this._hideSearchDrawer();
            this._showPlaylistDrawer();
        } else {
            this._hideSearchDrawer();
            this._hidePlaylistDrawer();
        }
    }

    // --- 私有 DOM 操作方法 ---
    _showSearchDrawer() {
        this.els.searchDrawer.classList.add('open');
        this.els.drawerOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    _hideSearchDrawer() {
        this.els.searchDrawer.classList.remove('open');
        this.els.drawerOverlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    _showPlaylistDrawer() {
        this.els.playlistDrawer.classList.add('open');
        this.els.drawerOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    _hidePlaylistDrawer() {
        this.els.playlistDrawer.classList.remove('open');
        this.els.drawerOverlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    // 淡入淡出切换背景
    setBackground(url) {
        // 先预加载图片，完成后再切换
        const img = new Image();
        img.onload = () => {
            // 获取当前和下一层
            const currentEl = this.activeBgLayer === 1 ? this.els.bgLayer1 : this.els.bgLayer2;
            const nextEl = this.activeBgLayer === 1 ? this.els.bgLayer2 : this.els.bgLayer1;

            // 设置新背景到下一层
            nextEl.style.backgroundImage = `url('${url}')`;

            // 切换显示
            currentEl.classList.add('fade-out');
            nextEl.classList.remove('fade-out');

            // 更新活跃层
            this.activeBgLayer = this.activeBgLayer === 1 ? 2 : 1;
        };
        img.src = url;
    }

    // 预加载封面到缓存
    preloadCover(song) {
        const key = song.mid;
        if (this.coverCache.has(key)) return;

        const defaultCover = 'https://y.gtimg.cn/music/photo_new/T002R800x800M000003y8dsH2wBHlo_1.jpg';

        if (song.album_mid) {
            const url = `https://y.gtimg.cn/music/photo_new/T002R800x800M000${song.album_mid}.jpg`;
            const img = new Image();
            img.onload = () => this.coverCache.set(key, url);
            img.src = url;
        } else {
            // 没有 album_mid，调用 API 获取
            fetch('/api/cover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_data: song, size: 800 })
            })
                .then(r => r.json())
                .then(data => {
                    const url = (data.cover_url && data.source !== 'default') ? data.cover_url : defaultCover;
                    const img = new Image();
                    img.onload = () => this.coverCache.set(key, url);
                    img.src = url;
                })
                .catch(() => { });
        }
    }

    notify(msg, type = 'success') {
        // 只显示一个通知
        this.els.notificationContainer.innerHTML = '';

        const toast = DOM.create('div', `toast ${type}`, `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${msg}</span>
        `);
        this.els.notificationContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    setPlaying(isPlaying) {
        this.els.playBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
        if (isPlaying) {
            this.els.playerView.classList.add('playing');
            document.body.classList.add('playing');
        } else {
            this.els.playerView.classList.remove('playing');
            document.body.classList.remove('playing');
        }
    }

    // Drawer Control (集成 History API)
    openDrawer() {
        // 避免重复 push
        if (history.state?.overlay !== 'search') {
            history.pushState({ overlay: 'search' }, '', '');
        }
        this._showSearchDrawer();
    }

    closeDrawer() {
        // 如果当前 state 是 search，通过 history.back() 关闭（触发 popstate）
        if (history.state?.overlay === 'search') {
            history.back();
        } else {
            // 直接关闭 DOM（防错处理）
            this._hideSearchDrawer();
        }
    }

    // Toggle Cover/Lyrics
    toggleView() {
        this.els.coverView.classList.toggle('active');
        this.els.lyricsView.classList.toggle('active');
    }

    // Playlist Drawer Control (集成 History API)
    openPlaylistDrawer() {
        // 避免重复 push
        if (history.state?.overlay !== 'playlist') {
            history.pushState({ overlay: 'playlist' }, '', '');
        }
        this._showPlaylistDrawer();
    }

    closePlaylistDrawer() {
        // 如果当前 state 是 playlist，通过 history.back() 关闭（触发 popstate）
        if (history.state?.overlay === 'playlist') {
            history.back();
        } else {
            // 直接关闭 DOM（防错处理）
            this._hidePlaylistDrawer();
        }
    }

    // 渲染播放列表
    renderPlaylist(queue, currentIndex) {
        if (!this.els.playlistList) return;

        if (queue.length === 0) {
            this.els.playlistList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-music"></i>
                    <p>播放列表为空</p>
                    <p style="font-size: 12px; opacity: 0.6;">搜索歌曲并点击"+"添加</p>
                </div>
            `;
            return;
        }

        const defaultCover = 'https://y.gtimg.cn/music/photo_new/T002R300x300M000003y8dsH2wBHlo_1.jpg';
        this.els.playlistList.innerHTML = '';

        queue.forEach((song, i) => {
            let cover = defaultCover;
            if (song.album_mid) {
                cover = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.album_mid}.jpg`;
            }

            const div = DOM.create('div', `playlist-item ${i === currentIndex ? 'playing' : ''}`);
            div.innerHTML = `
                <img src="${cover}" class="item-cover" loading="lazy" data-song-idx="${i}">
                <div class="item-info">
                    <div class="item-title">${song.name}</div>
                    <div class="item-artist">${song.singers}</div>
                </div>
                <button class="remove-btn" data-idx="${i}"><i class="fas fa-times"></i></button>
            `;

            // 如果没有 album_mid，异步加载封面
            if (!song.album_mid) {
                fetch('/api/cover', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ song_data: song, size: 300 })
                })
                    .then(r => r.json())
                    .then(data => {
                        if (data.cover_url && data.source !== 'default') {
                            const img = div.querySelector('.item-cover');
                            if (img) img.src = data.cover_url;
                        }
                    })
                    .catch(() => { });
            }

            // 点击播放
            div.addEventListener('click', (e) => {
                if (!e.target.closest('.remove-btn')) {
                    window.player.playFromQueue(i);
                }
            });

            this.els.playlistList.appendChild(div);
        });

        // 绑定移除按钮
        this.els.playlistList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.idx);
                window.player.removeFromQueue(idx);
            };
        });
    }

    updateSongInfo(song) {
        this.els.title.textContent = song.name;
        this.els.artist.textContent = song.singers;
        if (this.els.titleMini) this.els.titleMini.textContent = song.name;
        if (this.els.artistMini) this.els.artistMini.textContent = song.singers;

        const defaultCover = 'https://y.gtimg.cn/music/photo_new/T002R800x800M000003y8dsH2wBHlo_1.jpg';

        // 设置封面的辅助函数
        const setCover = (url) => {
            this.els.albumCover.src = url;
            this.setBackground(url); // 使用淡入淡出切换背景
            this._extractCoverColor(url);
            // 同时更新缓存
            this.coverCache.set(song.mid, url);

            // 更新 Media Session 元数据（浏览器/系统级显示）
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name,
                    artist: song.singers,
                    album: song.album || '',
                    artwork: [
                        { src: url.replace('R800x800', 'R300x300'), sizes: '300x300', type: 'image/jpeg' },
                        { src: url, sizes: '800x800', type: 'image/jpeg' }
                    ]
                });
            }
        };

        // 优先使用缓存的封面（避免闪烁）
        if (this.coverCache.has(song.mid)) {
            setCover(this.coverCache.get(song.mid));
            return;
        }

        // 如果有 album_mid，先尝试直接使用
        if (song.album_mid) {
            const albumCover = `https://y.gtimg.cn/music/photo_new/T002R800x800M000${song.album_mid}.jpg`;
            setCover(albumCover);
        } else {
            // 没有 album_mid，调用智能封面 API
            setCover(defaultCover); // 先显示默认封面

            fetch('/api/cover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_data: song, size: 800 })
            })
                .then(r => r.json())
                .then(data => {
                    if (data.cover_url && data.source !== 'default') {
                        setCover(data.cover_url);
                    }
                })
                .catch(() => { /* 使用默认封面 */ });
        }
    }

    _extractCoverColor(coverUrl) {
        // 使用代理接口解决CORS限制，允许Canvas读取像素数据
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onerror = () => {
            // CORS 失败时静默忽略，使用默认控制栏颜色
        };
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 100;
                canvas.height = 100;
                ctx.drawImage(img, 0, 0, 100, 100);

                // 从中心区域采样，获取更具代表性的颜色
                const centerData = ctx.getImageData(25, 25, 50, 50).data;

                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < centerData.length; i += 4) {
                    r += centerData[i];
                    g += centerData[i + 1];
                    b += centerData[i + 2];
                    count++;
                }
                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                // 增强饱和度使颜色更鲜明
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const delta = max - min;
                if (delta > 20) { // 有一定饱和度时才增强
                    const factor = 1.3;
                    r = Math.min(255, Math.round(128 + (r - 128) * factor));
                    g = Math.min(255, Math.round(128 + (g - 128) * factor));
                    b = Math.min(255, Math.round(128 + (b - 128) * factor));
                }

                // 设置控制栏背景色（增加透明度使颜色更柔和）
                document.documentElement.style.setProperty(
                    '--controls-bg',
                    `rgba(${r}, ${g}, ${b}, 0.25)`
                );
            } catch (e) {
                console.log('Color extraction failed:', e);
            }
        };
        // 通过代理接口获取图片，绕过CORS限制
        if (coverUrl.startsWith('https://y.gtimg.cn/')) {
            img.src = `/api/image_proxy?url=${encodeURIComponent(coverUrl)}`;
        } else {
            img.src = coverUrl;
        }
    }

    updateProgress(curr, total) {
        if (!total) return;
        this.els.currentTime.textContent = formatTime(curr);
        this.els.totalTime.textContent = formatTime(total);
        this.els.progressFill.style.width = `${(curr / total) * 100}%`;
    }

    renderLyrics(lyricsData) {
        this.currentLyrics = [];
        this.els.lyricsScroll.innerHTML = '';

        const parse = (text) => {
            if (!text) return [];
            const lines = text.split('\n');
            const res = [];

            // 1. 查找全局 offset (格式 [offset:1000] 单位毫秒)
            let globalOffset = 0;
            const offsetMatch = text.match(/\[offset:\s*(-?\d+)\]/);
            if (offsetMatch) {
                globalOffset = parseInt(offsetMatch[1]) / 1000; // 转换为秒
            }

            const re = /\[(\d+):(\d+)\.(\d+)\]/;
            lines.forEach(l => {
                const m = l.match(re);
                if (m) {
                    // 兼容2位(.xx)和3位(.xxx)毫秒
                    // m[1]: 分, m[2]: 秒, m[3]: 毫秒部分
                    const min = parseInt(m[1]);
                    const sec = parseInt(m[2]);
                    const msStr = m[3];
                    // 如果毫秒部分是2位，除以100；如果是3位，除以1000
                    const ms = parseInt(msStr) / Math.pow(10, msStr.length);

                    // 应用 offset (注意：LRC offset 正值通常表示歌词提前，负值延迟，但不同播放器定义可能不同
                    // 这里采用标准定义：Time = TagTime + Offset? 实际上通常是 TagTime - Offset
                    // 暂且认为 offset 是修正值，直接加在时间戳上
                    // 大多数播放器逻辑：timestamp = parseTime + offset / 1000
                    let t = min * 60 + sec + ms + globalOffset;
                    if (t < 0) t = 0;

                    const txt = l.replace(re, '').trim();
                    if (txt) res.push({ t, txt });
                }
            });
            return res;
        };

        if (lyricsData && lyricsData.lyric) {
            this.currentLyrics = parse(lyricsData.lyric);
        }

        if (this.currentLyrics.length === 0) {
            this.els.lyricsScroll.innerHTML = `<div class="empty-state"><i class="fas fa-music"></i><p>暂无歌词</p></div>`;
            return;
        }

        this.currentLyrics.forEach((l, i) => {
            const row = DOM.create('div', 'lrc-line', l.txt);
            row.onclick = (e) => {
                e.stopPropagation(); // 阻止冒泡，避免触发视图切换
                window.player.seek(l.t);
            };
            this.els.lyricsScroll.appendChild(row);
        });
    }

    highlightLyric(time) {
        if (!this.currentLyrics.length) return;

        // 移除 userScrolling 检查，因为 scrollTo 会触发 scroll 事件，导致自我阻塞
        // UPDATE: 现在我们通过具体的交互事件(touch/wheel)来判断 userScrolling，所以可以安全地恢复检查了
        // 如果用户正在滚动，只更新高亮样式，不进行自动滚动


        let idx = -1;
        // 找到最后一句 <= time 的歌词
        for (let i = 0; i < this.currentLyrics.length; i++) {
            if (time >= this.currentLyrics[i].t) idx = i;
            else break;
        }

        // 保持 idx 有效
        if (idx !== -1 && idx !== this.lastHighlightIdx) {
            this.lastHighlightIdx = idx;

            // 切换 active 类
            const rows = this.els.lyricsScroll.children;
            const active = this.els.lyricsScroll.querySelector('.active');
            if (active) active.classList.remove('active');

            const curr = rows[idx];
            if (curr && !curr.classList.contains('empty-state')) {
                curr.classList.add('active');

                // --- 优化滚动逻辑 ---
                // --- 优化滚动逻辑 ---
                // 参考用户代码，使用 scrollTo + smooth behavior
                if (this.els.lyricsScroll && !this.userScrolling) {
                    const containerHeight = this.els.lyricsScroll.clientHeight;
                    // const rowTop = curr.offsetTop; // offsetTop 是相对于 offsetParent 的
                    // 最好结合 scrollTop 计算相对位置，或者确保 offsetParent 正确
                    // 简单起见，计算 targetScroll

                    const lineHeight = curr.offsetHeight;
                    const targetScroll = curr.offsetTop - containerHeight / 2 + lineHeight / 2;

                    this.els.lyricsScroll.scrollTo({
                        top: targetScroll,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }
}

class Player {
    // 播放模式常量
    static MODES = {
        SEQUENCE: 'sequence',   // 顺序播放
        REPEAT_ONE: 'repeat_one', // 单曲循环
        SHUFFLE: 'shuffle'      // 随机播放
    };

    // 存储键
    static STORAGE_KEYS = {
        QUEUE: 'qqmusic_queue',
        MODE: 'qqmusic_playmode'
    };

    constructor(ui) {
        this.ui = ui;
        this.audio = new Audio();
        this.playlist = [];  // 搜索结果（临时）
        this.queue = [];     // 播放队列（持久）
        this.currentIndex = -1;
        this.playMode = Player.MODES.SEQUENCE;

        // 从存储中加载播放列表和模式
        this._loadFromStorage();
        this._initAudio();
    }

    // 从 localStorage 加载数据
    _loadFromStorage() {
        try {
            // 加载播放队列
            const savedQueue = localStorage.getItem(Player.STORAGE_KEYS.QUEUE);
            if (savedQueue) {
                this.queue = JSON.parse(savedQueue);
                this.ui.renderPlaylist(this.queue, this.currentIndex);
            }

            // 加载播放模式
            const savedMode = localStorage.getItem(Player.STORAGE_KEYS.MODE);
            if (savedMode && Object.values(Player.MODES).includes(savedMode)) {
                this.playMode = savedMode;
                this._updateModeUI();
            }
        } catch (e) {
            console.warn('加载存储数据失败:', e);
        }
    }

    // 保存播放队列到 localStorage
    _saveQueue() {
        try {
            localStorage.setItem(Player.STORAGE_KEYS.QUEUE, JSON.stringify(this.queue));
        } catch (e) {
            console.warn('保存播放列表失败:', e);
        }
    }

    // 保存播放模式到 localStorage
    _saveMode() {
        try {
            localStorage.setItem(Player.STORAGE_KEYS.MODE, this.playMode);
        } catch (e) {
            console.warn('保存播放模式失败:', e);
        }
    }

    // 更新播放模式 UI，不显示通知
    _updateModeUI() {
        const modeBtn = document.getElementById('mode-btn');
        if (!modeBtn) return;

        switch (this.playMode) {
            case Player.MODES.SEQUENCE:
                modeBtn.innerHTML = '<i class="fas fa-repeat"></i>';
                modeBtn.title = '顺序播放';
                modeBtn.classList.remove('active');
                break;
            case Player.MODES.REPEAT_ONE:
                modeBtn.innerHTML = '<i class="fas fa-repeat"></i><span class="mode-badge">1</span>';
                modeBtn.title = '单曲循环';
                modeBtn.classList.add('active');
                break;
            case Player.MODES.SHUFFLE:
                modeBtn.innerHTML = '<i class="fas fa-shuffle"></i>';
                modeBtn.title = '随机播放';
                modeBtn.classList.add('active');
                break;
        }
    }

    _initAudio() {
        this.audio.onended = () => {
            if (this.playMode === Player.MODES.REPEAT_ONE) {
                // 单曲循环：重新播放当前歌曲
                this.audio.currentTime = 0;
                this.audio.play();
            } else {
                this.next();
            }
        };
        this.audio.onplay = () => {
            this.ui.setPlaying(true);
            this._startTimer();
        };
        this.audio.onpause = () => {
            this.ui.setPlaying(false);
            this._stopTimer();
        };
        this.audio.onerror = () => {
            this.ui.notify('音频播放出错', 'error');
            this.ui.setPlaying(false);
            this._stopTimer();
        };

        // 注册 Media Session 动作处理器（浏览器/系统媒体控制）
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => this.toggle());
            navigator.mediaSession.setActionHandler('pause', () => this.toggle());
            navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
            navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        }
    }

    _startTimer() {
        this._stopTimer();
        // 参考用户提供的有效代码，使用 100ms 间隔的 setInterval
        // 这样可以避免 rAF 对 DOM 的过度高频操作，同时保持足够的精度
        this.timerId = setInterval(() => {
            if (this.audio.paused) return;
            this.ui.updateProgress(this.audio.currentTime, this.audio.duration);
            this.ui.highlightLyric(this.audio.currentTime);
        }, 100);
    }

    _stopTimer() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    async play(index) {
        if (index < 0 || index >= this.playlist.length) return;

        // 立即停止当前播放，避免切换延迟
        this.audio.pause();
        this.audio.currentTime = 0;
        this._stopTimer();

        this.currentIndex = index;
        const song = this.playlist[index];
        this.ui.updateSongInfo(song);

        // Close drawer after selection
        this.ui.closeDrawer();

        // 1. 获取歌词
        fetch(`/api/lyric/${song.mid}`)
            .then(r => r.json())
            .then(d => this.ui.renderLyrics(d))
            .catch(() => this.ui.renderLyrics(null));

        // 2. 获取播放链接
        const quality = document.getElementById('quality-value').value;
        const preferFlac = (quality === 'flac');

        try {
            const res = await fetch('/api/play_url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song_data: song, prefer_flac: preferFlac })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.audio.src = data.url;
            await this.audio.play();
            this.ui.notify(`正在播放: ${song.name} (${data.quality})`);

        } catch (e) {
            this.ui.notify(`播放失败: ${e.message}`, 'error');
            if (preferFlac && !e.message.includes('VIP')) {
                this.ui.notify('尝试 MP3...', 'success');
                document.getElementById('q-mp3').checked = true;
                setTimeout(() => this.play(index), 500);
            }
        }
    }

    toggle() {
        if (this.audio.paused && this.audio.src) this.audio.play();
        else if (!this.audio.paused) this.audio.pause();
    }

    prev() {
        if (!this.queue.length) return;
        const idx = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
        this.playFromQueue(idx);
    }

    next() {
        if (!this.queue.length) return;
        const idx = this._getNextIndex();
        if (idx !== -1) this.playFromQueue(idx);
    }

    // 根据播放模式获取下一首索引
    _getNextIndex() {
        if (!this.queue.length) return -1;

        switch (this.playMode) {
            case Player.MODES.SHUFFLE:
                // 随机播放：随机选择一首（避免选中当前歌曲）
                if (this.queue.length === 1) return 0;
                let randomIdx;
                do {
                    randomIdx = Math.floor(Math.random() * this.queue.length);
                } while (randomIdx === this.currentIndex);
                return randomIdx;
            case Player.MODES.SEQUENCE:
            default:
                // 顺序播放：循环到下一首
                return (this.currentIndex + 1) % this.queue.length;
        }
    }

    // 切换播放模式
    toggleMode() {
        const modes = [Player.MODES.SEQUENCE, Player.MODES.REPEAT_ONE, Player.MODES.SHUFFLE];
        const currentIdx = modes.indexOf(this.playMode);
        this.playMode = modes[(currentIdx + 1) % modes.length];

        // 更新 UI
        const modeBtn = document.getElementById('mode-btn');

        switch (this.playMode) {
            case Player.MODES.SEQUENCE:
                modeBtn.innerHTML = '<i class="fas fa-repeat"></i>';
                modeBtn.title = '顺序播放';
                modeBtn.classList.remove('active');
                this.ui.notify('顺序播放');
                break;
            case Player.MODES.REPEAT_ONE:
                modeBtn.innerHTML = '<i class="fas fa-repeat"></i><span class="mode-badge">1</span>';
                modeBtn.title = '单曲循环';
                modeBtn.classList.add('active');
                this.ui.notify('单曲循环');
                break;
            case Player.MODES.SHUFFLE:
                modeBtn.innerHTML = '<i class="fas fa-shuffle"></i>';
                modeBtn.title = '随机播放';
                modeBtn.classList.add('active');
                this.ui.notify('随机播放');
                break;
        }

        // 保存模式到存储
        this._saveMode();
    }

    seek(time) {
        if (this.audio.duration) this.audio.currentTime = time;
    }

    // --- 播放队列管理 ---

    // 添加到队列末尾
    addToQueue(song) {
        this.queue.push(song);
        this._saveQueue();
        this.ui.preloadCover(song); // 预加载封面
        this.ui.renderPlaylist(this.queue, this.currentIndex);
        this.ui.notify(`已添加到队列: ${song.name}`);
    }

    // 添加为下一首播放
    addNext(song) {
        // 插入到当前播放位置的下一个
        const insertPos = this.currentIndex + 1;
        this.queue.splice(insertPos, 0, song);
        this._saveQueue();
        this.ui.preloadCover(song); // 预加载封面
        this.ui.renderPlaylist(this.queue, this.currentIndex);
        this.ui.notify(`下一首播放: ${song.name}`);
    }

    // 从队列移除
    removeFromQueue(index) {
        if (index < 0 || index >= this.queue.length) return;

        // 如果移除的是当前播放的歌曲之前的，需要调整currentIndex
        if (index < this.currentIndex) {
            this.currentIndex--;
        } else if (index === this.currentIndex) {
            // 如果移除当前播放的歌曲，停止播放
            this.audio.pause();
            this.currentIndex = -1;
        }

        this.queue.splice(index, 1);
        this._saveQueue();
        this.ui.renderPlaylist(this.queue, this.currentIndex);
    }

    // 清空队列
    clearQueue() {
        this.queue = [];
        this.currentIndex = -1;
        this.audio.pause();
        this._saveQueue();
        this.ui.renderPlaylist(this.queue, this.currentIndex);
        this.ui.notify('播放列表已清空');
    }

    // 从队列播放指定索引
    playFromQueue(index) {
        if (index < 0 || index >= this.queue.length) return;
        this.currentIndex = index;
        const song = this.queue[index];

        // 立即停止当前播放
        this.audio.pause();
        this.audio.currentTime = 0;
        this._stopTimer();

        this.ui.updateSongInfo(song);
        this.ui.renderPlaylist(this.queue, this.currentIndex);

        // 获取歌词
        fetch(`/api/lyric/${song.mid}`)
            .then(r => r.json())
            .then(d => this.ui.renderLyrics(d))
            .catch(() => this.ui.renderLyrics(null));

        // 获取播放链接
        const quality = document.getElementById('quality-value').value;
        const preferFlac = (quality === 'flac');

        fetch('/api/play_url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_data: song, prefer_flac: preferFlac })
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                this.audio.src = data.url;
                this.audio.play();
                this.ui.notify(`正在播放: ${song.name} (${data.quality})`);
            })
            .catch(e => {
                this.ui.notify(`播放失败: ${e.message}`, 'error');
            });
    }

}

class App {
    constructor() {
        this.ui = new UI();
        this.player = new Player(this.ui);
        this.page = 1;
        this.keyword = '';

        window.player = this.player;

        this._bindEvents();
    }

    _bindEvents() {
        // Controls
        DOM.get('play-btn').onclick = () => this.player.toggle();
        DOM.get('prev-btn').onclick = () => this.player.prev();
        DOM.get('next-btn').onclick = () => this.player.next();

        // Progress
        DOM.get('progress-bar').onclick = (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            if (this.player.audio.duration) {
                this.player.audio.currentTime = this.player.audio.duration * pct;
            }
        };

        // Playback Mode
        DOM.get('mode-btn').onclick = () => this.player.toggleMode();

        // Quality Toggle (使用 addEventListener 确保移动端兼容)
        const qualityToggle = DOM.get('quality-toggle');
        const toggleQuality = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const valueInput = DOM.get('quality-value');
            const label = DOM.get('quality-label');
            if (valueInput.value === 'flac') {
                valueInput.value = 'mp3';
                label.textContent = 'MP3';
            } else {
                valueInput.value = 'flac';
                label.textContent = 'FLAC';
            }
        };
        qualityToggle.addEventListener('click', toggleQuality);

        // Cover/Lyrics Toggle
        this.ui.els.coverView.onclick = () => this.ui.toggleView();
        this.ui.els.lyricsView.onclick = () => this.ui.toggleView();

        // Drawer
        DOM.get('search-btn').onclick = () => this.ui.openDrawer();
        DOM.get('close-drawer').onclick = () => this.ui.closeDrawer();

        // Playlist Drawer
        DOM.get('playlist-btn').onclick = () => this.ui.openPlaylistDrawer();
        DOM.get('close-playlist').onclick = () => this.ui.closePlaylistDrawer();
        DOM.get('clear-playlist').onclick = () => this.player.clearQueue();

        // Overlay closes any open drawer
        this.ui.els.drawerOverlay.onclick = () => {
            this.ui.closeDrawer();
            this.ui.closePlaylistDrawer();
        };

        // Search
        const searchInput = DOM.get('search-input');

        // 按 Enter 键搜索
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const val = e.target.value.trim();
                if (val) this.doSearch(val, 1);
            }
        };

        // 输入时只显示/隐藏清除按钮
        searchInput.oninput = (e) => {
            const val = e.target.value.trim();
            DOM.get('search-clear').style.display = val ? 'block' : 'none';
        };

        DOM.get('search-clear').onclick = () => {
            searchInput.value = '';
            DOM.get('search-clear').style.display = 'none';
            this.ui.els.resultsList.innerHTML = '';
        };

        // Pagination
        this.ui.els.prevPage.onclick = () => this.doSearch(this.keyword, this.page - 1);
        this.ui.els.nextPage.onclick = () => this.doSearch(this.keyword, this.page + 1);

        // Results Click
        this.ui.els.resultsList.onclick = (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const idx = parseInt(btn.dataset.idx);
            const song = this.player.playlist[idx];

            if (btn.classList.contains('play')) {
                // 点击播放：添加到队列并立即播放
                this.player.addToQueue(song);
                this.player.playFromQueue(this.player.queue.length - 1);
            } else if (btn.classList.contains('add-next')) {
                // 添加为下一首
                this.player.addNext(song);
            } else if (btn.classList.contains('download')) {
                this.download(idx);
            }
        };
    }

    async doSearch(keyword, page) {
        if (!keyword) return;

        // 防止重复请求
        if (this.isSearching) return;
        this.isSearching = true;

        this.keyword = keyword;
        this.page = page;

        // 立即禁用分页按钮
        this.ui.els.prevPage.disabled = true;
        this.ui.els.nextPage.disabled = true;

        this.ui.els.loadingSpinner.style.display = 'flex';
        this.ui.els.resultsList.innerHTML = '';

        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, page })
            });
            const data = await res.json();

            this.player.playlist = data.results || [];

            this.ui.els.resultsList.innerHTML = '';
            if (!data.results || data.results.length === 0) {
                this.ui.els.resultsList.innerHTML = `<div class="empty-state"><p>未找到结果</p></div>`;
            } else {
                const defaultCover = 'https://y.gtimg.cn/music/photo_new/T002R300x300M000003y8dsH2wBHlo_1.jpg';
                data.results.forEach((s, i) => {
                    const div = DOM.create('div', 'result-item');
                    let cover = defaultCover;
                    if (s.album_mid) cover = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.album_mid}.jpg`;

                    div.innerHTML = `
                        <img src="${cover}" class="item-cover" loading="lazy" data-song-idx="${i}">
                        <div class="item-info">
                            <div class="item-title">${s.name}</div>
                            <div class="item-artist">${s.singers}</div>
                        </div>
                        <div class="item-actions">
                            <button class="action-btn play" data-idx="${i}" title="播放"><i class="fas fa-play"></i></button>
                            <button class="action-btn add-next" data-idx="${i}" title="下一首播放"><i class="fas fa-plus"></i></button>
                            <button class="action-btn download" data-idx="${i}" title="下载"><i class="fas fa-download"></i></button>
                        </div>
                    `;

                    // 如果没有 album_mid，异步加载封面
                    if (!s.album_mid) {
                        fetch('/api/cover', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ song_data: s, size: 300 })
                        })
                            .then(r => r.json())
                            .then(coverData => {
                                if (coverData.cover_url && coverData.source !== 'default') {
                                    const img = div.querySelector('.item-cover');
                                    if (img) img.src = coverData.cover_url;
                                }
                            })
                            .catch(() => { });
                    }

                    this.ui.els.resultsList.appendChild(div);
                });
            }

            if (data.pagination) {
                this.ui.els.pagination.style.display = 'flex';
                this.ui.els.pageInfo.textContent = `${page} / ${data.pagination.total_pages}`;
                this.ui.els.prevPage.disabled = !data.pagination.has_prev;
                this.ui.els.nextPage.disabled = !data.pagination.has_next;
            }

        } catch (e) {
            this.ui.notify(e.message, 'error');
        } finally {
            this.ui.els.loadingSpinner.style.display = 'none';
            this.isSearching = false;
        }
    }

    async download(index) {
        const song = this.player.playlist[index];
        const quality = document.getElementById('quality-value').value;
        const preferFlac = (quality === 'flac');

        this.ui.notify(`开始下载: ${song.name}`);

        try {
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    song_data: song,
                    prefer_flac: preferFlac,
                    add_metadata: true
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const a = document.createElement('a');
            a.href = `/api/file/${encodeURIComponent(data.filename)}`;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            this.ui.notify('已触发下载', 'success');
        } catch (e) {
            this.ui.notify(e.message, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new App());