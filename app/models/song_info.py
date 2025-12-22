from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass
class SongInfo:
    """歌曲信息数据类"""
    mid: str
    name: str
    singers: str
    vip: bool
    album: str
    album_mid: str
    interval: int
    raw_data: Optional[Dict[str, Any]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SongInfo':
        """从字典创建 SongInfo 实例"""
        return cls(
            mid=data.get('mid', ''),
            name=data.get('name', ''),
            singers=data.get('singers', ''),
            vip=data.get('vip', False),
            album=data.get('album', ''),
            album_mid=data.get('album_mid', ''),
            interval=data.get('interval', 0),
            raw_data=data.get('raw_data')
        )