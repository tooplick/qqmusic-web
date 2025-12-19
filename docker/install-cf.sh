#!/bin/bash
# QQMusic Web 一键安装脚本

set -e

echo "开始安装 QQMusic Web..."

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    echo "请使用 sudo 运行此脚本"
    exit 1
fi

# 将wget下载逻辑封装为函数
wget_download_project() {
    echo "使用wget下载项目文件..."
    
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
    
    echo "下载项目文件..."
    wget -O qqmusic_web.zip https://github.ygking.top/github.com/tooplick/qqmusic_web/archive/refs/heads/main.zip
    
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
    
    # 移动文件
    echo "移动文件到项目目录..."
    mv qqmusic_web-main/* ./
    mv qqmusic_web-main/.* ./ 2>/dev/null || true
    
    # 清理临时文件
    echo "清理临时文件..."
    rm -rf qqmusic_web-main
    rm -f qqmusic_web.zip
    
    echo "项目文件下载完成"
}

# 创建项目目录
PROJECT_DIR="/opt/qqmusic-web"
echo "创建项目目录: $PROJECT_DIR"

# 如果目录已存在，先清理
if [ -d "$PROJECT_DIR" ]; then
    echo "清理现有目录..."
    rm -rf "$PROJECT_DIR"
fi

mkdir -p $PROJECT_DIR

# 创建配置目录
echo "创建配置目录..."
mkdir -p /root/qqmusic_web/credential
mkdir -p /root/qqmusic_web/music

# 设置目录权限
chmod 755 /root/qqmusic_web/credential
chmod 755 /root/qqmusic_web/music

echo "配置目录已创建: /root/qqmusic_web/"

# 下载项目文件
echo "下载项目文件..."

# 进入项目目录
cd $PROJECT_DIR

# 检查 git 命令是否存在
if command -v git &> /dev/null; then
    echo "使用git克隆项目..."
    # 确保目录是空的
    rm -rf ./* ./.git* 2>/dev/null || true
    
    # 尝试直接克隆
    if git clone --depth=1 https://github.ygking.top/github.com/tooplick/qqmusic_web.git .; then
        echo "项目文件下载完成"
    else
        echo "Git克隆失败，尝试使用wget..."
        # 回退到wget方式
        rm -rf ./*
        wget_download_project
    fi
else
    echo "git命令不存在，使用wget下载..."
    wget_download_project
fi

# 迁移凭证
echo "检查并迁移凭证文件..."
if [ ! -f "/root/qqmusic_web/credential/qqmusic_cred.pkl" ] && [ -f "$PROJECT_DIR/credential/qqmusic_cred.pkl" ]; then
    echo "正在从Git迁移凭证文件..."
    cp $PROJECT_DIR/credential/qqmusic_cred.pkl /root/qqmusic_web/credential/qqmusic_cred.pkl
    echo "凭证文件已迁移到 /root/qqmusic_web/credential/qqmusic_cred.pkl"
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
    echo "检测到中国地区网络环境，修改 Dockerfile 使用国内镜像源"
    
    # 检查Dockerfile是否存在
    if [ -f "docker/dockerfile" ]; then
        # 备份原始 Dockerfile
        cp docker/dockerfile docker/dockerfile.backup
        
        # 修改 Dockerfile 使用国内镜像
        sed -i 's|FROM python:3.11-slim|FROM docker.1ms.run/library/python:3.11-slim|' docker/dockerfile
        
        echo "Dockerfile 已修改为使用国内镜像源"
    else
        echo "警告: 未找到 docker/dockerfile"
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
    curl -L "https://github.ygking.top/github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
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
docker-compose up -d --build --force-recreate

# 等待服务启动
echo "等待服务启动..."
sleep 5

# 检查服务状态
if docker-compose ps | grep -q "Up"; then
    echo "QQMusic Web 安装成功！"
    echo ""
    
    # 获取本地IP地址
    LOCAL_IP="127.0.0.1"
    if command -v hostname &> /dev/null; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "" ]; then
        LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7}' | head -1 || echo "127.0.0.1")
    fi
    
    echo "本地访问地址: http://localhost:6022"
    if [ "$LOCAL_IP" != "127.0.0.1" ]; then
        echo "局域网访问地址: http://${LOCAL_IP}:6022"
    fi
    
    # 获取公网IP地址
    if command -v curl &> /dev/null; then
        PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 ipinfo.io/ip || curl -s --max-time 5 api.ipify.org || echo "")
        
        if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "" ]; then
            echo "公网访问地址: http://${PUBLIC_IP}:6022"
            echo "注意: 请确保防火墙已开放 6022 端口"
        fi
    fi
    
    echo ""
    echo "项目目录: $PROJECT_DIR"
    echo "配置目录: /root/qqmusic_web/"
    echo ""
    
    echo "管理命令:"
    echo "   查看日志: cd $PROJECT_DIR/docker && sudo docker-compose logs -f"
    echo "   停止服务: cd $PROJECT_DIR/docker && sudo docker-compose down"
    echo "   重启服务: cd $PROJECT_DIR/docker && sudo docker-compose restart"
    echo "   更新服务: cd $PROJECT_DIR/docker && sudo docker-compose up -d --build --force-recreate"
    
    echo ""
    
    # 显示初始访问信息
    echo "首次访问可能需要初始化，请稍等1-2分钟后访问上述地址"
    
else
    echo "服务启动失败，请检查日志:"
    docker-compose logs --tail=50
    exit 1
fi