# API 接口文档

## 公共 API (`/api`)

### 搜索歌曲
- **POST** `/api/search`
```json
// 请求
{ "keyword": "歌曲名", "page": 1 }

// 响应
{
  "results": [{
    "mid": "歌曲MID",
    "name": "歌曲名",
    "singers": "歌手",
    "vip": false,
    "album": "专辑名",
    "album_mid": "专辑MID",
    "interval": 240,
    "raw_data": {}
  }],
  "pagination": {
    "current_page": 1,
    "has_prev": false,
    "has_next": true,
    "total_pages": 6,
    "total_results": 60
  },
  "all_results": 60
}
```

### 获取播放 URL
- **POST** `/api/play_url`
```json
// 请求
{ "song_data": { "mid": "歌曲MID" }, "prefer_flac": true }

// 响应
{ "url": "https://...", "quality": "FLAC", "song_mid": "..." }
```

### 下载歌曲
- **POST** `/api/download`
```json
// 请求（raw_data 用于添加歌曲元数据）
{
  "song_data": { "mid": "...", "name": "...", "raw_data": {...} },
  "prefer_flac": true,
  "add_metadata": true
}

// 响应（自动清理：文件夹达到10个文件时自动清空）
{
  "filename": "歌曲名 - 歌手.flac",
  "quality": "FLAC",
  "filepath": "/music/...",
  "cached": false,
  "metadata_added": true
}
```

### 获取歌词
- **GET** `/api/lyric/<song_mid>`
```json
// 响应
{ "lyric": "[00:00.00]歌词内容...", "trans": "翻译歌词..." }
```

### 获取封面
- **POST** `/api/cover`
```json
// 请求
{ "song_data": { "raw_data": {...} }, "size": 800 }

// 响应
{ "cover_url": "https://...", "source": "smart" }
```

### 图片代理
- **GET** `/api/image_proxy?url=https://y.gtimg.cn/...`
- 解决 CORS 限制，代理 QQ 音乐 CDN 图片

### 凭证状态
- **GET** `/api/credential/status`
```json
{ "enabled": true, "status": "...", "expired": false }
```

### 健康检查
- **GET** `/api/health`
```json
{
  "status": "healthy",
  "timestamp": "2025-12-24T...",
  "music_dir_exists": true,
  "music_files_count": 5,
  "environment": "native"
}
```

---

## 管理 API (`/admin`)

### 管理页面
- **GET** `/admin/` - 返回管理页面 HTML

### 生成登录二维码
- **GET** `/admin/api/get_qrcode/<type>` (`qq` 或 `wx`)
```json
{ "session_id": "1234567890", "qrcode": "base64..." }
```

### 查询二维码状态
- **GET** `/admin/api/qr_status/<session_id>`
```json
{ "status": "waiting|success|timeout|refused", "valid": false }
```

### 取消二维码会话
- **POST** `/admin/api/qr_cancel/<session_id>`
```json
{ "success": true, "message": "会话已取消" }
```

### 检查凭证状态
- **GET** `/admin/api/credential/status`
```json
{ "valid": true, "expired": false, "credential_loaded": true }
```

### 刷新凭证
- **POST** `/admin/api/credential/refresh`
```json
{
  "success": true,
  "message": "凭证刷新成功",
  "expired": false,
  "credential_loaded": true
}
```

### 获取凭证信息
- **GET** `/admin/api/credential/info`
```json
{
  "musicid": "...",
  "musickey": "...",
  "expired": "False",
  "can_refresh": "True",
  ...
}
```

### 清空音乐文件夹
- **POST** `/admin/api/clear_music`
```json
{ "success": true, "message": "已清空...", "deleted_count": 10 }
```