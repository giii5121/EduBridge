FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AI_HOST=0.0.0.0 AI_PORT=8000 NODE_ENV=production AI_DATA_DIR=/data
WORKDIR /app/server/ml
COPY server/ml/requirements-runtime.lock ./requirements-runtime.lock
RUN pip install --no-cache-dir -r requirements-runtime.lock
COPY server/ml/cdacdm ./cdacdm
COPY server/ml/web ./web
COPY server/ml/configs ./configs
COPY server/ml/instruments ./instruments
COPY server/ml/artifacts/model ./artifacts/model
COPY server/ml/artifacts_calculus/model ./artifacts_calculus/model
COPY server/ml/artifacts_edubridge ./artifacts_edubridge
RUN useradd --uid 10001 --create-home inference && mkdir /data && chown inference:inference /data
USER inference
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready',timeout=4)"
CMD ["python", "-m", "web.run"]
