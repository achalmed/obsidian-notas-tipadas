// prueba/nucleo.test.js — el núcleo de Notas tipadas, sin Obsidian: `npm test`.
// Las salidas esperadas reproducen las de los scripts de Templater a los que reemplaza (titular, frontmatter,
// archivar, encabezado y etiqueta_proyecto), tomadas de notas creadas con ellos.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as n from "../src/nucleo.js";

const CAMPOS = "id: {id}\ntipo: {tipo}\ntitulo: {titulo}\nestado: {estado}\ncreado: {fecha}\ntags: {tags}\naliases: []\nAutoNoteMover: disable";
const M = { id: "20261031225442", fecha: "2026-10-31", hora: "22:54", hhmm: "2254", hhmmss: "225442" };

test("título y nombre estándar", () => {
    assert.equal(n.limpiarTitulo("  Prueba: notas   tipadas "), "Prueba notas tipadas");
    assert.equal(n.limpiarTitulo("a/b#c[d]"), "a b c d");
    assert.equal(n.kebab("Acemoglu, instituciones ﬁnales"), "acemoglu-instituciones-finales");
    assert.equal(n.nombreBase({ titulo: "Sistema de tareas", etiqueta: "Idea", ...M }), "2026-10-31-sistema-de-tareas");
    assert.equal(n.nombreBase({ titulo: "", etiqueta: "Algún día", ...M }), "2026-10-31-algun-dia-2254");
    assert.equal(n.nombreBase({ titulo: "¿?", etiqueta: "Investigación", ...M }), "2026-10-31-investigacion-2254");
    assert.equal(n.tituloFinal("", "Idea", "2254"), "Idea 2254");
    assert.equal(n.tituloFinal("Mi idea", "Idea", "2254"), "Mi idea");
});

test("ruta libre: añade la hora exacta si el nombre existe", () => {
    const hay = new Set(["notas/a.md", "notas/a-225442.md"]);
    assert.equal(n.rutaLibre("notas", "b", "225442", (r) => hay.has(r)), "notas/b.md");
    assert.equal(n.rutaLibre("notas", "a", "225442", (r) => hay.has(r)), "notas/a-225442-2.md");
    assert.equal(n.rutaLibre("/", "a", "1", () => false), "a.md");
});

test("escalar de YAML: comillas solo cuando hacen falta", () => {
    assert.equal(n.escalar("Prueba notas tipadas"), "Prueba notas tipadas");
    assert.equal(n.escalar("Costo: beneficio"), '"Costo: beneficio"');
    assert.equal(n.escalar("-menos"), '"-menos"');
    assert.equal(n.escalar(""), '""');
});

test("nota de un tipo: igual a la que dejaba la plantilla de Templater", () => {
    const proyecto = {
        id: "proyecto",
        etiqueta: "Proyecto",
        emoji: "🗂️",
        estado: "activo",
        extra: { objetivo: "", fecha_limite: "", esperando: "" },
        cuerpo: "## Objetivo (¿cómo se ve TERMINADO?)\n\n-\n\n## ⏭️ Siguiente acción (siempre debe haber UNA sin marcar)\n\n- [ ]\n\n## Tareas\n\n- [ ]\n\n## Registro\n\n- {fecha} — creado.",
    };
    assert.equal(
        n.nota(proyecto, { campos: CAMPOS, titular: "# {emoji} {titulo}" }, { ...M, titulo: "Prueba notas tipadas" }),
        "---\nid: 20261031225442\ntipo: proyecto\ntitulo: Prueba notas tipadas\nestado: activo\ncreado: 2026-10-31\ntags: [proyecto]\naliases: []\nAutoNoteMover: disable\nobjetivo: \nfecha_limite: \nesperando: \n---\n# 🗂️ Prueba notas tipadas\n\n## Objetivo (¿cómo se ve TERMINADO?)\n\n-\n\n## ⏭️ Siguiente acción (siempre debe haber UNA sin marcar)\n\n- [ ]\n\n## Tareas\n\n- [ ]\n\n## Registro\n\n- 2026-10-31 — creado.\n",
    );
    // «algun-dia» declara `tipo: idea`; su etiqueta es el tipo declarado.
    const algunDia = { id: "algun-dia", tipo: "idea", etiqueta: "Algún día", emoji: "🌤️", estado: "algun_dia", extra: {}, cuerpo: "- " };
    assert.match(n.nota(algunDia, { campos: CAMPOS, titular: "# {emoji} {titulo}" }, { ...M, titulo: "x" }), /\ntipo: idea\n.*\ntags: \[idea\]\n/s);
    // Sin encabezado, el cuerpo va justo tras el frontmatter.
    assert.equal(n.nota({ id: "nota", estado: "bandeja", cuerpo: "- " }, { campos: "tipo: {tipo}", titular: "" }, { ...M, titulo: "x" }), "---\ntipo: nota\n---\n- \n");
});

test("destino: opciones con y sin carpeta sugerida", () => {
    assert.deepEqual(
        n.opcionesDestino("tareas/").map((o) => o.etiqueta),
        ["✅ Guardar en tareas  (Enter)", "📁 Elegir otra carpeta…", "📥 Dejar en la bandeja"],
    );
    assert.equal(n.opcionesDestino("tareas")[0].valor, "tareas");
    assert.deepEqual(
        n.opcionesDestino(null).map((o) => o.valor),
        [n.BANDEJA, n.OTRA],
    );
});

test("carpetas ofrecidas: las ocultas son prefijos", () => {
    const rutas = ["notas", "meta", "meta/docs", "scripts_for_linux", "pub_x", "notas/10-investigacion", "/", "tareas"];
    assert.deepEqual(n.carpetasVisibles(rutas, ["meta", "scripts_", "pub_", ""]), ["notas", "notas/10-investigacion", "tareas"]);
});

test("extraer a nota: encabezado hasta «### Note» con la página de la anotación", () => {
    const actual = "---\ntipo: lectura\ntags: [lectura]\n---\n# Lectura\n\npagina:: 3\n\n### Note\n\nAntes\n> Cita\nDespués\n";
    const sel = "> Cita [(p. 12)](zotero://open-pdf/library/items/ABC?page=12&annotation=XYZ)";
    assert.equal(n.encabezado(actual, sel), "---\ntipo: lectura\ntags: [lectura]\n---\n# Lectura\n\npagina:: 12\n\n### Note\n\n");
    assert.equal(n.encabezado(actual, "sin enlace"), "---\ntipo: lectura\ntags: [lectura]\n---\n# Lectura\n\npagina:: 3\n\n### Note\n\n");
    assert.equal(n.encabezado("# Sin marca\n", sel), "");
    assert.equal(n.paginaDe(sel), "12");
    assert.equal(n.paginaDe("nada"), null);
});

test("extraer a tarea: hereda las etiquetas de proyecto", () => {
    const etiquetas = ["#lectura", "#proyecto/alfa", "#project/beta", "#proyectos", "#project", "#proyecto/alfa"];
    assert.deepEqual(n.etiquetasHeredadas(etiquetas, ["proyecto", "project"]), ["proyecto/alfa", "proyecto/beta", "proyecto"]);
    assert.deepEqual(n.etiquetasHeredadas(etiquetas, []), []);
    assert.equal(
        n.frontmatter(CAMPOS, { ...M, tipo: "tarea", titulo: n.escalar("new task"), estado: "activo", tags: n.listaEtiquetas("tarea", ["proyecto/alfa", "proyecto/beta"]) }) + "\nTarea seleccionada",
        "---\nid: 20261031225442\ntipo: tarea\ntitulo: new task\nestado: activo\ncreado: 2026-10-31\ntags: [tarea, proyecto/alfa, proyecto/beta]\naliases: []\nAutoNoteMover: disable\n---\n\nTarea seleccionada",
    );
});

test("campos propios: «clave: valor» por línea, ida y vuelta", () => {
    const c = n.leerCampos("autor:\nanio: \nestado_lectura: por_leer\nurl: https://x.org/a:b\n basura");
    assert.deepEqual(c, { autor: "", anio: "", estado_lectura: "por_leer", url: "https://x.org/a:b" });
    assert.equal(n.escribirCampos(c), "autor: \nanio: \nestado_lectura: por_leer\nurl: https://x.org/a:b");
});

test("marcas de tiempo locales", () => {
    assert.deepEqual(n.marcas(new Date(2026, 9, 31, 7, 5, 9)), { id: "20261031070509", fecha: "2026-10-31", hora: "07:05", hhmm: "0705", hhmmss: "070509" });
    assert.equal(n.normalizar("Algún DÍA"), "algun dia");
});
