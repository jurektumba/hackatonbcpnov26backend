# Tareas — 004 OCD en JSM (persona 4)

## 0:30–2:30 → C1
- [ ] T-01 MUST Tabla del proceso OCD real en `demo/proceso-ocd.md` (15 min máx.)
- [ ] T-02 MUST Reglas por estado en `buildChecklist` (no depende de JSM: empezar por aquí)
- [ ] T-03 SHOULD Pruebas de `buildChecklist` (feliz + 2 bloqueos)
- [x] T-04 MUST Proyecto + workflow con `OCD_FLOW` — hecho en Jira Software: proyecto `OCD`, tipo `OCD`, 7 estados
- [x] T-05 MUST `createOcd` real (vía jira-backend)

## 2:40–4:30 → C2
- [x] T-06 MUST Mapeo `OcdState → transition id` (por nombre de estado, `JIRA_STATUS`)
- [x] T-07 SHOULD `transitionOcd` real con comentario de auditoría
- [ ] T-08 MUST Prueba `USE_MOCKS=false` con persona 2

## 4:30–5:15
- [ ] T-09 MUST Preparar caso de demo "bloqueado" (evidencia fallida) y caso feliz
- [ ] T-10 SHOULD Limpiar tickets de prueba
