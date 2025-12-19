#!/bin/bash
# QQMusic Web 一键安装脚本

set -e

echo "开始安装 QQMusic Web..."

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请使用 sudo 运行此脚本"
    exit 1
fi

# 创建项目目录
PROJECT_DIR="/opt/qqmusic-web"
echo "创建项目目录: $PROJECT_DIR"

# 如果目录已存在，完全清理
if [ -d "$PROJECT_DIR" ]; then
    echo "清理现有目录..."
    rm -rf "$PROJECT_DIR"
fi

mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 创建配置目录
echo "创建配置目录..."
mkdir -p /root/qqmusic_web/credential
mkdir -p /root/qqmusic_web/music

# 设置目录权限
chmod 755 /root/qqmusic_web/credential
chmod 755 /root/qqmusic_web/music

echo "配置目录已创建: /root/qqmusic_web/"

# 下载项目文件的函数
download_project_with_wget() {
    echo "使用 wget 下载项目文件..."
    
    # 检查 wget 命令是否存在
    if ! command -v wget &> /dev/null; then
        echo "安装 wget..."
        if command -v apt-get &> /dev/null; then
            apt-get update
            apt-get install -y wget
        elif command -v yum &> /dev/null; then
            yum install -y wget
        else
            echo "错误: 无法安装 wget，请手动安装后重试"
            exit 1
        fi
    fi
    
    # 下载项目zip文件
    echo "下载项目文件..."
    wget -O qqmusic_web.zip https://raw.githubusercontent.com/tooplick/qqmusic_web/main/docker/qqmusic_web.zip
    
    # 检查unzip命令是否存在
    if ! command -v unzip &> /dev/null; then
        echo "安装 unzip..."
        if command -v apt-get &> /dev/null; then
            apt-get install -y unzip
        elif command -v yum &> /dev/null; then
            yum install -y unzip
        else
            echo "错误: 无法安装 unzip，请手动安装后重试"
            exit 1
        fi
    fi
    
    # 解压文件
    echo "解压项目文件..."
    unzip -q qqmusic_web.zip
    
    # 清理临时文件
    echo "清理临时文件..."
    rm -f qqmusic_web.zip
    
    echo "项目文件下载完成"
}

# 下载项目文件
echo "下载项目文件..."

# 尝试使用 git 下载（但可能失败）
if command -v git &> /dev/null; then
    echo "尝试使用 git 克隆项目..."
    # 尝试使用 git 协议（不加密）可能更可靠
    if git clone --depth=1 git://github.com/tooplick/qqmusic_web.git . 2>/dev/null; then
        echo "项目文件通过 git 协议下载完成"
    else
        echo "git 克隆失败，尝试使用 wget 下载..."
        # 清理目录
        rm -rf ./* ./.??* 2>/dev/null || true
        download_project_with_wget
    fi
else
    echo "git 命令不存在，使用 wget 下载..."
    download_project_with_wget
fi

# 检查是否成功下载了关键文件
if [ ! -f "docker/dockerfile" ] || [ ! -f "docker/docker-compose.yml" ]; then
    echo "警告: 关键文件缺失，尝试备用下载方法..."
    
    # 尝试直接下载单个文件
    echo "下载 docker 配置文件..."
    mkdir -p docker
    
    # 尝试下载 dockerfile
    wget -O docker/dockerfile https://raw.githubusercontent.com/tooplick/qqmusic_web/main/docker/dockerfile 2>/dev/null || true
    
    # 尝试下载 docker-compose.yml
    wget -O docker/docker-compose.yml https://raw.githubusercontent.com/tooplick/qqmusic_web/main/docker/docker-compose.yml 2>/dev/null || true
    
    # 检查是否成功
    if [ ! -f "docker/dockerfile" ] || [ ! -f "docker/docker-compose.yml" ]; then
        echo "错误: 无法下载必要的项目文件"
        echo "请检查网络连接或手动下载项目文件"
        exit 1
    fi
fi

# 迁移凭证
echo "检查并迁移凭证文件..."
if [ ! -f "/root/qqmusic_web/credential/qqmusic_cred.pkl" ]; then
    if [ -f "$PROJECT_DIR/qqmusic_cred.pkl" ]; then
        echo "正在迁移凭证文件..."
        cp $PROJECT_DIR/qqmusic_cred.pkl /root/qqmusic_web/credential/qqmusic_cred.pkl
        echo "凭证文件已迁移到 /root/qqmusic_web/credential/qqmusic_cred.pkl"
    else
        echo "项目中没有找到凭证文件，将使用默认配置"
    fi
else
    echo "本地已有凭证文件，跳过迁移"
fi

# 检测是否在中国地区
echo "检测网络环境..."
IS_CHINA=false

# 检查IP地理位置
if command -v curl &> /dev/null; then
    IP_INFO=$(curl -s --max-time 5 "http://ip-api.com/json/" || echo "")
    if echo "$IP_INFO" | grep -q "\"country\":\"China\""; then
        IS_CHINA=true
    else
        # 检查特定中国网站的可访问性
        if curl -s --connect-timeout 5 "https://www.baidu.com" > /dev/null 2>&1 && \
           ! curl -s --connect-timeout 5 "https://www.google.com" > /dev/null 2>&1; then
            IS_CHINA=true
        fi
    fi
fi

if [ "$IS_CHINA" = true ]; then
    echo "检测到中国大陆网络环境，修改 Dockerfile 使用国内镜像源"
    
    # 备份原始 Dockerfile
    if [ -f "docker/dockerfile" ]; then
        cp docker/dockerfile docker/dockerfile.backup 2>/dev/null || true
    fi
    
    # 修改 Dockerfile 使用国内镜像
    if [ -f "docker/dockerfile" ]; then
        sed -i 's|FROM python:3.11-slim|FROM docker.1ms.run/library/python:3.11-slim|' docker/dockerfile
        echo "Dockerfile 已修改为使用国内镜像源"
    else
        echo "警告: 未找到 docker/dockerfile，跳过修改"
    fi
else
    echo "非中国大陆网络环境，使用默认官方镜像源"
fi

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker 安装完成"
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "安装 Docker Compose..."
    # 尝试多个下载源
    COMPOSE_URL="https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)"
    if ! curl -L "$COMPOSE_URL" -o /usr/local/bin/docker-compose 2>/dev/null; then
        echo "使用备选下载源..."
        curl -L "https://ghproxy.com/$COMPOSE_URL" -o /usr/local/bin/docker-compose || {
            echo "错误: 无法下载 Docker Compose"
            exit 1
        }
    fi
    chmod +x /usr/local/bin/docker-compose
    echo "Docker Compose 安装完成"
fi

# 检查 Docker 配置文件是否存在
if [ ! -f "docker/dockerfile" ]; then
    echo "错误: 未找到 docker/dockerfile"
    exit 1
fi

if [ ! -f "docker/docker-compose.yml" ]; then
    echo "错误: 未找到 docker/docker-compose.yml"
    exit 1
fi

echo "使用docker-compose.yml配置..."

# 进入 docker 目录
cd docker

# 停止并删除现有容器
echo "停止并删除现有容器..."
docker-compose down 2>/dev/null || true

# 获取镜像名称并删除旧镜像
echo "删除旧镜像..."
IMAGE_NAME=$(grep "image:" docker-compose.yml | awk '{print $2}' | head -1)
if [ -n "$IMAGE_NAME" ] && docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "删除旧镜像: $IMAGE_NAME"
    docker rmi "$IMAGE_NAME" 2>/dev/null || true
fi

# 构建并启动新容器
echo "构建并启动新的 Docker 容器..."
if docker-compose up -d --build --force-recreate; then
    echo "Docker 容器启动成功"
else
    echo "警告: docker-compose 启动失败，尝试直接构建..."
    docker build -t qqmusic-web .
    docker run -d --name qqmusic-web -p 6022:6022 qqmusic-web
fi

# 等待服务启动
echo "等待服务启动..."
sleep 3

# 检查服务状态
if docker ps | grep -q "qqmusic-web"; then
    echo "QQMusic Web 安装成功！"
    echo ""
    
    # 获取本地IP地址
    # 使用hostname命令
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    
    # 使用ip命令
    if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "" ]; then
        LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7}' | head -1)
    fi
    
    # 如果前两种方法都失败，尝试从网络接口获取
    if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "" ]; then
        LOCAL_IP=$(ip addr show 2>/dev/null | grep -oP 'inet \K[\d.]+' | grep -v '127.0.0.1' | head -1)
    fi
    
    # 如果仍然无法获取IP，使用默认值
    if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "" ]; then
        LOCAL_IP="127.0.0.1"
    fi
    
    echo "访问地址:"
    echo "  - 本地访问: http://localhost:6022"
    if [ "$LOCAL_IP" != "127.0.0.1" ] && [ "$LOCAL_IP" != "" ]; then
        echo "  - 局域网访问: http://${LOCAL_IP}:6022"
    fi
    
    echo ""
    
    # 获取公网IP地址
    echo "正在获取公网IP地址..."
    PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 ipinfo.io/ip || curl -s --max-time 5 api.ipify.org || echo "")
    
    if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "" ] && [[ ! "$PUBLIC_IP" =~ ^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.) ]]; then
        echo "  - 公网访问: http://${PUBLIC_IP}:6022"
        echo "    注意: 请确保防火墙已开放 6022 端口"
    elif [ -n "$PUBLIC_IP" ]; then
        echo "  - 检测到IP地址为内网地址: ${PUBLIC_IP}"
        echo "    提示: 您的服务器可能位于NAT后面，无法直接通过公网访问"
    else
        echo "  - 无法获取公网IP地址"
    fi
    
    echo ""
    echo "项目目录: $PROJECT_DIR"
    echo "配置目录: /root/qqmusic_web/"
    echo ""
    
    echo "管理命令:"
    echo "   查看日志: docker logs qqmusic-web"
    echo "   停止服务: docker stop qqmusic-web"
    echo "   重启服务: docker restart qqmusic-web"
    echo "   更新服务: cd $PROJECT_DIR && bash <(curl -fsSL https://raw.githubusercontent.com/tooplick/qqmusic_web/main/docker/install.sh)"
    
    echo ""
    
    echo "首次访问可能需要初始化，请稍等1-2分钟后访问上述地址"
    
else
    echo "服务启动失败，请检查日志:"
    docker logs qqmusic-web 2>/dev/null || echo "无法获取日志，请手动检查"
    exit 1
fi