# Nex + Kaggle: бесплатная Ollama на видеокарте

Вставь каждую ячейку в Kaggle Notebook по очереди.

## Ячейка 1 — установка
```python
!curl -fsSL https://ollama.com/install.sh | sh
!wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O cloudflared && chmod +x cloudflared
```

## Ячейка 2 — запуск и модель
```python
import os, subprocess, time
subprocess.Popen(['ollama', 'serve'], env={**os.environ, 'OLLAMA_HOST': '0.0.0.0', 'OLLAMA_KEEP_ALIVE': '-1'})
time.sleep(5)
!ollama pull qwen2.5:14b
```

## Ячейка 3 — адрес для Nex
```python
import re
p = subprocess.Popen(['./cloudflared', 'tunnel', '--url', 'http://localhost:11434', '--http-host-header', 'localhost:11434'], stderr=subprocess.PIPE, text=True)
for line in p.stderr:
    m = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', line)
    if m:
        print('\n\n=====  АДРЕС ДЛЯ NEX:', m.group(0), ' =====\n\n')
        break
while True:
    time.sleep(60)
```
