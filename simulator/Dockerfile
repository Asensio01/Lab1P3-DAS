# 1. Usar una imagen oficial de Python ligera basada en Alpine Linux
FROM python:3.11-alpine

# 2. Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# 3. Instalar dependencias del sistema necesarias para compilar ciertos paquetes de Python (si aplica)
# Alpine es minimalista, por lo que gcc y musl-dev aseguran que librerías como httpx o pydantic no tengan problemas
RUN apk add --no-cache gcc musl-dev libffi-dev

# 4. Copiar primero el archivo de requerimientos para aprovechar la caché de capas de Docker
COPY requirements.txt .

# 5. Instalar las dependencias de Python sin guardar la caché local para ahorrar espacio
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copiar todo el contenido de la carpeta local 'simulator' al contenedor
COPY . .

# 7. Exponer el puerto interno en el que correrá el simulador (según tu docker-compose)
EXPOSE 8001

# 8. Comando para arrancar la aplicación usando Uvicorn
# Apuntamos a 'app.main:app' porque la carpeta contenedora es 'app', el archivo es 'main.py' y la instancia es 'app'
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]