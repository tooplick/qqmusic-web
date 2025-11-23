# QQ Music 网页播放器

一个基于Flask和QQ音乐API的在线音乐下载工具，支持搜索、播放、下载和音质选择功能。

## 功能特性

###  核心功能
- **在线播放**：搜索播放歌曲(默认FLAC)
- **多音质下载**: 支持标准音质(MP3)和无损音质(FLAC)

## 安装部署

### Docker 一键部署(推荐)
```
#（Github）
sudo -E bash -c "$(curl -fsSL https://raw.githubusercontent.com/tooplick/qqmusic_web/refs/heads/main/docker/install.sh)"
```
**如果从 Github 下载脚本遇到网络问题，可以使用Gitee仓库**
```

#（Gitee）
sudo -E bash -c "$(curl -fsSL https://gitee.com/tooplick/qqmusic_web/raw/main/docker/giteeinstall.sh)"
```
**Gitee仓库版本更新可能不及时，请谅解！**
### Python 3.10+

1. **克隆项目**
   ```bash
   git clone https://github.com/tooplick/qqmusic_web
   cd qqmusic_web
   ```

2. **安装依赖**
   ```bash
   pip install -r requirements.txt
   ```

3. **启动应用**
   ```bash
   python run.py
   ```

4. **访问应用**
   - 打开浏览器访问 `http://localhost:6022`
   - 凭证管理界面 `http://localhost:6022/admin`

5.  **配置文件夹**
      - `/root/qqmusic_web/credential` #凭证文件夹
      - `/root/qqmusic_web/music` #下载音乐本地目录  


6. **Tip**:  
      - 如果报错请  `pip install qqmusic-api-python flask aiohttp mutagen`

### 示例网站：[qq.ygking.top](https://qq.ygking.top/)

## API接口
详情见：[**API doc.md**](./API%20doc.md)

## 项目结构

详情见：[**Project structure.md**](./Project%20structure.md)

## 更新日志

详情见：[**Update log.md**](./Update%20log.md)

## 技术栈

- **后端**: Flask, aiohttp, mutagen
- **前端**: HTML5, CSS3, JavaScript
- **异步**: asyncio, aiohttp

## 作者信息

- **作者**:GeQian
- **GitHub**：[https://github.com/tooplick](https://github.com/tooplick)

## 免责声明
- 本代码遵循 [GPL-3.0 License](https://github.com/tooplick/qqmusic_web/blob/main/LICENSE) 协议
   - 允许**开源/免费使用和引用/修改/衍生代码的开源/免费使用**
   - 不允许**修改和衍生的代码作为闭源的商业软件发布和销售**
   - 禁止**使用本代码盈利**
- 以此代码为基础的程序**必须**同样遵守 [GPL-3.0 License](https://github.com/tooplick/qqmusic_web/blob/main/LICENSE) 协议
- 本代码仅用于**学习讨论**，禁止**用于盈利**,下载的音乐请于**24小时内删除**,支持**正版音乐**
- 他人或组织使用本代码进行的任何**违法行为**与本人无关