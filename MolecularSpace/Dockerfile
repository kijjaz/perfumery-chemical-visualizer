FROM python:3.12-alpine
WORKDIR /app
COPY . .
CMD python -m http.server ${PORT:-8080}
