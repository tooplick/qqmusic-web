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
            nextPage: DOM.get('next-page')
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
            const re = /\[(\d+):(\d+)\.(\d+)\]/;
            lines.forEach(l => {
                const m = l.match(re);
                if (m) {
                    const t = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / 100;
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
        // 如果用户正在滚动，不自动定位
        if (this.userScrolling) return;

        let idx = -1;
        for (let i = 0; i < this.currentLyrics.length; i++) {
            if (time >= this.currentLyrics[i].t) idx = i;
            else break;
        }

        if (idx !== -1 && idx !== this.lastHighlightIdx) {
            this.lastHighlightIdx = idx;
            const active = this.els.lyricsScroll.querySelector('.active');
            if (active) active.classList.remove('active');

            const curr = this.els.lyricsScroll.children[idx];
            if (curr && !curr.classList.contains('empty-state')) {
                curr.classList.add('active');
                curr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}

class Player {
    constructor(ui) {
        this.ui = ui;
        this.audio = new Audio();
        this.playlist = [];
        this.currentIndex = -1;
        this.volume = 1.0;
        this._initAudio();
    }

    _initAudio() {
        this.audio.ontimeupdate = () => {
            this.ui.updateProgress(this.audio.currentTime, this.audio.duration);
            this.ui.highlightLyric(this.audio.currentTime);
        };
        this.audio.onended = () => this.next();
        this.audio.onplay = () => this.ui.setPlaying(true);
        this.audio.onpause = () => this.ui.setPlaying(false);
        this.audio.onerror = () => {
            this.ui.notify('音频播放出错', 'error');
            this.ui.setPlaying(false);
        };
    }

    async play(index) {
        if (index < 0 || index >= this.playlist.length) return;
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
        if (!this.playlist.length) return;
        const idx = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
        this.play(idx);
    }

    next() {
        if (!this.playlist.length) return;
        const idx = (this.currentIndex + 1) % this.playlist.length;
        this.play(idx);
    }

    seek(time) {
        if (this.audio.duration) this.audio.currentTime = time;
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
        this.ui.els.drawerOverlay.onclick = () => this.ui.closeDrawer();

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
            if (btn.classList.contains('play')) this.player.play(idx);
            else if (btn.classList.contains('download')) this.download(idx);
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
                            <button class="action-btn play" data-idx="${i}"><i class="fas fa-play"></i></button>
                            <button class="action-btn download" data-idx="${i}"><i class="fas fa-download"></i></button>
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