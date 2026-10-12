# rIAcardo — Análisis de Rendimiento Deportivo

Plataforma de análisis de rendimiento para ciclismo y running con coach IA (Groq).

## Instalación Rápida

### Prerrequisitos

- Python 3.11+
- Node.js 20+
- Docker y Docker Compose
- PostgreSQL 16+ (o usar Docker)

### Pasos

1. **Clonar el repositorio**:
   ```bash
   git clone <repo-url>
   cd rIAcardo
   ```

2. **Configurar el entorno virtual Python**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
   Para desarrollo (tests):
   ```bash
   pip install -r requirements-dev.txt
   ```

3. **Levantar la base de datos**:
   ```bash
   docker compose up -d db
   ```
   Crea PostgreSQL en `localhost:5432` con la base de datos `riacardo`
   (valores por defecto; se pueden cambiar en `.env`).

4. **Inicializar el esquema de la BD**:
   ```bash
   psql -h localhost -p 5432 -U postgres -d riacardo -f db/schema.sql
   ```

5. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` y rellena:
   - `POSTGRES_*`: conexión a la BD
   - `ENCRYPTION_KEY`: genera con `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - `JWT_SECRET_KEY`: genera con `openssl rand -hex 32`
   - `GROQ_API_KEY`: obtén una en [Groq Cloud](https://console.groq.com/)
   - `ALLOWED_ORIGINS`: opcional, para CORS en red local

6. **Instalar dependencias del frontend**:
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

7. **Arrancar la aplicación**:
   - **Modo desarrollo** (backend + frontend separados):
     ```bash
     ./run_network.sh
     ```
   - **Modo producción** (FastAPI sirve el frontend compilado):
     ```bash
     cd frontend && npm run build && cd ..
     ./run_service.sh
     ```

La app estará disponible en `http://localhost:9000` (prod) o `http://localhost:5173` (dev frontend).

---

## Despliegue

Para desplegar de forma persistente (por ejemplo en un servidor o un mac mini
con Tailscale) consulta **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Configuración de Google Calendar (opcional)

Si quieres que rIAcardo sincronice los entrenamientos planificados con Google Calendar, necesitas crear tu propia **Service Account** de Google.

### Pasos

1. **Crear proyecto en Google Cloud Console**:
   - Ve a [Google Cloud Console](https://console.cloud.google.com/)
   - Crea un nuevo proyecto (ej. `riacardo-calendar`)

2. **Habilitar Google Calendar API**:
   - APIs y Servicios → Biblioteca
   - Busca "Google Calendar API" y habilita

3. **Crear Service Account**:
   - IAM y Administración → Cuentas de servicio → Crear
   - Dale un nombre (ej. `riacardo-bot`)
   - Anota el email generado: `xxx@yyy.iam.gserviceaccount.com`

4. **Generar clave JSON**:
   - En la cuenta de servicio creada → pestaña "Claves" → Añadir clave → JSON
   - Se descargará un fichero `riacardo-bot-xxx.json`
   - **NO subas este fichero al repositorio** (ya está en `.gitignore`)
   - Guárdalo como `google_service_account.json` en la raíz del proyecto

5. **Compartir tu calendario con la Service Account**:
   - Abre Google Calendar en tu navegador
   - Ajustes del calendario → "Compartir con personas específicas"
   - Añade el email de la service account (`xxx@yyy.iam.gserviceaccount.com`)
   - Permisos: "Hacer cambios y gestionar la compartición"

6. **Insertar la service account en la BD**:
   ```bash
   psql -h localhost -p 5432 -U postgres -d riacardo -c \
     "INSERT INTO public.app_config (config_key, config_value)
      VALUES ('google_service_account_json', '$(cat google_service_account.json)');"
   ```

7. **Conectar calendario en la app**:
   - En rIAcardo, ve a Ajustes → Google Calendar
   - Introduce el `calendar_id` de tu calendario (lo encuentras en los ajustes del calendario en Google Calendar)
   - El `calendar_id` se guarda en `users.google_calendar_id`

---

## Flujo de Datos

1.  **Ingesta de Datos**: Los datos de las actividades se extraen de ficheros `.fit` (Garmin Connect) y se almacenan en una base de datos PostgreSQL.
2.  **Análisis de Rendimiento**: El sistema calcula métricas de rendimiento (NP, TSS, CTL, ATL, TSB, MMP, W', etc.) y genera análisis con IA (Groq).
3.  **Visualización**: Los resultados se presentan en un dashboard interactivo (React + Chart.js) con gráficos de rendimiento, calendario de entrenamientos y coach IA.

## Cálculos de Rendimiento y Algoritmos

A continuación, se detalla cómo se calculan las principales métricas de rendimiento.

### 1. Potencia Normalizada (Normalized Power - NP)

La Potencia Normalizada es una estimación de la potencia que un ciclista podría haber mantenido para el mismo costo fisiológico si su producción de potencia hubiera sido perfectamente constante. Proporciona una mejor medida del verdadero esfuerzo de un entrenamiento que la potencia media.

**Algoritmo:**
1.  Se calcula una media móvil de 30 segundos de los datos de potencia de la actividad.
2.  Se elevan a la cuarta potencia los valores de esta media móvil.
3.  Se calcula la media de los valores obtenidos en el paso anterior.
4.  La Potencia Normalizada es la raíz cuarta de esta media.

```python
def calculate_normalized_power(power_data, interval_seconds=30):
    rolling_avg_power = power_data.fillna(0).rolling(window=interval_seconds, min_periods=1).mean()
    rolling_avg_power_4th = rolling_avg_power**4
    mean_4th_power = rolling_avg_power_4th.mean()
    np_val = mean_4th_power**(1/4)
    return np_val
```

### 2. Puntuación de Estrés de Entrenamiento (Training Stress Score - TSS)

El TSS es una métrica que cuantifica la carga de entrenamiento de una actividad. Tiene en cuenta tanto la duración como la intensidad de la sesión.

**Algoritmo:**
El TSS se calcula utilizando la Potencia Normalizada (NP), el Factor de Intensidad (IF - Intensity Factor) y la duración de la actividad. El IF es simplemente la relación entre la NP y el Umbral de Potencia Funcional (FTP) del atleta.

-   `IF = NP / FTP`
-   `TSS = (Duración_segundos * NP * IF) / (FTP * 3600) * 100`

La fórmula simplificada que se usa en el código es:

```python
def calculate_tss(activity_duration_seconds, np_watts, ftp_watts):
    if_val = np_watts / ftp_watts
    tss = (activity_duration_seconds * (if_val**2)) / 3600 * 100
    return tss
```

### 3. Métricas de Carga de Entrenamiento (CTL, ATL, TSB)

Estas métricas, popularizadas por TrainingPeaks, ayudan a gestionar la carga de entrenamiento a lo largo del tiempo.

-   **CTL (Chronic Training Load - Carga de Entrenamiento Crónica)**: Representa el "fitness" o estado de forma del atleta. Es una media móvil exponencial de los valores de TSS diarios durante los últimos 42 días. Un CTL en aumento indica una mayor carga de entrenamiento y, por lo tanto, una mejora de la forma física.

-   **ATL (Acute Training Load - Carga de Entrenamiento Aguda)**: Representa la "fatiga" del atleta. Es una media móvil exponencial de los valores de TSS diarios durante los últimos 7 días. Un ATL en aumento indica una acumulación de fatiga.

-   **TSB (Training Stress Balance - Equilibrio de la Carga de Entrenamiento)**: Representa la "forma" o "frescura" del atleta. Se calcula como la diferencia entre el CTL y el ATL (`TSB = CTL - ATL`).
    -   Un TSB positivo sugiere que el atleta está descansado y en buena forma para competir.
    -   Un TSB negativo indica que el atleta está fatigado y puede necesitar descanso.

**Algoritmo:**
Las métricas se calculan iterativamente para cada día, utilizando las constantes de tiempo (TC) de 42 días para el CTL y 7 días para el ATL.

```python
def calculate_ctl_atl_tsb(daily_tss):
    CTL_TC = 42
    ATL_TC = 7
    current_ctl = 0
    current_atl = 0

    for date, tss in daily_tss.items():
        current_ctl = current_ctl + (tss - current_ctl) / CTL_TC
        current_atl = current_atl + (tss - current_atl) / ATL_TC
        tsb = current_ctl - current_atl
        # ... se almacenan los valores para cada día
```

### 4. Deriva Cardíaca (Cardiac Drift)

La deriva cardíaca mide la disminución de la eficiencia a medida que avanza una actividad, generalmente debido a la fatiga, la deshidratación o el calor. Se manifiesta como un aumento de la frecuencia cardíaca para mantener una misma potencia, o una disminución de la potencia para una misma frecuencia cardíaca.

**Algoritmo:**
Se calcula para actividades de más de 90 minutos.
1.  Se calcula la relación entre la potencia y la frecuencia cardíaca (`Potencia / FC`) para cada punto de datos de la actividad.
2.  La actividad se divide en dos mitades (por tiempo).
3.  Se calcula la media de esta relación para la primera mitad y para la segunda mitad.
4.  La deriva cardíaca es la caída porcentual de esta relación de la primera a la segunda mitad.

```python
def calculate_cardiac_drift(df_activity_records, total_elapsed_time):
    df_clean['power_hr_ratio'] = df_clean['power'] / df_clean['heart_rate']

    # ... división en dos mitades ...

    avg_power_hr_ratio_1st_half = first_half_records['power_hr_ratio'].mean()
    avg_power_hr_ratio_2nd_half = second_half_records['power_hr_ratio'].mean()

    cardiac_drift = ((avg_power_hr_ratio_1st_half - avg_power_hr_ratio_2nd_half) / avg_power_hr_ratio_1st_half) * 100
    return cardiac_drift
```
Un valor bajo (cercano a 0 o negativo) indica una buena eficiencia aeróbica, mientras que un valor alto (típicamente > 5-10%) puede indicar una falta de base aeróbica, fatiga o una mala gestión de la nutrición/hidratación.

### 5. Cálculo de Zonas de Potencia (Coggan Zones)

Las zonas de potencia se calculan como porcentajes fijos del Umbral de Potencia Funcional (FTP) del atleta. Este proyecto utiliza el modelo estándar de 7 zonas propuesto por Andrew Coggan.

| Zona | Nombre | Rango (% del FTP) |
| :--- | :--- | :--- |
| **Z1** | Recuperación Activa | < 55% |
| **Z2** | Resistencia (Endurance) | 56% - 75% |
| **Z3** | Tempo | 76% - 90% |
| **Z4** | Umbral Lactato (Threshold) | 91% - 105% |
| **Z5** | VO2 Máx | 106% - 120% |
| **Z6** | Capacidad Anaeróbica | 121% - 150% |
| **Z7** | Potencia Neuromuscular | > 150% |

**Algoritmo:**
```python
def calculate_power_zones(ftp):
    return {
        "Z1": [0, int(ftp * 0.55)],
        "Z2": [int(ftp * 0.56), int(ftp * 0.75)],
        "Z3": [int(ftp * 0.76), int(ftp * 0.90)],
        "Z4": [int(ftp * 0.91), int(ftp * 1.05)],
        "Z5": [int(ftp * 1.06), int(ftp * 1.20)],
        "Z6": [int(ftp * 1.21), int(ftp * 1.50)],
        "Z7": [int(ftp * 1.51), 9999]
    }
```

### 6. Cálculo de Zonas de Frecuencia Cardíaca (Friel Zones)

Las zonas de frecuencia cardíaca se calculan como porcentajes del Umbral de Frecuencia Cardíaca de Lactato (LTHR) utilizando la metodología de Joe Friel.

| Zona | Nombre | Rango (% del LTHR) |
| :--- | :--- | :--- |
| **Z1** | Recuperación | < 85% |
| **Z2** | Resistencia (Base) | 85% - 89% |
| **Z3** | Tempo | 90% - 94% |
| **Z4** | Umbral (Threshold) | 95% - 100% |
| **Z5** | Capacidad Aeróbica (VO2 Máx) | > 100% |

**Algoritmo:**
```python
def calculate_hr_zones(lthr):
    return {
        "Z1": [0, int(lthr * 0.84)],
        "Z2": [int(lthr * 0.85), int(lthr * 0.89)],
        "Z3": [int(lthr * 0.90), int(lthr * 0.94)],
        "Z4": [int(lthr * 0.95), int(lthr * 1.00)],
        "Z5": [int(lthr * 1.01), 250]
    }
```

### 7. Detección Automática de Mejoras de Umbral

El sistema analiza cada actividad en busca de rendimientos que sugieran una mejora en los umbrales configurados del atleta (FTP, LTHR y Ritmo Umbral).

**Algoritmo de Detección:**
1.  **FTP (Ciclismo):** Se busca el bloque de 20 minutos de mayor potencia media.
    *   `Sugerencia = Mejor Potencia 20 min * 0.95`
2.  **LTHR (Frecuencia Cardíaca):** Se busca el bloque de 20 minutos de mayor frecuencia cardíaca media.
    *   `Sugerencia = Mejor Pulso Medio 20 min`
3.  **Ritmo Umbral (Carrera):** Se busca el bloque de 20 minutos de mayor velocidad media.
    *   `Sugerencia = Mejor Velocidad 20 min`

**Implementación Técnica:**
El sistema utiliza una ventana deslizante (`rolling window`) de 1200 segundos (20 minutos) sobre los registros de la actividad:
```python
def calculate_best_intervals(series, window_seconds):
    return series.rolling(window=window_seconds).mean().max()
```
Si el valor calculado (tras aplicar el factor de corrección del 0.95 en el caso del FTP) es superior al valor actual en las preferencias del usuario, se dispara una notificación en la interfaz.

### 8. Distribución de Zonas (Frecuencia Cardíaca y Potencia)

El análisis de tiempo en zonas permite evaluar si el entrenamiento se alinea con los objetivos (ej. entrenamiento de base en Z2, series de intensidad en Z4/Z5).

**Algoritmo:**
1.  Se definen las zonas de Frecuencia Cardíaca y Potencia del usuario con sus límites superiores.
2.  Para cada punto de datos de la actividad (registrado cada segundo), se clasifica en una zona comparando el valor de FC o potencia con los límites definidos.
3.  Se suma el tiempo total (en segundos/minutos) pasado en cada zona a lo largo de todo el período de análisis.

### 9. Curva de Potencia (Mean Maximal Power - MMP)

La curva MMP representa los mejores valores de potencia media que el atleta ha sido capaz de sostener para diferentes duraciones (desde 1 segundo hasta varias horas).

**Algoritmo:**
1.  Se definen duraciones clave (1s, 5s, 1m, 5m, 20m, 60m, etc.).
2.  Para cada actividad, se calcula el máximo de la media móvil (`rolling mean`) para cada duración.
3.  Se mantiene un registro histórico de estos máximos en la base de datos (`mmp_data`).
4.  La visualización compara la curva del periodo actual con los récords históricos (All-time).

### 10. Eficiencia Aeróbica (Efficiency Factor - EF)

El EF mide la relación entre el trabajo realizado (Potencia Normalizada) y el coste fisiológico (Frecuencia Cardíaca Media). Es la métrica clave para monitorizar el desarrollo de la base aeróbica.

**Algoritmo:**
-   `EF = Potencia Normalizada (NP) / Frecuencia Cardíaca Media`
-   Para que el análisis sea válido, se filtran actividades de ciclismo de más de 60 minutos con datos estables de pulso y potencia.
-   Un EF al alza indica que el atleta está produciendo más potencia por cada latido del corazón (mejor economía).

### 11. Índice de Variabilidad (Variability Index - VI)

El VI indica cómo de constante o "estocástico" ha sido el esfuerzo de una actividad.

**Algoritmo:**
-   `VI = Potencia Normalizada (NP) / Potencia Media`
-   Un valor cercano a 1.0 (ej. 1.02-1.05) indica un esfuerzo muy constante (como una contrarreloj o rodillo).
-   Valores altos (> 1.15) indican esfuerzos con muchos cambios de ritmo (series, carreras con ataques, terreno muy quebrado).

### 12. Capacidad Anaeróbica (W-Prime - W')

W' representa la cantidad de energía (en Julios) que un atleta puede gastar por encima de su FTP antes de llegar al agotamiento total. Se visualiza como una "batería anaeróbica".

**Algoritmo:**
-   **Estimación:** Se calcula analizando la curva de potencia histórica (MMP), comparando los récords de corta duración (1-5 min) con el FTP actual.
-   **Balance (W-bal):** Utiliza el **modelo de Skiba (2012)** para calcular el estado de la batería segundo a segundo:
    -   **Gasto:** Cuando la potencia > FTP, la batería se agota linealmente.
    -   **Recuperación:** Cuando la potencia < FTP, la batería se recarga de forma exponencial (la recarga es más lenta cuanto más cerca del FTP se esté).
-   **Interpretación:** Una batería al 0% indica agotamiento fisiológico inminente. Es útil para analizar ataques en carrera o la capacidad de repetir esfuerzos en series de alta intensidad.

### 13. Volumen de Entrenamiento

Se calcula el volumen total de entrenamiento agregando las siguientes métricas por semana y por mes:
-   **Distancia total** (en km)
-   **Tiempo total** (en horas)
-   **Desnivel positivo total** (en metros)

## Visualización de Gráficos

Los cálculos anteriores se visualizan mediante los siguientes gráficos generados con **Chart.js** para interactividad:

-   **TSS Semanal**: Gráfico de barras.
-   **Tendencias de Carga (CTL, ATL, TSB)**: Gráfico de líneas.
-   **Distribución de Zonas de FC y Potencia**: Gráficos de tarta.
-   **Volumen Semanal y Mensual**: Gráficos de barras que muestran la distancia y ofrecen detalles del tiempo y desnivel al pasar el ratón por encima.
-   **Curva de Potencia (MMP)**: Gráfico de líneas en escala logarítmica comparando el periodo actual con los récords históricos.
-   **Evolución de Eficiencia (EF)**: Gráfico de dispersión con línea de tendencia que muestra la mejora de la economía aeróbica.
-   **Gráfico de Rendimiento de Actividad**: Series temporales de potencia, pulso y cadencia sobre el eje de distancia (km), incluyendo la línea de **Balance de W'** (batería anaeróbica).

## Glosario de Términos

A continuación se definen los términos y siglas clave utilizados en la plataforma:

*   **FTP (Functional Threshold Power):** Potencia Umbral Funcional. Es la máxima potencia media que un ciclista puede mantener, en teoría, durante una hora de esfuerzo constante. Es el valor de referencia para calcular las zonas de potencia.
*   **LTHR (Lactate Threshold Heart Rate):** Frecuencia Cardíaca en el Umbral de Lactato. Es el pulso medio mantenido durante un esfuerzo máximo de unos 20-30 minutos. Define el límite entre el metabolismo aeróbico y anaeróbico.
*   **NP (Normalized Power):** Potencia Normalizada. Una estimación de la potencia que se podría haber mantenido si el esfuerzo hubiera sido constante, compensando los cambios de ritmo y terreno mediante un algoritmo matemático.
*   **IF (Intensity Factor):** Factor de Intensidad. Es la relación entre la Potencia Normalizada y el FTP (`IF = NP / FTP`). Indica cómo de dura ha sido una sesión respecto a la capacidad actual del atleta.
*   **TSS (Training Stress Score):** Puntuación de Estrés de Entrenamiento. Una métrica que cuantifica la carga total de una sesión combinando intensidad (IF) y duración.
*   **CTL (Chronic Training Load):** Carga de Entrenamiento Crónica. Representa la "Condición Física" o *Fitness*. Es una media de la carga acumulada en los últimos 42 días.
*   **ATL (Acute Training Load):** Carga de Entrenamiento Aguda. Representa la "Fatiga" a corto plazo. Es una media de la carga de los últimos 7 días.
*   **TSB (Training Stress Balance):** Equilibrio de la Carga. Representa la "Forma" o "Frescura". Se calcula como `CTL - ATL`. Un valor positivo indica descanso; uno muy negativo indica fatiga profunda.
*   **EF (Efficiency Factor):** Factor de Eficiencia. Ratio entre la NP y el Pulso Medio. Mide la economía aeróbica.
*   **VI (Variability Index):** Índice de Variabilidad. Ratio entre NP y Potencia Media. Mide la irregularidad del esfuerzo.
*   **W' (W-Prime):** Capacidad Anaeróbica. Cantidad de energía disponible para esfuerzos por encima del FTP (medida en Julios).
*   **VAM (Velocidad de Ascensión Media):** Metros verticales subidos por hora.
*   **Cardiac Drift:** Deriva Cardíaca. El aumento del pulso a lo largo del tiempo manteniendo una potencia constante, indicativo de fatiga cardiovascular o deshidratación.
*   **MMP (Mean Maximal Power):** Potencia Media Máxima. El valor máximo de potencia que has sido capaz de sostener para una duración determinada (ej: MMP 20 min).

## Referencias Bibliográficas

Los algoritmos y métricas utilizados en este proyecto se basan en conceptos bien establecidos en la ciencia del deporte y el entrenamiento de resistencia. Las principales referencias son:

-   **Allen, H., & Coggan, A. (2010). *Training and Racing with a Power Meter*. VeloPress.**
    -   Este libro es la referencia fundamental para el entrenamiento basado en potencia. Explica en detalle los conceptos de Potencia Normalizada (NP), Factor de Intensidad (IF) y Puntuación de Estrés de Entrenamiento (TSS). El Dr. Andrew Coggan es el creador de estas métricas.

-   **Friel, J. (2016). *The Cyclist's Training Bible*. VeloPress.**
    -   Joe Friel es un reconocido entrenador que ha popularizado muchos de los conceptos de planificación y periodización del entrenamiento. Su libro explica cómo utilizar las métricas de carga (CTL, ATL, TSB) para guiar el entrenamiento y alcanzar el pico de forma en el momento adecuado.

-   **Skiba, P. (2012). *Scientific Training for Endurance Athletes*.**
    -   Este libro profundiza en los modelos matemáticos del rendimiento humano, incluyendo el modelo de impulso-respuesta en el que se basan las métricas de CTL, ATL y TSB (originalmente propuesto por el Dr. E. W. Banister).

-   **Coyle, E. F. (1995). "Cardiovascular drift during prolonged exercise and the effects of dehydration." *International Journal of Sports Medicine*.**
    -   Este y otros trabajos del Dr. Coyle son fundamentales para entender el concepto de deriva cardíaca y su relación con la deshidratación, el aumento de la temperatura corporal y la eficiencia cardiovascular durante el ejercicio prolongado.

---

## Licencia

© 2026 Pablo Sanxiao. Licenciado bajo [GNU AGPL-3.0](LICENSE).
