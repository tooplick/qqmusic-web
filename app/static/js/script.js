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
            bgLayer: DOM.get('bg-layer'),
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
            volumeFill: DOM.get('volume-fill'),

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

        // 监听用户手动滚动歌词
        this.els.lyricsScroll.addEventListener('scroll', () => {
            this.userScrolling = true;
            clearTimeout(this.scrollTimeout);
            // 3秒后恢复自动滚动
            this.scrollTimeout = setTimeout(() => {
                this.userScrolling = false;
            }, 3000);
        }, { passive: true });
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
        if (isPlaying) this.els.playerView.classList.add('playing');
        else this.els.playerView.classList.remove('playing');
    }

    // Drawer Control
    openDrawer() {
        this.els.searchDrawer.classList.add('open');
        this.els.drawerOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeDrawer() {
        this.els.searchDrawer.classList.remove('open');
        this.els.drawerOverlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    // Toggle Cover/Lyrics
    toggleView() {
        this.els.coverView.classList.toggle('active');
        this.els.lyricsView.classList.toggle('active');
    }

    // Playlist Drawer Control
    openPlaylistDrawer() {
        this.els.playlistDrawer.classList.add('open');
        this.els.drawerOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closePlaylistDrawer() {
        this.els.playlistDrawer.classList.remove('open');
        this.els.drawerOverlay.classList.remove('show');
        document.body.style.overflow = '';
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

        this.els.playlistList.innerHTML = '';
        queue.forEach((song, i) => {
            let cover = 'https://y.gtimg.cn/music/photo_new/T002R300x300M000003y8dsH2wBHlo_1.jpg';
            if (song.album_mid) {
                cover = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.album_mid}.jpg`;
            }

            const div = DOM.create('div', `playlist-item ${i === currentIndex ? 'playing' : ''}`);
            div.innerHTML = `
                <img src="${cover}" class="item-cover" loading="lazy">
                <div class="item-info">
                    <div class="item-title">${song.name}</div>
                    <div class="item-artist">${song.singers}</div>
                </div>
                <button class="remove-btn" data-idx="${i}"><i class="fas fa-times"></i></button>
            `;

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

        let cover = 'https://y.gtimg.cn/music/photo_new/T002R800x800M000003y8dsH2wBHlo_1.jpg';
        if (song.album_mid) {
            cover = `https://y.gtimg.cn/music/photo_new/T002R800x800M000${song.album_mid}.jpg`;
        }

        this.els.albumCover.src = cover;
        this.els.bgLayer.style.backgroundImage = `url('${cover}')`;

        // 提取封面主色调并应用到控制栏
        this._extractCoverColor(cover);
    }

    _extractCoverColor(coverUrl) {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
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

                // 设置控制栏背景色（降低透明度使颜色更明显）
                document.documentElement.style.setProperty(
                    '--controls-bg',
                    `rgba(${r}, ${g}, ${b}, 0.75)`
                );
            } catch (e) {
                console.log('Color extraction failed:', e);
            }
        };
        img.src = coverUrl;
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
            row.onclick = () => window.player.seek(l.t);
            this.els.lyricsScroll.appendChild(row);
        });
    }

    highlightLyric(time) {
        if (!this.currentLyrics.length) return;
        // 移除 userScrolling 检查，因为 scrollTo 会触发 scroll 事件，导致自我阻塞

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
                // 参考用户代码，使用 scrollTo + smooth behavior
                if (this.els.lyricsScroll) {
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
    constructor(ui) {
        this.ui = ui;
        this.audio = new Audio();
        this.playlist = [];  // 搜索结果（临时）
        this.queue = [];     // 播放队列（持久）
        this.currentIndex = -1;
        this.volume = 1.0;
        this._initAudio();
    }

    _initAudio() {

        this.audio.onended = () => this.next();
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
        const quality = document.querySelector('input[name="quality"]:checked').value;
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
            this.audio.volume = this.volume;
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
        const idx = (this.currentIndex + 1) % this.queue.length;
        this.playFromQueue(idx);
    }

    seek(time) {
        if (this.audio.duration) this.audio.currentTime = time;
    }

    // --- 播放队列管理 ---

    // 添加到队列末尾
    addToQueue(song) {
        this.queue.push(song);
        this.ui.renderPlaylist(this.queue, this.currentIndex);
        this.ui.notify(`已添加到队列: ${song.name}`);
    }

    // 添加为下一首播放
    addNext(song) {
        // 插入到当前播放位置的下一个
        const insertPos = this.currentIndex + 1;
        this.queue.splice(insertPos, 0, song);
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
        this.ui.renderPlaylist(this.queue, this.currentIndex);
    }

    // 清空队列
    clearQueue() {
        this.queue = [];
        this.currentIndex = -1;
        this.audio.pause();
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
        const quality = document.querySelector('input[name="quality"]:checked').value;
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
                this.audio.volume = this.volume;
                this.audio.play();
                this.ui.notify(`正在播放: ${song.name} (${data.quality})`);
            })
            .catch(e => {
                this.ui.notify(`播放失败: ${e.message}`, 'error');
            });
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        this.audio.volume = this.volume;
        this.ui.els.volumeFill.style.width = `${this.volume * 100}%`;
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

        // Volume
        DOM.get('volume-slider').onclick = (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            this.player.setVolume(pct);
        };

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
        const debouncedSearch = debounce((kw) => this.doSearch(kw, 1), 500);

        searchInput.oninput = (e) => {
            const val = e.target.value.trim();
            DOM.get('search-clear').style.display = val ? 'block' : 'none';
            if (val) debouncedSearch(val);
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
        this.keyword = keyword;
        this.page = page;

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
                data.results.forEach((s, i) => {
                    const div = DOM.create('div', 'result-item');
                    let cover = 'https://y.gtimg.cn/music/photo_new/T002R300x300M000003y8dsH2wBHlo_1.jpg';
                    if (s.album_mid) cover = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.album_mid}.jpg`;

                    div.innerHTML = `
                        <img src="${cover}" class="item-cover" loading="lazy">
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
        }
    }

    async download(index) {
        const song = this.player.playlist[index];
        const quality = document.querySelector('input[name="quality"]:checked').value;
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