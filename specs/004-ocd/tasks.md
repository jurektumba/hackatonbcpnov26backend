# Tareas — 004 OCD en JSM (persona 4)

## 0:30–2:30 → C1
- [ ] T-01 MUST Tabla del proceso OCD real en `demo/proceso-ocd.md` (15 min máx.)
- [x] T-02 MUST Reglas por estado en `buildChecklist` (no depende de JSM: empezar por aquí) (proyecto OCD de Jira Software, tipo OCD)
- [x] T-03 SHOULD Pruebas de `buildChecklist` (feliz + 2 bloqueos) (7 estados configurados)
- [ ] T-04 MUST Proyecto JSM + request type OCD + workflow con `OCD_FLOW` (cuando el sitio esté listo)
- [ ] T-05 MUST `createOcd` real (usar el cliente HTTP de persona 3)

## 2:40–4:30 → C2
- [x] T-06 MUST Mapeo `OcdState → transition id`
- [x] T-07 SHOULD `transitionOcd` real con comentario de auditoría (transición por nombre de estado)
- [x] T-08 MUST Prueba `USE_MOCKS=false` con persona 2 (comentario con el checklist)

## 4:30–5:15
- [ ] T-09 MUST Preparar caso de demo "bloqueado" (evidencia fallida) y caso feliz
- [ ] T-10 SHOULD Limpiar tickets de prueba
