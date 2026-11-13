# Spec 004 — OCD (One Click Deploy) en Jira Service Management

**Dueño:** persona 4 · **Carpeta:** `tools/jsm` · **Repo:** backend
**Implementa:** `JsmTools` de `contracts/src/tools.ts` · **Lógica clave:** `tools/jsm/src/checklist.ts`

## Objetivo

Que el ticket OCD llegue **completo y validado** a cada etapa, reduciendo rechazos e ida y vuelta.
Es probablemente **el mayor ahorro de la solución**: dueño de que se note en la demo.

> **Decisión del equipo:** en esta hackatón el OCD vive en un proyecto de **Jira Software** llamado `OCD`
> (tipo de issue `OCD`), no en Jira Service Management. El flujo de 7 estados ya está configurado en Jira y
> `tools/jsm/src/real.ts` lo usa a través del servicio [`jurektumba/jira-backend`](https://github.com/jurektumba/jira-backend):
> crea el ticket en Validación enlazado a la Historia, transiciona por nombre de estado, comenta el checklist
> en cada paso y pone la fecha de pase al calendarizar. Prueba: `npm run smoke:ocd`.

> **Aprobadores:** el pase a Producción lo aprueban varios roles: Líder Técnico, Chapter Lead, QA Chapter Lead, PO y,
> cuando el requerimiento es de seguridad, el Analista de seguridad (`buildApprovals`, `requiresSecurityReview`).
> El agente lleva el OCD hasta **Aprobación** ("esperando aprobaciones"); cada rol aprueba con `approveOcd`
> (comentario de auditoría en Jira) y **Producción** exige todas las obligatorias (`approvals-complete`) y una persona.

## Parte A — Modelar el OCD en JSM
- Proyecto JSM (en el sitio de persona 3) con request type **"OCD - One Click Deploy"**.
- Workflow con los estados de `OCD_FLOW`:
  `VALIDACION → CONGELAMIENTO → REVERSION_CONGELAMIENTO → RECONGELAMIENTO → CALENDARIZACION → APROBACION → PRODUCCION`.
  Ajustar nombres si el proceso real difiere (y avisar a persona 2 para actualizar `OCD_FLOW`).
- Campos: Historia relacionada, URL del PR, Componentes, Versión, Plan de reversión, Evidencias, Fecha de pase.
- **Documentar el proceso OCD real** (1 página en `demo/proceso-ocd.md`): qué se valida en cada etapa hoy,
  quién lo hace, motivos frecuentes de rechazo. Sirve para el checklist y para el pitch.

## Parte B — Checklist de validación (`buildChecklist`)
Función **pura** usada por mock y real. Ya existen 4 reglas base (orden del flujo, evidencias OK, plan de
reversión, trazabilidad) y una de fecha para `APROBACION`. Completar con reglas por estado basadas en el proceso real, por ejemplo:
- `CONGELAMIENTO`: evidencias incluyen `unit-tests`, `build` y `security-scan`; PR aprobado.
- `REVERSION_CONGELAMIENTO`: plan de reversión menciona versión previa / pasos concretos.
- `RECONGELAMIENTO`: la reversión en certificación quedó registrada como exitosa.
- `CALENDARIZACION`: fecha propuesta fuera de ventanas de congelamiento del calendario.
Escribir **pruebas unitarias** de `buildChecklist` (caso feliz + 1 caso fallido por regla).

## Parte C — Tools reales
- `createOcd(input)`: crear request en JSM con todos los campos; estado inicial `VALIDACION`;
  comentario con la lista de evidencias (tipo, estado, link).
- `validateOcdTransition`: siempre `buildChecklist` (no llama a JSM).
- `transitionOcd(ocd, to)`: validar → si falla, lanzar error con los checks fallidos → si pasa, ejecutar la
  transición en JSM y agregar comentario con el checklist evaluado (auditoría).

## Recorte para 6 horas
- Campos personalizados mínimos: si crear campos toma mucho, poner todo en la **descripción** del request
  (secciones claras) y solo Fecha de pase como campo.
- El documento del proceso real se reduce a **una tabla** (estado · qué se valida · motivo frecuente de rechazo).
- Pruebas de `buildChecklist`: caso feliz + 2 casos de bloqueo (no uno por regla).

## Criterios de éxito
- **1:00:** sitio disponible (persona 3) → proyecto JSM con workflow de `OCD_FLOW`.
- **2:30 (C1):** reglas por estado en `buildChecklist` + `createOcd` real.
- **4:30 (C2):** `transitionOcd` real; `USE_MOCKS=false` en JSM pasa en `demo:mock`.
- **Demo:** mostrar un caso donde el checklist **bloquea** (p. ej. evidencia fallida) y otro donde avanza.
