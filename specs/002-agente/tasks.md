# Tareas — 002 Agente (persona 2)

## 0:00–0:30 (H0)
- [ ] T-01 MUST Facilitar H0 y fijar cambios de contratos

## 0:30–1:30
- [ ] T-02 MUST Servidor HTTP con endpoints de `session.ts` + store en memoria
- [ ] T-03 MUST SSE con reenvío de `AgentEvent`
- [ ] T-04 MUST Extraer `src/pipeline.ts` desde `demo-mock.ts`, emitiendo eventos
- [ ] T-05 MUST Modo `SCRIPTED`: preguntas + `propose_spec` desde fixtures → avisar a persona 1

## 1:30–2:30 → C1
- [ ] T-06 MUST Spike Copilot SDK (time-box 45 min) → decidir SDK / CLI / SCRIPTED
- [ ] T-07 MUST Conectar con la web de persona 1

## 2:40–4:30 → C2
- [ ] T-08 SHOULD Fase DISCOVERY con LLM + tool `get_guidelines`
- [ ] T-09 SHOULD Fase SPEC_DRAFT con LLM + tool `propose_spec` (validación de campos)
- [ ] T-10 MUST Endpoints OCD (validate / transition) con regla de humanos
- [ ] T-11 MUST Ir activando tools reales a medida que 3, 4 y 5 las terminan

## 4:30–5:15
- [ ] T-12 MUST Verificar plan B (`SCRIPTED` + mocks) de punta a punta
- [ ] T-13 MUST Crear tags `c1` y `c2` en `main` de ambos repos al cerrar cada hito
