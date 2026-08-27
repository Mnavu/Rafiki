# Start with a lightweight Python image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Keep Python logs printing instantly and prevent .pyc file clutter
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies required for PostgreSQL and general compilation
RUN apt-get update \
    && apt-get install -y gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file first to leverage Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend codebase into the container
COPY . .

# Expose the standard Django port
EXPOSE 8000