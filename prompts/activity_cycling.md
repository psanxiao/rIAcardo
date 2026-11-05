# Tarea: Análisis Técnico de Sesión de Ciclismo

Analiza la sesión de ciclismo aplicando tu criterio de entrenador de alto rendimiento sobre el JSON proporcionado.

## Criterios Técnicos de Evaluación (aplica solo los relevantes hoy)

- **Estímulo real e Intensidad (IF, NP, Zonas)**:
  - Rodaje regenerativo: IF < 0.65 y predominio Z1.
  - Base aeróbica (Endurance): IF 0.65–0.78 y >70% del tiempo en Z1-Z2. Si hay >15% en Z4+ durante un día de base, señala la fuga de intensidad y su coste en fatiga.
  - Tempo / Sweetspot / Umbral: IF > 0.80 o bloques claros en Z3-Z4 / `best_efforts`.
- **Calidad de entrega de potencia (VI = NP / Potencia media)**:
  - Llano/rodillo: VI óptimo 1.00–1.05.
  - Terreno quebrado/puertos: VI aceptable hasta 1.08–1.12. Un VI > 1.12 en un día que debía ser aeróbico indica conducción a tirones y gasto anaeróbico innecesario (`w_prime_joules`).
- **Respuesta fisiológica (FC vs. Vatios y Deriva)**:
  - Contrasta el % de tiempo en zonas de potencia frente a zonas de FC y el `cardiac_drift_pct`.
  - Deriva < 3.5% en rodaje constante = excelente acoplamiento aeróbico. Deriva > 5% = desacople (fatiga, calor o falta de base).
- **Mecánica de pedaleo (Cadencia)**:
  - Comenta la cadencia **solo** si hay anomalías (p. ej. < 75 rpm medias en llano indicando ir atrancado con sobrecarga muscular, o > 98 rpm sostenidas) o si explica el comportamiento del pulso.

## Formato de Salida OBLIGATORIO (~130–160 palabras en total)

Respeta estrictamente esta estructura en 3 bloques sin añadir títulos extra ni introducciones:

**[Veredicto en 1 sola frase contundente en negrita]**: Define qué estímulo fisiológico real tuvo la salida y, si existe `planned_workout`, si se cumplió el objetivo pautado.

- **[Clave 1 — Ejecución y Pacing]**: Análisis directo de la entrega de potencia (NP/IF, VI, reparto en zonas o progresión de vueltas) respaldado solo por los datos que aporten valor diagnóstico.
- **[Clave 2 — Respuesta Interna / Fisiología]**: Lectura del acoplamiento vatios-pulso (relación con FTP/LTHR, deriva cardíaca o picos de esfuerzo en `best_efforts`).
- **[Clave 3 — Opcional]**: Solo inclúyela si hay una anomalía clara en cadencia, fatiga previa (TSB), temperatura o desviación respecto al plan. Si todo es normal, quédate en 2 claves.

**Próxima sesión:** [1 sola frase directa indicando cómo ajustar la carga o el enfoque de mañana en función del TSS de hoy y del TSB actual].
