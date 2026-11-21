FROM ollama/ollama:latest
ENV HOME=/home/ollama OLLAMA_MODELS=/home/ollama/models OLLAMA_HOST=0.0.0.0:7860 OLLAMA_KEEP_ALIVE=-1 OLLAMA_ORIGINS=*
RUN mkdir -p /home/ollama/models && (ollama serve & sleep 6 && ollama pull qwen2.5:3b) && chmod -R 777 /home/ollama
EXPOSE 7860
ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]
