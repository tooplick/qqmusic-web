import os
import logging
from pathlib import Path
from typing import Optional
from ..utils.http_session import get_session

logger = logging.getLogger("qqmusic_web")

class FileManager:
    """文件管理器"""

    def __init__(self, config):
        self.config = config

    def sanitize_filename(self, filename: str) -> str:
        """清理文件名中的非法字符并限制长度"""
        illegal_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
        for char in illegal_chars:
            filename = filename.replace(char, '_')

        # 限制文件名长度
        if len(filename) > self.config["MAX_FILENAME_LENGTH"]:
            name, ext = os.path.splitext(filename)
            filename = name[:self.config["MAX_FILENAME_LENGTH"] - len(ext)] + ext

        return filename

    async def download_file_content(self, url: str) -> Optional[bytes]:
        """异步下载文件内容（使用共享session）"""
        try:
            session = await get_session(timeout=self.config["DOWNLOAD_TIMEOUT"])
            async with session.get(url) as resp:
                if resp.status == 200:
                    content = await resp.read()
                    # 检查内容是否有效（大于1KB）
                    if len(content) > 1024:
                        return content
                    else:
                        logger.warning(f"下载内容过小: {len(content)} bytes")
                else:
                    logger.warning(f"下载失败，状态码: {resp.status}")
                return None
        except Exception as e:
            logger.error(f"下载文件时出错: {e}")
            return None