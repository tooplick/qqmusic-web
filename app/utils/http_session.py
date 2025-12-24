"""共享 HTTP 会话管理"""
import aiohttp
import logging
from typing import Optional

logger = logging.getLogger("qqmusic_web")

# 全局共享 session（延迟初始化）
_shared_session: Optional[aiohttp.ClientSession] = None


async def get_session(timeout: int = 60) -> aiohttp.ClientSession:
    """获取共享的 aiohttp session
    
    复用连接池，避免每次请求都创建新连接。
    注意：此 session 需要在应用关闭时通过 close_session() 清理。
    """
    global _shared_session
    
    if _shared_session is None or _shared_session.closed:
        _shared_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=timeout),
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        )
        logger.debug("创建新的共享 aiohttp session")
    
    return _shared_session


async def close_session():
    """关闭共享 session（应在应用关闭时调用）"""
    global _shared_session
    
    if _shared_session and not _shared_session.closed:
        await _shared_session.close()
        logger.debug("已关闭共享 aiohttp session")
    
    _shared_session = None
