# 项目结构

```
qqmusic_web/
│
├── app/                           # Flask 应用主目录
│   ├── __init__.py                # Flask 应用初始化
│   ├── config.py                  # 配置文件（数据库、路径、API Key 等）
│   ├── models/                    # 数据模型（数据库或数据结构）
│   │   ├── __init__.py
│   │   ├── download_result.py     # 下载结果的数据模型
│   │   └── song_info.py           # 歌曲信息的数据模型
│   ├── routes/                    # 路由层，处理请求
│   │   ├── __init__.py
│   │   ├── api_routes.py          # 提供 API 接口的路由
│   │   ├── admin_routes.py        # 凭证管理后台路由
│   │   └── web_routes.py          # 前端页面路由
│   ├── services/                  # 服务层，处理业务逻辑
│   │   ├── __init__.py
│   │   ├── credential_manager.py  # 管理 QQ 音乐登录凭证
│   │   ├── file_manager.py        # 文件读写管理
│   │   ├── cover_manager.py       # 专辑封面下载/处理
│   │   ├── metadata_manager.py    # 歌曲元数据处理
│   │   └── music_downloader.py    # 音乐下载核心逻辑
│   ├── static/                    # 静态文件（CSS、JS、image）
│   ├── templates/                 # 前端 HTML
│   └── utils/                     # 工具类
│       └── thread_utils.py        # 线程相关工具
│
├── credential/                  
│   └── qqmusic_cred.pkl           # QQ 音乐登录凭证
│
├── docker/                        # Docker 部署相关文件
│   ├── docker-compose.yml         # Docker Compose 配置文件
│   ├── dockerfile                 # Docker 镜像构建文件
│   ├── giteeinstall.sh            # Gitee 安装脚本
│   └── install.sh                 # Github 安装脚本
│
├── LICENSE                        # 许可证文件
├── music/                         # 下载的音乐文件存储目录
├── run.py                         # 启动 Flask 应用入口
├── README.md                      # 项目说明文档
├── Project structure.md           # 项目结构说明
├── Update log.md                  # 更新日志
├── pyproject.toml                 # Poetry 项目配置文件
├── requirements.txt               # Python 依赖文件（pip）
├── poetry.lock                    # Poetry 依赖锁文件
└── uv.lock                        # uv 依赖锁文件
```

## 详细文件说明

### 应用核心 (app/)

#### 配置和初始化
- **`__init__.py`**: Flask应用初始化，创建应用实例并注册蓝图
- **`config.py`**: 应用配置管理，支持容器和非容器环境

#### 数据模型 (app/models/)
- **`download_result.py`**: 下载结果数据模型定义
- **`song_info.py`**: 歌曲信息数据模型定义

#### 路由处理 (app/routes/)
- **`api_routes.py`**: 提供搜索、下载、播放等API接口
- **`admin_routes.py`**: 凭证管理页面路由（/admin/ 路径）
- **`web_routes.py`**: 音乐下载页面的Web路由（根路径 /）

#### 业务服务 (app/services/)
- **`credential_manager.py`**: QQ音乐登录凭证的管理和验证
- **`file_manager.py`**: 文件操作相关功能，包括文件名清理和文件下载
- **`cover_manager.py`**: 处理专辑封面的获取和下载
- **`metadata_manager.py`**: 为音频文件添加元数据（封面、歌词等）
- **`music_downloader.py`**: 音乐下载核心功能，支持多种音质

#### 前端资源
- **`static/`**: 静态资源文件（CSS、JavaScript、图片）
- **`templates/`**: HTML模板文件

#### 工具类
- **`utils/thread_utils.py`**: 线程管理和异步处理工具

### 数据存储
- **`credential/qqmusic_cred.pkl`**: 序列化的QQ音乐登录凭证
- **`music/`**: 下载的音乐文件存储目录

### 部署配置
- **`docker/`**: Docker容器化部署相关文件
- **`requirements.txt`**: Python依赖包列表（pip）
- **`pyproject.toml`**: Poetry项目配置
- **`poetry.lock`**: Poetry依赖锁文件

### 启动文件
- **`run.py`**: Flask应用主入口，初始化所有组件并启动服务器




