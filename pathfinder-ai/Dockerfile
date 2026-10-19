FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
# If you have requirements.lock.txt (from step 1), copy it next to this file and use it instead of requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
ENV DATA_DIR=/srv/data CACHE_DIR=/srv/cache REPORT_DIR=/srv/reports HF_HOME=/srv/hf
# data/ is mounted at run time (see README), models are downloaded from Hugging Face on first start and cached in HF_HOME
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
