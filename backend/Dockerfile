FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PRISMA_BINARY_CACHE_DIR=/app/.cache/prisma-python \
    XDG_CACHE_HOME=/app/.cache

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY backend/ /app/
RUN mkdir -p /app/.cache/prisma-python
RUN python -m prisma generate --schema /app/prisma/schema.prisma

RUN groupadd --system gigi && useradd --system --gid gigi gigi \
    && chown -R gigi:gigi /app

USER gigi

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
