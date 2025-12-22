import asyncio
from concurrent.futures import ThreadPoolExecutor

# 线程池用于执行阻塞操作
thread_pool = ThreadPoolExecutor(max_workers=4)

def run_async(coro):
    """运行异步函数"""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # 如果没有运行中的循环，创建一个新的
        return asyncio.run(coro)
    else:
        # 如果已有运行中的循环（例如在Flask异步上下文中），使用run_coroutine_threadsafe
        # 注意：这通常用于在非异步线程中提交给异步线程，或者在异步上下文中
        # 如果直接在该循环中等待，应该使用 await，但这里是同步函数封装
        # 对于 Flask 这种同步路由混用情况，通常建议使用 asyncio.run 或 new_event_loop
        # 但考虑到 ThreadPoolExecutor 的使用，我们需要确保线程安全
        
        # 简单场景下，如果是在主线程loop中调用，会抛出 RuntimeError: This event loop is already running
        # 所以这里我们假设是在 worker 线程中
        future = asyncio.run_coroutine_threadsafe(coro, loop)
        return future.result()