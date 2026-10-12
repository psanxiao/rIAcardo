#!/bin/bash

# 1. Detectar la IP local de la máquina (macOS)
LOCAL_IP=$(ipconfig getifaddr en0)

if [ -z "$LOCAL_IP" ]; then
    # Intento alternativo si en0 no es la interfaz activa
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
fi

echo "------------------------------------------------"
echo "🚀 Arrancando rIAcardo para acceso en RED"
echo "📍 Tu IP local es: $LOCAL_IP"
echo "------------------------------------------------"

# 2. No fijamos VITE_API_URL para que api.js use window.location.hostname
#    automáticamente (funciona tanto en local como desde otros equipos vía Tailscale)

# 3. Función para limpiar procesos al salir (Ctrl+C)
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

trap cleanup SIGINT

# 4. Arrancar Backend (FastAPI)
echo "📡 Arrancando Backend..."
export $(grep -v '^#' .env | xargs)
./venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 9000 --reload &
BACKEND_PID=$!

# 5. Arrancar Frontend (Vite)
echo "💻 Arrancando Frontend..."
cd frontend
# Usamos --host para que Vite escuche en la red local
npm run dev -- --host 0.0.0.0 > /dev/null 2>&1 &
FRONTEND_PID=$!

echo ""
echo "✅ ¡Todo listo!"
echo "📱 Accede desde cualquier dispositivo de tu casa a:"
echo "👉 http://$LOCAL_IP:5173"
echo ""
echo "Presiona Ctrl+C para detener ambos servidores."

# Mantener el script vivo
wait
