# Tarea: Análisis Técnico de Sesión de Running

Analiza la sesión de carrera a pie aplicando tu criterio de entrenador de alto rendimiento sobre el JSON proporcionado.

## Criterios Técnicos de Evaluación (aplica solo los relevantes hoy)

- **Estímulo real y Control de Ritmo (Ritmo vs. `threshold_pace` y Zonas)**:
  - Rodaje base / regenerativo: >75% del tiempo en Z1-Z2 de FC y ritmo claramente más lento que `threshold_pace` (+45 a +90 s/km). Si el pulso se mete en Z3-Z4 en un rodaje suave, señala el error de ir en "zona gris".
  - Tempo / Umbral / Series: evalúa la proximidad al `threshold_pace`, los picos en `best_efforts` y la consistencia entre vueltas (`laps`).
- **Gestión del Esfuerzo y Splits (`laps`)**:
  - Analiza si el ritmo fue estable, progresivo (*negative split*) o si hubo caída de ritmo con subida de pulso en el tramo final por salir por encima de las posibilidades.
  - Ten en cuenta el desnivel (`ascent_m`): en terreno con cuestas, evalúa la estabilidad del esfuerzo (FC) más que la constancia del ritmo bruto.
- **Eficiencia Aeróbica (FC y `cardiac_drift_pct`)**:
  - En rodajes continuos (>40 min), deriva < 4% = buen soporte aeróbico; deriva > 5% = desacople cardiovascular (fatiga acumulada, impacto térmico o déficit aeróbico).
- **Biomecánica (Cadencia y Zancada)**:
  - Comenta `cadence_spm` o `stride_length_m` **únicamente** si son relevantes para el diagnóstico (p. ej. cadencia < 164 spm con riesgo de *overstriding* e impacto articular, o cómo responde la cadencia a ritmos vivos). Si está en rango eficiente (170–185 spm), no gastes palabras en ello.

## Formato de Salida OBLIGATORIO (~130–160 palabras en total)

Respeta estrictamente esta estructura en 3 bloques sin añadir títulos extra ni introducciones:

**[Veredicto en 1 sola frase contundente en negrita]**: Define qué estímulo fisiológico real tuvo la sesión y, si existe `planned_workout`, si se cumplió el trabajo previsto.

- **[Clave 1 — Pacing y Estímulo]**: Lectura técnica del ritmo respecto al umbral, distribución de intensidad y gestión de las vueltas/desnivel, citando solo los números que demuestran el diagnóstico.
- **[Clave 2 — Coste Interno / Fisiología]**: Análisis de la relación ritmo-FC, comportamiento respecto al LTHR y deriva cardíaca.
- **[Clave 3 — Opcional]**: Solo inclúyela si hay un hallazgo real en biomecánica (cadencia/zancada), impacto del TSB/temperatura o desviación del plan. Si todo está en orden, deja solo 2 claves.

**Próxima sesión:** [1 sola frase directa con la pauta concreta para mañana cruzando el desgaste muscular/metabólico de hoy con el TSB actual].
