# Tennis Log — Documento de handoff

Contexto completo del proyecto para retomarlo desde cualquier herramienta (Codex, Cursor, Claude Code, o a mano).

**Última actualización:** 20 de octubre de 2026

---

## 1. Qué es

App web para registrar partidos de tenis (singles y dobles), ver el historial con filtros y sacar estadísticas de victorias/derrotas por jugador y por rival. Varias personas la usan con su propio usuario y comparten la misma base de datos.

| | |
|---|---|
| **App en producción** | https://franciscoguida-hue.github.io/tennis-log/ |
| **Repositorio** | https://github.com/franciscoguida-hue/tennis-log |
| **Cuenta de GitHub** | `franciscoguida-hue` |
| **Hosting** | GitHub Pages (rama `main`, raíz del repo) |
| **Base de datos** | Firebase Firestore, proyecto `tennis-log-5354e` |
| **Consola Firebase** | https://console.firebase.google.com/project/tennis-log-5354e/firestore |
| **Idioma de la UI** | Español (es-AR) |

---

## 2. Arquitectura

Decisión de diseño central: **toda la app es un único archivo `index.html`**. Sin build, sin npm, sin framework, sin bundler. Se edita el archivo, se hace commit y GitHub Pages lo publica en ~1 minuto.

```
tennis-log/
├── index.html    ← TODA la app: HTML + CSS + JS en un solo archivo (~1900 líneas)
├── sw.js         ← Service Worker (estrategia network-first)
├── README.md
└── HANDOFF.md    ← este documento
```

### Por qué un solo archivo

Era un requisito práctico: el dueño del proyecto no es programador y edita vía herramientas de IA. Un solo archivo hace que cualquier cambio sea un diff legible y que no haya paso de compilación que pueda fallar. **Si vas a refactorizar, mantené esta decisión** salvo que haya una razón fuerte para cambiarla.

### Dependencias externas (todas por CDN, sin instalar nada)

| Librería | Uso | URL |
|---|---|---|
| Tabler Icons | Íconos (`<i class="ti ti-nombre">`) | `cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest` |
| Firebase App | SDK base | `gstatic.com/firebasejs/10.12.5/firebase-app.js` |
| Firebase Firestore | Base de datos | `gstatic.com/firebasejs/10.12.5/firebase-firestore.js` |

No hay otras dependencias. No hay `package.json`.

### Estructura interna de `index.html`

| Líneas aprox. | Sección |
|---|---|
| 1–60 | `<head>`, meta tags PWA, variables CSS |
| 60–640 | CSS completo (paleta Roland Garros, layouts, componentes) |
| 640–780 | HTML pantalla de login/registro |
| 780–960 | HTML de la app: header, 4 pestañas, formulario |
| 960–1000 | HTML del modal de renombrar, nav inferior, toast |
| 1010–1060 | JS: registro del Service Worker |
| 1060–1120 | JS: datos históricos embebidos (`HISTORICAL_MATCHES`) |
| 1120–1200 | JS: capa de datos y sincronización con Firestore |
| 1200–1260 | JS: autenticación, `initApp`, navegación entre pestañas |
| 1260–1400 | JS: alta y edición de partidos |
| 1400–1450 | JS: renderizado del scoreboard |
| 1450–1520 | JS: filtros e historial |
| 1520–1650 | JS: normalización de nombres y estadísticas |
| 1650–1790 | JS: gestión de jugadores (renombrar/fusionar) |
| 1790–1865 | JS: exportación CSV, toast |
| 1865–1900 | JS módulo: inicialización de Firebase y listeners |

---

## 3. Modelo de datos

### Firestore

Dos documentos únicos en la colección `tennis-log`. **No hay una colección por partido** — cada documento tiene un array completo en un campo `data`.

```
tennis-log (colección)
├── users    → { data: { "<username>": { name, pass } } }     ← objeto, no array
└── matches  → { data: [ Match, Match, ... ] }                 ← array
```

Es un diseño deliberadamente simple: toda la app lee y escribe el array entero. Funciona bien hasta unos cientos de partidos. **Si el volumen crece mucho, ahí sí conviene migrar a un documento por partido.**

### Objeto `Match`

```js
{
  id: 1748822400000,            // Date.now() al crearlo; es la clave primaria
  date: "2026-06-02",           // YYYY-MM-DD
  place: "BAC",                 // texto libre, puede estar vacío
  mode: "singles",              // "singles" | "doubles"
  players: {
    t1: "Francisco Guida",      // "tu equipo" jugador 1 (obligatorio)
    t2: "",                     // jugador 2 — sólo en dobles, si no ""
    r1: "Lucas Gorganchian",    // rival 1 (obligatorio)
    r2: ""                      // rival 2 — sólo en dobles, si no ""
  },
  sets: [                       // 1 a 3 sets
    { t: 6, r: 3, tb: null },   // t = games del equipo, r = games del rival
    { t: 7, r: 6, tb: 5 }       // tb = puntos del PERDEDOR del tie-break
  ],
  winner: "team",               // "team" | "rivals" — se recalcula, no se pide
  addedBy: "franciscoguida",    // username de quien lo cargó
  addedByName: "Francisco Guida"
}
```

**Detalles importantes:**

- `t`/`r` son siempre desde la perspectiva de "tu equipo" (`t1`/`t2`), no del usuario logueado. Un partido cargado por otra persona puede tener al usuario actual en `r1`.
- `tb` es el puntaje del que **perdió** el tie-break. Un `7-6(5)` se guarda como `{t:7, r:6, tb:5}`.
- `winner` lo calcula `determineWinner(sets)` contando sets ganados. Nunca se ingresa a mano.
- `id` es `Date.now()`. Suficiente para un solo usuario cargando a la vez; si dos cargan en el mismo milisegundo colisiona, pero es un riesgo aceptado.

### Objeto `User`

```js
users["franciscoguida"] = {
  name: "Francisco Guida",      // nombre visible; es lo que matchea con players.*
  pass: "bWlwYXNz"              // btoa(password) — ver advertencia abajo
}
```

⚠️ **Las contraseñas están en Base64, que NO es cifrado.** Cualquiera que abra la consola de Firestore las lee. Es una decisión consciente para una app familiar entre amigos, sin datos sensibles. **Si esto alguna vez se abre a desconocidos, hay que migrar a Firebase Authentication.**

### Reglas de seguridad de Firestore

Actualmente permisivas (lectura y escritura abiertas). La base es pública en la práctica. Mismo criterio que arriba: aceptable para el uso actual, no para uno más amplio.

---

## 4. Sincronización con la nube

El patrón es: **Firestore es la única fuente de verdad, y la UI reacciona a sus cambios.**

```
┌─ Usuario hace un cambio
│
├→ saveMatches(array)
│     ├→ _matchesCache = array        (cache local en memoria)
│     └→ window.__fbSave('matches', array)
│            └→ setDoc(doc(db,'tennis-log','matches'), { data })
│
└→ Firestore emite el cambio
      └→ onSnapshot dispara
            └→ window.__applyCloud('matches', data)
                  ├→ allMatches = data
                  └→ re-renderiza: populateStatsFilter, applyFilters,
                                   loadStats, renderPlayers
```

`onSnapshot` es un listener en vivo: si cargás un partido desde el teléfono, la pantalla de la compu se actualiza sola, sin recargar.

### Funciones puente (global `window`)

Existen porque el bloque de Firebase es `<script type="module">` (scope propio) y el resto es `<script>` clásico (scope global). Estas tres funciones son el único contrato entre ambos:

| Función | Definida en | Llamada desde | Qué hace |
|---|---|---|---|
| `window.__fbSave(kind, data)` | módulo Firebase | script principal | Escribe a Firestore |
| `window.__applyCloud(kind, data)` | script principal | módulo Firebase | Recibe datos y re-renderiza |
| `window.__cloudError(e)` | script principal | módulo Firebase | Muestra el error en pantalla |

**Si tocás uno de los dos bloques, respetá este contrato.**

### Flags de estado

```js
_cloudUsersReady    // ya llegó el primer snapshot de users
_cloudMatchesReady  // ya llegó el primer snapshot de matches
_migrated           // ya corrió la migración/restauración inicial (una sola vez)
```

`cloudReady()` devuelve `true` cuando llegaron ambos. **El login está bloqueado hasta entonces** — si no, un usuario válido parecería inválido porque `users` todavía estaría vacío. Por eso el mensaje "Conectando…" en la pantalla de login.

### Restauración automática de datos históricos

En `index.html` hay una constante `HISTORICAL_MATCHES` con 5 partidos reales (backup de un CSV). Si Firestore está vacío **y** no existe la marca `tl_csv_restored_v1` en localStorage, se cargan una sola vez. Es una red de seguridad por si la base se borra.

Para desactivarlo: vaciar el array. Para forzar que vuelva a correr: borrar esa clave de localStorage.

---

## 5. Funcionalidades

### Pestaña Historial

Lista de partidos con scoreboard estilo transmisión de TV. Filtros por rango de fechas, jugador (búsqueda parcial, ignora tildes), modalidad y resultado. Exportación a CSV con BOM UTF-8 para que Excel abra bien los acentos.

Cada tarjeta tiene un lápiz que abre el partido en modo edición.

### Pestaña Stats

Victorias, derrotas, porcentaje y desglose por rival. Un selector permite ver las estadísticas de cualquier jugador, no sólo las propias. Exportación a CSV.

### Pestaña Jugadores

Resuelve el problema de que "Martín" y "Martin" se contaran como dos personas distintas.

- Lista de jugadores con su cantidad de partidos
- Renombrar un jugador actualiza **todos** sus partidos de una vez
- Si el nombre nuevo ya existe, ofrece fusionar las dos personas en una
- Detecta automáticamente variantes del mismo nombre y ofrece unificarlas
- Si el usuario se renombra a sí mismo, también se actualiza su registro en `users`

### Pestaña Nuevo / Editar

Formulario de alta. Entra en modo edición al tocar el lápiz de una tarjeta: muestra una barra verde "Editando un partido ya cargado" con botón Cancelar, el botón principal pasa a decir "Guardar cambios" y aparece un botón para eliminar (con confirmación).

Al editar se conservan `id`, `addedBy` y `addedByName`. Si cambia la fecha, la lista se reordena. Tocar "Nuevo" en la barra inferior siempre descarta la edición en curso.

---

## 6. Normalización de nombres

El núcleo de la unificación de jugadores. Dos funciones:

```js
normName(s)        // "Javier Martín  y Herrera" → "javier martin y herrera"
                   // NFD → saca diacríticos → minúsculas → colapsa espacios → trim

sameName(a, b)     // true si normName(a) === normName(b) y no está vacío
```

**Toda comparación de nombres en la app pasa por acá.** Si agregás una funcionalidad que compare jugadores, usá `sameName()`, nunca `===` ni `.toLowerCase()`.

### Funciones derivadas

| Función | Qué devuelve |
|---|---|
| `matchPlayerList(match)` | Array con los jugadores no vacíos del partido |
| `playerInMatch(match, name)` | Si el jugador participó (ignorando tildes) |
| `getResultFor(match, name)` | `'W'` o `'L'` desde la perspectiva de ese jugador |
| `getOpponentsFor(match, name)` | Los rivales de ese jugador en ese partido |
| `getPlayerGroups()` | Jugadores agrupados por nombre normalizado, con sus variantes |
| `canonical(name)` | El nombre "oficial" ya cargado que coincide, o el input si es nuevo |
| `variantScore(name)` | Puntúa qué variante está mejor escrita |

`getPlayerGroups()` devuelve, por grupo: `{ key, display, count, variants[] }`. El `display` es la variante elegida como canónica — la más usada, y ante empate la mejor escrita según `variantScore` (con tildes +3, Mayúsculas Iniciales +2, espacios de más −2).

`canonical()` se aplica al guardar un partido: si escribís "javier martin" y ya existe "Javier Martín", se guarda con la grafía correcta. Esto evita que se generen variantes nuevas.

---

## 7. Service Worker

Estrategia **network-first**: siempre intenta la red primero, y si falla (sin conexión) sirve desde cache. Esto garantiza que el usuario vea la versión más reciente, al costo de no ser instantáneo offline.

```js
const CACHE_NAME = 'tennis-log-rg-v3';   // ⚠️ SUBIR EN CADA DEPLOY
```

**Regla operativa importante:** cada vez que cambies `index.html`, incrementá el número de versión en `sw.js`. Si no, los navegadores con el SW viejo instalado pueden tardar en tomar los cambios.

Cuando el SW detecta una versión nueva, la app muestra una barra naranja "Nueva versión disponible" con un botón Actualizar que manda `SKIP_WAITING` y recarga.

Sólo intercepta GETs del propio origen. Las llamadas a Firebase y a los CDN pasan directo sin cachearse.

### Si algo queda cacheado y no se actualiza

Pegar esto en la consola del navegador (F12 → Console):

```js
(async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  location.reload();
})();
```

---

## 8. Diseño: identidad Roland Garros

Paleta y tipografía inspiradas en la identidad visual de Roland Garros. Definidas como variables CSS en `:root`:

```css
--orange:    #D44C2A    /* naranja arcilla — acentos, CTAs, estado activo */
--green:     #063024    /* verde oscuro — headers, scoreboards, hero */
--cream:     #F5F0E8    /* crema — fondo general */
--sand:      #E2D9C8
--stone:     #8A8776    /* textos secundarios */
--charcoal:  #1A1A16    /* texto principal */
```

Tipografía: `'Helvetica Neue', Arial, sans-serif`. Títulos en mayúsculas con mucho `letter-spacing`.

Elementos característicos: emblema circular "RG", barra naranja de 3px separando secciones, círculos decorativos semitransparentes en el hero del login, scoreboard verde oscuro con punto naranja marcando al ganador.

**Al agregar pantallas nuevas, usá las variables CSS existentes.** No hardcodees colores.

---

## 9. Flujo de trabajo para hacer cambios

### Hacer un cambio y publicarlo

```bash
git clone https://github.com/franciscoguida-hue/tennis-log.git
cd tennis-log

# ... editar index.html ...
# ... subir CACHE_NAME en sw.js ...

git add -A
git commit -m "descripción del cambio"
git push
```

GitHub Pages publica automáticamente en ~1 minuto.

### Autenticación para el push

GitHub ya no acepta contraseña. Hay que usar un Personal Access Token (classic) con scope `repo`, generado en https://github.com/settings/tokens/new, y usarlo así:

```bash
git push https://<usuario>:<token>@github.com/franciscoguida-hue/tennis-log.git main
```

Los tokens expiran. Si el push falla con "Invalid username or token", está vencido y hay que generar otro. Ojo: `git ls-remote` puede funcionar igual porque el repo es público (lectura anónima) — eso no significa que el token sirva para escribir.

### Verificar sintaxis antes de publicar

No hay tests ni linter configurados. Como mínimo, chequeá que el JavaScript parsee:

```bash
python3 -c "
import re
html = open('index.html', encoding='utf-8').read()
main = max(re.findall(r'<script[^>]*>(.*?)</script>', html, re.S), key=len)
open('/tmp/chk.js','w',encoding='utf-8').write(main)
"
node --check /tmp/chk.js
```

Para probar lógica sin navegador, se puede extraer ese script y correrlo en Node con stubs de `document` y `localStorage`. Así se validaron las funciones de normalización y de edición.

### Probar localmente

```bash
python3 -m http.server 8000
```

Y abrir `http://localhost:8000`. Ojo: el SW está registrado en la ruta `/tennis-log/`, así que en local no se registra. Para probarlo hay que replicar esa ruta.

---

## 10. Convenciones del código

- **Comentarios y textos de UI en español.** Nombres de funciones y variables en inglés (herencia del código original); las funciones más nuevas mezclan (`cancelEdit`, `_editingId`, `eraEdicion`). No es ideal pero es el estado actual.
- **Variables con `_` adelante** son estado de módulo: `_editingId`, `_playerGroups`, `_matchesCache`, `_renameTarget`.
- **`esc(s)`** escapa HTML. **Todo dato que venga de la base y se inserte en un template string tiene que pasar por `esc()`.** Los nombres de jugadores los escribe el usuario.
- **Helpers de formulario:** `gv(id)` lee un valor como string trimmeado, `gn(id)` como número o `null`, `sv(id, val)` escribe.
- **Secciones separadas** por bloques de comentario `/* ===== TÍTULO ===== */`. Mantené el formato.
- **Sin `async/await`** en el código principal, salvo en el módulo de Firebase. Todo es síncrono sobre el cache en memoria.

---

## 11. Deuda técnica conocida

Lo que está mal a propósito o pendiente, en orden de importancia:

1. **Contraseñas en Base64.** No es cifrado. Migrar a Firebase Authentication si la app se abre más allá del círculo actual.
2. **Reglas de Firestore abiertas.** Cualquiera con la URL del proyecto puede leer y escribir. Mismo criterio que el punto 1.
3. **Todo el array en un solo documento.** Cada guardado reescribe todos los partidos. Simple y suficiente hoy; revisar si se pasan los ~500 partidos.
4. **`id` basado en `Date.now()`.** Colisiona si dos personas cargan en el mismo milisegundo. Riesgo bajo, solución fácil si aparece (agregar sufijo aleatorio).
5. **Sin tests automatizados.** La validación es manual o con scripts ad-hoc en Node.
6. **Máximo 3 sets.** El formulario tiene exactamente 3 filas de score, hardcodeadas en HTML y en `saveMatch`/`editMatch`. Para soportar 5 sets hay que tocar los tres lugares.
7. **Sin undo.** Eliminar un partido pide confirmación pero no se puede deshacer.
8. **Nombres de funciones mezclando inglés y español.** Cosmético.

---

## 12. Ideas pendientes

Nada de esto está comprometido, son posibilidades:

- Rachas (mejor racha de victorias, racha actual)
- Gráfico de evolución del win rate en el tiempo
- Estadísticas por superficie o por club
- Importar un CSV desde la UI (hoy la restauración está hardcodeada)
- Modo oscuro
- Instalación como PWA con prompt (los meta tags ya están, falta el manifest)
- Foto o avatar por jugador

---

## 13. Prompt sugerido para arrancar en otra herramienta

> Estoy retomando una app web llamada Tennis Log. Es un único archivo `index.html` (~1900 líneas) con HTML, CSS y JavaScript juntos, sin build ni framework, que usa Firebase Firestore como base de datos y se publica en GitHub Pages. El repositorio es https://github.com/franciscoguida-hue/tennis-log
>
> Leé primero `HANDOFF.md`, que tiene la arquitectura completa, el modelo de datos y las convenciones del código.
>
> Restricciones importantes: mantener todo en un solo archivo, usar las variables CSS existentes para cualquier estilo nuevo, comparar nombres de jugadores siempre con `sameName()` y nunca con `===`, escapar con `esc()` todo dato que se inserte en HTML, y subir `CACHE_NAME` en `sw.js` en cada cambio.
>
> Lo que necesito hacer es: [tu pedido acá]
