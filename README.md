# Notas tipadas

Complemento de Obsidian para crear **notas de un tipo** (idea, proyecto, reunión, libro…) que nacen ya ordenadas:
con su nombre estándar, el mismo frontmatter que todas las demás y en la carpeta que confirmes. Sin plantillas que
programar ni scripts de usuario.

Una orden, «Nota tipada nueva»: eliges el tipo, escribes el título y confirmas dónde va.

```markdown
notas/2026-10-31-sistema-de-tareas.md

---
id: 20261031091300
tipo: proyecto
titulo: Sistema de tareas
estado: activo
creado: 2026-10-31
tags: [proyecto]
aliases: []
objetivo: 
fecha_limite: 
---
# 🗂️ Sistema de tareas

## Objetivo
…
```

## La nota tipada

- **Título y nombre.** El archivo se llama `AAAA-MM-DD-<título-en-kebab>.md` (sin tildes ni espacios); el título
  humano va al encabezado y a `titulo:`. Si dejas el título vacío (Enter o `Esc`), la nota se llama
  `AAAA-MM-DD-<tipo>-HHmm.md` y su título es `<Tipo> HHmm`. Nunca queda un «Untitled», y si el nombre ya existe se le
  añade la hora exacta (`-HHmmss`).
- **Frontmatter único.** Los campos comunes se escriben en los ajustes, una línea `clave: valor` con variables
  (`{id} {tipo} {titulo} {estado} {fecha} {hora} {tags}`), y después van los campos propios del tipo. La primera
  etiqueta es siempre el tipo. El título va entre comillas solo cuando el YAML lo necesita.
- **Archivar, siempre con confirmación.** Cada tipo puede tener una carpeta sugerida, y siempre se pregunta:

  | opción | `Esc` |
  |---|---|
  | ✅ Guardar en `<sugerida>` (Enter) | esta |
  | 📁 Elegir otra carpeta… | la bandeja |
  | 📥 Dejar en la bandeja | |

  Sin carpeta sugerida, la primera opción es la bandeja. Si la carpeta no existe, pregunta antes de crearla. La lista de
  «Elegir otra carpeta…» omite las **carpetas ocultas** de los ajustes, que son prefijos: `meta` oculta `meta` y lo que
  cuelga de ella; `scripts_` oculta toda carpeta que empiece así.
- **Tipos editables.** Por tipo: identificador, nombre, emoji, tipo declarado (si difiere del identificador; p. ej. un
  «Algún día» que es una `idea`), estado, carpeta sugerida, campos propios y cuerpo (con `{fecha}`, `{hora}`,
  `{titulo}`). Vienen siete de ejemplo.

La **bandeja** es la carpeta de notas nuevas de Obsidian, o la que pongas en los ajustes.

## Extraer la selección

Dos órdenes para el editor:

- **A una nota (con el encabezado de esta).** Pide un título, crea en la bandeja una nota con el encabezado de la
  actual (todo hasta la línea `### Note`, configurable) más la selección, y deja `[[enlace]]` en lugar de lo
  seleccionado. Si la selección trae un enlace de anotación de Zotero (`…?page=N&annotation=…`), el campo en línea
  `pagina:: ` del encabezado toma esa página. Pensada para las notas de lectura de
  [Zotero Integration](https://github.com/mgmeyers/obsidian-zotero-integration).
- **A una tarea (con las etiquetas de proyecto).** Corta la selección a una nota de tarea en la bandeja, con el
  frontmatter común, `tipo` y `estado` de los ajustes, y las etiquetas de la nota de origen que empiezan por los
  prefijos configurados (`proyecto, project`: `#project/x` se hereda como `proyecto/x`).

## Instalar

Desde una versión publicada: copia `main.js`, `manifest.json` y `styles.css` de la
[última versión](https://github.com/achalmed/obsidian-notas-tipadas/releases/latest) a
`<vault>/.obsidian/plugins/notas-tipadas/`, o instálalo con [BRAT](https://github.com/TfTHacker/obsidian42-brat)
dando `achalmed/obsidian-notas-tipadas`. Después: Ajustes → Complementos de la comunidad → activar «Notas tipadas», y
en Ajustes → Atajos, buscar «Nota tipada» y «Extraer la selección».

Desde este repo:

```bash
npm install
npm run build
./instalar.sh <ruta-del-vault>             # simula
./instalar.sh <ruta-del-vault> --aplicar
```

## Desarrollar

```bash
npm test     # el núcleo (src/nucleo.js): nombres, frontmatter, notas, destinos, encabezado y etiquetas, sin Obsidian
```

## Familia

Notas tipadas es parte de una familia de complementos independientes que se complementan por convenciones de datos
(frontmatter y campos en línea), no por dependencias:
[Omitir carpetas](https://github.com/achalmed/obsidian-omitir-carpetas) ·
[Formatear Markdown](https://github.com/achalmed/obsidian-formatear-markdown) ·
[Tema de iconos](https://github.com/achalmed/obsidian-tema-de-iconos) ·
[Captura](https://github.com/achalmed/obsidian-captura) · Notas tipadas.

## Licencia

MIT.
