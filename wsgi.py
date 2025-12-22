import sys
import os

# 添加应用目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, init_app

app = create_app()
init_app(app)

if __name__ == "__main__":
    app.run()
