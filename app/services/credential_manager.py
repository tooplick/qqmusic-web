import pickle
import logging
from pathlib import Path
from typing import Optional
from qqmusic_api.login import Credential, check_expired
from ..utils.thread_utils import run_async

logger = logging.getLogger("qqmusic_web")


class CredentialManager:
    """凭证管理器"""

    def __init__(self, config):
        self.config = config
        self.credential = None
        self.status = {
            "enabled": True,
            "last_check": None,
            "status": "未检测到凭证",
            "expired": True
        }

    def load_credential(self) -> Optional[Credential]:
        """加载凭证"""
        credential_file = Path(self.config["CREDENTIAL_FILE"])
        if not credential_file.exists():
            return None

        try:
            with credential_file.open("rb") as f:
                cred = pickle.load(f)
            self.credential = cred  # 更新内存中的凭证
            logger.info("凭证已加载到内存")
            return cred
        except Exception as e:
            logger.error(f"加载凭证文件失败: {e}")
            return None

    def save_credential(self, cred: Credential) -> bool:
        """保存凭证"""
        try:
            credential_file = Path(self.config["CREDENTIAL_FILE"])
            with credential_file.open("wb") as f:
                pickle.dump(cred, f)

            # 关键：保存后立即更新内存中的凭证
            self.credential = cred
            logger.info("凭证已保存并更新到内存")
            return True
        except Exception as e:
            logger.error(f"保存凭证文件失败: {e}")
            return False

    def get_credential(self) -> Optional[Credential]:
        """获取当前凭证（如果未加载则从文件加载）"""
        if self.credential is None:
            return self.load_credential()
        return self.credential

    def force_reload(self) -> Optional[Credential]:
        """强制重新加载凭证（用于刷新后更新内存）"""
        logger.info("强制重新加载凭证到内存")
        return self.load_credential()

    def refresh_credential_if_needed(self) -> Optional[Credential]:
        """如果需要则刷新凭证"""
        if not self.credential:
            return None

        try:
            # 检查是否过期
            is_expired = run_async(check_expired(self.credential))
            if not is_expired:
                return self.credential

            # 检查是否支持刷新
            can_refresh = run_async(self.credential.can_refresh())
            if not can_refresh:
                logger.warning("凭证已过期且不支持刷新")
                return None

            # 刷新凭证
            logger.info("开始刷新过期凭证...")
            run_async(self.credential.refresh())

            # 保存刷新后的凭证
            if self.save_credential(self.credential):
                logger.info("凭证已刷新并保存")
                return self.credential
            else:
                logger.error("凭证刷新成功但保存失败")
                return None

        except Exception as e:
            logger.error(f"刷新凭证失败: {e}")
            return None

    def load_and_refresh_sync(self) -> Optional[Credential]:
        """同步加载和刷新凭证"""
        credential_file = Path(self.config["CREDENTIAL_FILE"])
        if not credential_file.exists():
            logger.info("本地无凭证文件，仅能下载免费歌曲")
            self.status.update({
                "status": "本地无凭证文件，仅能下载免费歌曲",
                "expired": True
            })
            return None

        cred = self.load_credential()
        if not cred:
            self.status.update({
                "status": "加载凭证失败，仅能下载免费歌曲",
                "expired": True
            })
            return None

        try:
            # 检查是否过期
            is_expired = run_async(check_expired(cred))

            if is_expired:
                logger.info("本地凭证已过期，将以未登录方式下载")
                self.status.update({
                    "status": "本地凭证已过期，将以未登录方式下载",
                    "expired": True
                })
                return None
            else:
                logger.info("使用本地凭证登录成功!")
                self.status.update({
                    "status": "使用本地凭证登录成功!",
                    "expired": False
                })
                self.credential = cred
                return cred

        except Exception as e:
            logger.error(f"处理凭证时出错: {e}")
            self.status.update({
                "status": f"处理凭证时出错: {e}，将以未登录方式下载",
                "expired": True
            })
            return None