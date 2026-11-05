# Tarea: Valoración del Entrenador — Sesión de Ciclismo

Escribe tu valoración de entrenador sobre esta sesión de ciclismo usando únicamente los datos del JSON.

## Cómo interpretar los datos como un entrenador real

- **Intención vs. Realidad**:
  - Si hay `planned_workout`, compáralo con lo que realmente hizo. Si tocaban series (p. ej. Z4) pero se fue a hacer gravel o ruta libre con un `vi` muy alto (>1.12) y mucho tiempo en Z1 dejando caer los vatios, explícale con naturalidad que no ha sido un trabajo limpio de series, sino un entreno de cambios de ritmo y fuerza en repechos.
  - Recuerda las zonas respecto al FTP: IF < 0.65 es rodaje suave/recuperación (Z1); IF 0.65–0.78 es fondo aeróbico (Z2); IF 0.78–0.88 es tempo/sweetspot (Z3); IF > 0.88 es umbral (Z4). No digas nunca que un IF de 0.64 es zona 3-4.
- **Potencia media vs. Normalizada (NP) y VI**:
  - Si NP es muy superior a la potencia media (`vi` > 1.10), es porque hubo muchos parones/bajadas en Z1 combinados con apretones fuertes (`best_efforts`). Explícale el desgaste muscular que dejan esos picos aunque la media de vatios parezca baja.
  - Si el `vi` es bajo (1.00–1.05), felicítale por pedalear redondo y constante sin regalar vatios.
- **Pulso y Deriva Cardíaca (`cardiac_drift_pct`)**:
  - Fíjate en la relación entre las zonas de potencia y las de FC: si pasó mucho más tiempo en zonas altas de pulso (Z4-Z5) que de potencia, o si la deriva supera el 5-6%, el pulso se desacopló por fatiga acumulada, calor o por los calentones repetidos.
  - Si la deriva es baja (<3.5%) en un rodaje constante, destaca lo sólido que está su motor aeróbico a esos vatios.
- **Cadencia**:
  - Si la cadencia media es baja (<75 rpm, común en gravel o subidas duras), menciona que ha tirado mucho de fuerza muscular (ir atrancado), lo que deja más fatiga en las piernas que llevar cadencia ágil (85–90 rpm).

## Ejemplo de tono y formato esperado (NO copies los datos del ejemplo, imita su estilo natural)

> Hoy tenías pautado un bloque estructurado en Z4, pero en el terreno roto de gravel te ha salido una sesión muy distinta: mucho tiempo dejando correr la bici suave en Z1 (de ahí los 155 W medios) mezclado con apretones serios de 1 a 5 minutos rozando los 300-330 W en los repechos. No es el estímulo continuo de umbral que buscábamos sobre el papel, pero esos cambios de ritmo te dejan una carga importante en las piernas (213 W normalizados y un VI altísimo de 1.37), sobre todo porque has ido bastante atrancado a 68 rpm medias tirando de fuerza pura.
>
> Donde más se nota ese castigo muscular es en la respuesta del pulso: aunque las 132 ppm de media engañen a simple vista, te has metido más de 20 minutos en Z5 de pulso cuando apenas has pisado esa zona en vatios, disparando la deriva cardíaca al 16%. Viniendo ya con fatiga acumulada en la semana (TSB en -19), a mitad de salida el cuerpo acusó los tirones y te costó mucho más pulso sostener la potencia.
>
> **Próxima sesión:** Con el TSB en -19 y las piernas tocadas de ir atrancado hoy, mañana toca recuperar sí o sí. Si sales, limítate a 60 minutos de paseo real en Z1 en llano llevando cadencia suelta (>85 rpm) para limpiar las piernas, sin picarte en ningún repecho.

## Formato obligatorio (180–250 palabras)
- **2 párrafos fluidos** de análisis (sin títulos `###`, sin listas de puntos `-`, sin símbolos `≈`).
- **1 párrafo corto final** que empiece por `**Próxima sesión:**` con la directriz concreta para mañana.
