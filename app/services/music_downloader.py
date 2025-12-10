import logging
from pathlib import Path
from typing import Optional
from qqmusic_api.song import get_song_urls, SongFileType
from qqmusic_api.lyric import get_lyric
from qqmusic_api.login import check_expired
from ..models import SongInfo, DownloadResult
from .file_manager import FileManager
from .metadata_manager import MetadataManager

logger = logging.getLogger("qqmusic_web")


class MusicDownloader:
    """音乐下载器"""

    def __init__(self, config, credential_manager, file_manager, metadata_manager):
        self.config = config
        self.credential_manager = credential_manager
        self.file_manager = file_manager
        self.metadata_manager = metadata_manager

    async def download_song(self, song_info: SongInfo, prefer_flac: bool = False,
                            add_metadata: bool = True) -> Optional[DownloadResult]:
        """下载歌曲"""
        # 设置下载策略
        if prefer_flac:
            quality_order = [
                (SongFileType.FLAC, "FLAC"),
                (SongFileType.MP3_320, "320kbps"),
                (SongFileType.MP3_128, "128kbps")
            ]
        else:
            quality_order = [
                (SongFileType.MP3_320, "320kbps"),
                (SongFileType.MP3_128, "128kbps")
            ]

        safe_filename = self.file_manager.sanitize_filename(
            f"{song_info.name} - {song_info.singers}"
        )

        # 获取凭证（使用最新凭证）
        credential = None
        vip_required = song_info.vip

        # 对于VIP歌曲，需要有效凭证
        if vip_required:
            credential = self.credential_manager.get_credential()
            if not credential:
                logger.warning(f"VIP歌曲 {song_info.name} 需要登录凭证，但未找到凭证")
                # VIP歌曲没有凭证，只能尝试128kbps
                quality_order = [(SongFileType.MP3_128, "128kbps")]
            else:
                # 检查凭证是否过期
                try:
                    is_expired = await check_expired(credential)
                    if is_expired:
                        logger.warning(f"VIP歌曲 {song_info.name} 的凭证已过期")
                        # 尝试刷新凭证
                        can_refresh = await credential.can_refresh()
                        if can_refresh:
                            logger.info(f"尝试刷新凭证...")
                            await credential.refresh()
                            # 保存刷新后的凭证
                            if self.credential_manager.save_credential(credential):
                                logger.info(f"凭证已刷新并保存")
                            else:
                                logger.warning(f"凭证刷新成功但保存失败")
                        else:
                            logger.warning(f"凭证不支持刷新，尝试使用匿名下载")
                            credential = None
                            quality_order = [(SongFileType.MP3_128, "128kbps")]
                except Exception as e:
                    logger.error(f"检查凭证状态失败: {e}")
                    credential = None
                    quality_order = [(SongFileType.MP3_128, "128kbps")]
        else:
            # 对于免费歌曲，尝试使用凭证但非必须
            credential = self.credential_manager.get_credential()
            if credential:
                try:
                    # 检查凭证是否过期
                    is_expired = await check_expired(credential)
                    if is_expired:
                        logger.info("免费歌曲：凭证已过期，尝试刷新...")
                        can_refresh = await credential.can_refresh()
                        if can_refresh:
                            await credential.refresh()
                            if self.credential_manager.save_credential(credential):
                                logger.info("凭证已刷新并保存")
                            else:
                                logger.warning("凭证刷新成功但保存失败")
                                # 使用过期的凭证继续尝试
                        else:
                            logger.info("凭证不支持刷新，继续使用过期凭证尝试")
                except Exception as e:
                    logger.error(f"检查免费歌曲凭证失败: {e}")
                    # 即使凭证检查失败，仍尝试使用凭证（可能仍然有效）

        logger.info(f"下载歌曲 '{song_info.name}'，VIP={vip_required}，使用凭证: {credential is not None}")

        # 尝试不同音质
        for file_type, quality_name in quality_order:
            filepath = Path(self.config["MUSIC_DIR"]) / f"{safe_filename}{file_type.e}"

            # 检查缓存
            if filepath.exists():
                return DownloadResult(
                    filename=f"{safe_filename}{file_type.e}",
                    quality=quality_name,
                    filepath=str(filepath),
                    cached=True,
                    used_credential=credential is not None
                )

            logger.info(f"尝试下载 {quality_name}: {safe_filename}{file_type.e}")

            # 获取歌曲URL并下载
            urls = await get_song_urls(
                [song_info.mid],
                file_type=file_type,
                credential=credential
            )
            url = urls.get(song_info.mid)

            if not url:
                logger.warning(f"未获取到 {quality_name} 的下载URL")
                continue

            if isinstance(url, list):
                url = url[0]

            content = await self.file_manager.download_file_content(url)
            if content:
                with open(filepath, "wb") as f:
                    f.write(content)

                logger.info(f"下载成功 ({quality_name}): {filepath.name}")
                result = DownloadResult(
                    filename=f"{safe_filename}{file_type.e}",
                    quality=quality_name,
                    filepath=str(filepath),
                    cached=False,
                    used_credential=credential is not None
                )

                # 添加元数据
                if add_metadata and not result.cached:
                    await self._add_metadata(result, song_info, file_type)

                return result

        return None

    async def _add_metadata(self, result: DownloadResult, song_info: SongInfo,
                            file_type: SongFileType):
        """为下载的文件添加元数据"""
        if file_type not in [SongFileType.FLAC, SongFileType.MP3_320, SongFileType.MP3_128]:
            return

        try:
            lyrics_data = None
            try:
                lyrics_data = await get_lyric(song_info.mid)
            except Exception as e:
                logger.warning(f"获取歌词失败: {e}")

            # 使用智能封面获取方法，传递完整的原始歌曲数据
            metadata_success = await self.metadata_manager.add_metadata_to_file(
                Path(result.filepath),
                song_info,
                lyrics_data,
                song_info.raw_data  # 传递完整的原始歌曲数据用于封面获取
            )
            result.metadata_added = metadata_success

        except Exception as e:
            logger.error(f"添加元数据失败: {e}")
            result.metadata_added = False