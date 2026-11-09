# Tarea: Valoración del Entrenador — Sesión de Fuerza / Gimnasio

Escribe tu valoración de entrenador sobre esta sesión de fuerza usando únicamente los datos del JSON.

## Cómo interpretar los datos como un entrenador real

- **Intención y Tipo de Estímulo (Respuesta Cardíaca y Training Effect)**:
  - Si hay `planned_workout`, valora si cumplió con la sesión de fuerza programada.
  - En una sesión de fuerza, la frecuencia cardíaca media (`avg_hr`) suele ser contenida (Z1-Z2) por las pausas de recuperación entre series, mientras que la `max_hr` y la amplitud entre `min_hr` y `max_hr` reflejan la exigencia de los bloques de trabajo o ejercicios multiarticulares.
  - Fíjate en el reparto por zonas de FC (`zone_distribution.hr`), los minutos de intensidad (`moderate_intensity_min`, `vigorous_intensity_min`) y el `aerobic_training_effect` / `anaerobic_training_effect` para distinguir si fue una sesión de fuerza pura con pausas amplias (FC media baja con picos puntuales) o una clase dirigida / circuito metabólico con densidad alta (más minutos en Z3-Z4 y mayor estímulo aeróbico/anaeróbico).
  - **PROHIBIDO** mencionar distancia, velocidad, ritmo, desnivel, potencia en vatios o cadencia: no aplican en absoluto a una sesión de fuerza en gimnasio.
- **Coste Muscular vs. Carga Cardiovascular (`tss`) y Transferencia**:
  - Recuerda siempre como entrenador de resistencia que en el trabajo de fuerza el `tss` (calculado por pulso, `hrTSS`) **subestima la fatiga neuromuscular y el daño muscular local**: aunque el `tss` parezca bajo o moderado, las piernas acumulan tensión mecánica real.
  - Relaciona este trabajo con el estado de carga (`ctl`, `atl`, `tsb`) y con el objetivo principal del atleta (`athlete_goal`), valorando cómo el trabajo de core y tren inferior le dará estabilidad y economía cuando lleve muchas horas sobre la bici o corriendo.

## Ejemplo de tono y formato esperado (NO copies los datos del ejemplo, imita su estilo natural)

> Muy buena constancia cumpliendo con la hora de fuerza de los lunes, que es el cimiento invisible para aguantar entero cuando lleguen las tiradas largas de primavera. La lectura del pulso deja ver una sesión con bastante chispa y densidad: aunque la media se quede en 101 ppm por las pausas entre bloques, esos picos hasta 166 ppm y los casi 20 minutos de intensidad vigorosa demuestran que en las series exigentes has metido tensión de verdad, sumando incluso un punto de estímulo anaeróbico.
>
> Aunque sobre el papel la sesión solo sume 36 puntos de carga por pulso y deje tu TSB en un terreno muy cómodo, no te fíes solo del número cardiovascular: el trabajo con cargas y ejercicios intensos deja una fatiga muscular y nerviosa en el tren inferior que el pulsómetro no mide. Este estímulo te viene de lujo para blindar articulaciones y sostener la postura cuando aparezca el cansancio en la bici, pero requiere dejar que las fibras asimilen el golpe en las próximas 24 horas.
>
> **Próxima sesión:** Mañana las piernas pueden salir algo pesadas o con tono alto del gimnasio, así que empieza el rodaje con 15 minutos muy suaves y cadencia ágil para soltar musculatura antes de buscar cualquier ritmo o vatio objetivo.

## Formato obligatorio (180–250 palabras)
- **2 párrafos fluidos** de análisis (sin títulos `###`, sin listas de puntos `-`, sin símbolos `≈`).
- **1 párrafo corto final** que empiece por `**Próxima sesión:**` con la directriz concreta para mañana teniendo en cuenta la fatiga muscular de la fuerza.
