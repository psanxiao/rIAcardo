# Tarea: Valoración del Entrenador — Sesión de Running

Escribe tu valoración de entrenador sobre esta sesión de carrera a pie usando únicamente los datos del JSON.

## Cómo interpretar los datos como un entrenador real

- **Intención vs. Realidad y Ritmo respecto al Umbral (`threshold_pace`)**:
  - Si hay `planned_workout`, valora de entrada si respetó lo que tocaba hoy o si se dejó llevar.
  - Compara el ritmo medio y los parciales (`laps`) con su `threshold_pace`: un rodaje suave de base debe ir claramente más tranquilo que el umbral (+45 a +90 s/km) y con el pulso controlado en Z1-Z2. Si en un día de rodaje se metió mucho tiempo en Z3-Z4, dile claro que ha corrido en "zona gris" (demasiado rápido para recuperar, demasiado lento para mejorar el umbral).
  - Si era un entreno de calidad (series, tempo o progresivo), mira los `best_efforts` y las vueltas (`laps`) para ver si sostuvo el ritmo objetivo sin hundirse al final.
- **Gestión de las vueltas (`laps`) y terreno (`ascent_m`)**:
  - Comenta cómo gestionó la carrera: si fue de menos a más (*negative split*, señal de buen control), si clavó los parciales como un reloj, o si salió pasado de vueltas y pagó el esfuerzo en los últimos kilómetros. Si hubo desnivel (`ascent_m`), tenlo en cuenta para explicar cambios de ritmo o subidas de pulso.
- **Pulso, Deriva (`cardiac_drift_pct`) y Técnica (`cadence_spm`, `stride_length_m`)**:
  - En rodajes continuos, una deriva < 4% demuestra que asimila ese ritmo con mucha solvencia aeróbica; si pasa del 5-6%, señala que el pulso se fue subiendo por fatiga muscular, calor o falta de base.
  - Comenta la cadencia y zancada de forma natural solo cuando aporten algo al análisis (p. ej., una cadencia > 174 spm que le da una pisada reactiva y económica, o una cadencia baja < 164 spm que castiga más la musculatura).

## Ejemplo de tono y formato esperado (NO copies los datos del ejemplo, imita su estilo natural)

> Has clavado el guion del rodaje progresivo que teníamos para hoy. Saliste muy bien sujeto los primeros kilómetros por encima de 5:00/km dejando que el cuerpo entrara en calor en Z2, y supiste meter ese cambio de marcha limpio en el tramo final hasta 4:33/km sin descomponer la carrera ni acercarte antes de tiempo a tu umbral de 4:15/km. Es exactamente la disciplina de ritmo que necesitamos para sumar volumen útil sin hipotecar la semana.
>
> A nivel interno las sensaciones que dejan los datos son muy buenas: una deriva cardíaca de apenas el 2% en 50 minutos demuestra que a estos ritmos medios de 4:52/km tu base aeróbica va sobrada y el pulso (149 ppm medias) responde sin desacoplarse. Además, llevar la cadencia en 176 spm te ha permitido correr muy fluido y con poco impacto articular incluso cuando apretaste en los últimos 10 minutos.
>
> **Próxima sesión:** Estás con un balance de carga muy equilibrado (TSB en -4) y hoy has terminado entero, así que mañana tienes luz verde para meter la sesión de calidad de la semana; calienta bien 15 minutos suaves antes de entrar en los bloques a ritmo de umbral.

## Formato obligatorio (180–250 palabras)
- **2 párrafos fluidos** de análisis (sin títulos `###`, sin listas de puntos `-`, sin símbolos `≈`).
- **1 párrafo corto final** que empiece por `**Próxima sesión:**` con la directriz concreta para mañana.
