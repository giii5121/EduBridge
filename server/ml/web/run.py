from pathlib import Path
import os
from dotenv import load_dotenv
import uvicorn

if __name__ == '__main__':
    load_dotenv(Path(__file__).resolve().parents[2] / '.env', override=False)
    uvicorn.run('web.main:app', host=os.getenv('AI_HOST', '127.0.0.1'), port=int(os.getenv('AI_PORT', '8000')),
                proxy_headers=False, log_level=os.getenv('LOG_LEVEL', 'info'), limit_concurrency=32,
                timeout_keep_alive=5, timeout_graceful_shutdown=25)
