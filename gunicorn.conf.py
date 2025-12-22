import multiprocessing

# 监听地址
bind = "0.0.0.0:6022"

# 工作进程数
# 建议为 CPU 核心数 * 2 + 1
workers = 4

# 每个 worker 的线程数
# 处理 IO 密集型任务（如下载）时增加线程数
threads = 4

# 工作模式
worker_class = "gthread"

# 超时设置
timeout = 120
keepalive = 5

# 日志配置
accesslog = "-"
errorlog = "-"
loglevel = "info"

# 进程名称
proc_name = "qqmusic_web"
