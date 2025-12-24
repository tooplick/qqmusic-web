// 管理员页面 JavaScript
const BASE_URL = window.location.origin;

console.log('BASE_URL:', BASE_URL);

// DOM 元素缓存
const qqLoginBtn = document.getElementById('qqLoginBtn');
const wxLoginBtn = document.getElementById('wxLoginBtn');
const qrcodeContainer = document.getElementById('qrcodeContainer');
const qrcodeImage = document.getElementById('qrcodeImage');
const qrcodePlaceholder = document.getElementById('qrcodePlaceholder');
const qrcodeStatus = document.getElementById('qrcodeStatus');
const checkStatusBtn = document.getElementById('checkStatusBtn');
const refreshBtn = document.getElementById('refreshBtn');
const infoBtn = document.getElementById('infoBtn');
const clearMusicBtn = document.getElementById('clearMusicBtn');
const toastContainer = document.getElementById('toast-container');

// 事件绑定
qqLoginBtn.addEventListener('click', () => generateQRCode('qq'));
wxLoginBtn.addEventListener('click', () => generateQRCode('wx'));
checkStatusBtn.addEventListener('click', checkCredentialStatus);
refreshBtn.addEventListener('click', refreshCredential);
infoBtn.addEventListener('click', getCredentialInfo);
clearMusicBtn.addEventListener('click', clearMusicFolder);

// 当前活跃的会话ID 和轮询定时器
let currentSessionId = null;
let checkInterval = null;

// Toast 通知
function showToast(message, type = 'info', duration = 3000) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// 取消后端会话（停止后端轮询线程）
async function cancelSession() {
    if (currentSessionId) {
        try {
            const url = `${BASE_URL}/admin/api/qr_cancel/${currentSessionId}`;
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url);
            } else {
                fetch(url, { method: 'POST', keepalive: true });
            }
        } catch (e) {
            console.error('取消会话失败:', e);
        }
    }
}

// 清理轮询定时器和后端会话
function clearPolling() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    cancelSession();
    currentSessionId = null;
}

// 页面卸载时清理
window.addEventListener('beforeunload', clearPolling);

// 生成二维码
async function generateQRCode(type) {
    clearPolling();
    try {
        qrcodeImage.style.display = 'none';
        qrcodePlaceholder.innerHTML = '<div class="loading-spinner"></div>';
        qrcodePlaceholder.style.display = 'flex';
        qrcodeStatus.textContent = '正在生成二维码...';

        const response = await fetch(`${BASE_URL}/admin/api/get_qrcode/${type}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        currentSessionId = data.session_id;

        qrcodeImage.onload = () => {
            qrcodePlaceholder.style.display = 'none';
            qrcodeImage.style.display = 'block';
            qrcodeStatus.textContent = '请使用手机扫描二维码';
            qrcodeStatus.className = 'qrcode-status';
        };

        qrcodeImage.onerror = () => {
            qrcodePlaceholder.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            qrcodePlaceholder.style.display = 'flex';
            qrcodeImage.style.display = 'none';
            qrcodeStatus.textContent = '二维码加载失败';
            qrcodeStatus.className = 'qrcode-status error';
        };

        qrcodeImage.src = `data:image/png;base64,${data.qrcode}`;

        // 轮询检查登录状态
        checkInterval = setInterval(async () => {
            if (!currentSessionId) {
                clearPolling();
                return;
            }
            try {
                const statusResponse = await fetch(`${BASE_URL}/admin/api/qr_status/${currentSessionId}`);
                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    if (statusData.status === 'success') {
                        clearPolling();
                        qrcodeStatus.textContent = '登录成功！';
                        qrcodeStatus.className = 'qrcode-status success';
                        showToast('登录成功，凭证已保存', 'success');
                    } else if (statusData.status === 'timeout' || statusData.status === 'refused') {
                        clearPolling();
                        qrcodeStatus.textContent = statusData.status === 'timeout' ? '二维码已过期' : '用户拒绝登录';
                        qrcodeStatus.className = 'qrcode-status error';
                    }
                }
            } catch (e) {
                console.error('轮询状态失败:', e);
            }
        }, 2000);

    } catch (error) {
        console.error('生成二维码失败:', error);
        qrcodePlaceholder.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        qrcodePlaceholder.style.display = 'flex';
        qrcodeImage.style.display = 'none';
        qrcodeStatus.textContent = '生成失败';
        qrcodeStatus.className = 'qrcode-status error';
        showToast(`生成二维码失败: ${error.message}`, 'error');
    }
}

// 检查凭证状态
async function checkCredentialStatus() {
    checkStatusBtn.disabled = true;
    try {
        const response = await fetch(`${BASE_URL}/admin/api/credential/status`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        showToast(data.valid ? '凭证有效 ✓' : '凭证无效或已过期', data.valid ? 'success' : 'error');
    } catch (error) {
        showToast(`检查失败: ${error.message}`, 'error');
    } finally {
        checkStatusBtn.disabled = false;
    }
}

// 刷新凭证
async function refreshCredential() {
    refreshBtn.disabled = true;
    try {
        const response = await fetch(`${BASE_URL}/admin/api/credential/refresh`, { method: 'POST' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        showToast(data.message || '刷新成功', 'success');
    } catch (error) {
        showToast(`刷新失败: ${error.message}`, 'error');
    } finally {
        refreshBtn.disabled = false;
    }
}

// DOM - 凭证信息区域
const infoSection = document.getElementById('info-section');
const infoContent = document.getElementById('info-content');
const infoClose = document.getElementById('info-close');

// 关闭凭证信息
infoClose.addEventListener('click', () => {
    infoSection.style.display = 'none';
});

// 获取凭证信息
async function getCredentialInfo() {
    infoBtn.disabled = true;
    try {
        const response = await fetch(`${BASE_URL}/admin/api/credential/info`);
        if (!response.ok) {
            if (response.status === 404) throw new Error('未找到凭证');
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();

        // 在页面底部显示凭证信息
        let html = '';
        for (const [key, value] of Object.entries(data)) {
            html += `
                <div class="info-item">
                    <div class="info-label">${key}</div>
                    <div class="info-value">${value}</div>
                </div>
            `;
        }

        infoContent.innerHTML = html;
        infoSection.style.display = 'block';

        // 滚动到凭证信息区域
        infoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        showToast(`获取失败: ${error.message}`, 'error');
    } finally {
        infoBtn.disabled = false;
    }
}

// 清空音乐文件夹
async function clearMusicFolder() {
    if (!confirm('确定要清空音乐文件夹吗？')) return;

    clearMusicBtn.disabled = true;
    try {
        const response = await fetch(`${BASE_URL}/admin/api/clear_music`, { method: 'POST' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        showToast(data.message, data.success ? 'success' : 'error');
    } catch (error) {
        showToast(`清空失败: ${error.message}`, 'error');
    } finally {
        clearMusicBtn.disabled = false;
    }
}