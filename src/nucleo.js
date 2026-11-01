/**
 * nucleo.js — lo que Notas tipadas hace con el texto, sin Obsidian: títulos y nombres de archivo, frontmatter, la nota
 * de un tipo, las opciones de destino, las carpetas que se ofrecen, el encabezado de una extracción y las etiquetas que
 * hereda una tarea. Todo es texto de entrada y texto de salida.
 */

/** «Acemoglu: instituciones» → «acemoglu-instituciones»; sin tildes ni ligaduras. */
export const kebab = (texto) =>
    String(texto ?? "")
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

/** El título humano: sin los caracteres que rompen un nombre de archivo o un enlace, y sin espacios de más. */
export const limpiarTitulo = (texto) =>
    String(texto ?? "")
        .replace(/[\\/:*?"<>|#^[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** Un escalar de YAML: entre comillas cuando lleva `:`, `#`, corchetes, comillas… o está vacío. */
export function escalar(valor) {
    const v = String(valor ?? "");
    return /[:#[\]{}"'|>&*!%@`,]|^\s|\s$|^-/.test(v) || v === "" ? JSON.stringify(v) : v;
}

/** Rellena «{clave}» en una plantilla; lo que no está en `valores` queda como estaba. */
export const rellenar = (plantilla, valores) =>
    String(plantilla ?? "").replace(/\{(\w+)\}/g, (m, k) => (k in valores ? valores[k] : m));

const dos = (x) => String(x).padStart(2, "0");

/** Las marcas de tiempo de un instante (hora local): id, fecha, hora y las horas compactas de los nombres. */
export function marcas(d = new Date()) {
    const fecha = `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
    const hhmm = `${dos(d.getHours())}${dos(d.getMinutes())}`;
    const hhmmss = hhmm + dos(d.getSeconds());
    return { id: fecha.replace(/-/g, "") + hhmmss, fecha, hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`, hhmm, hhmmss };
}

/** El título que lleva la nota: el escrito, o «<Etiqueta> HHmm» si se dejó vacío. */
export const tituloFinal = (titulo, etiqueta, hhmm) => titulo || `${etiqueta} ${hhmm}`;

/**
 * El nombre estándar, sin extensión: «AAAA-MM-DD-<título-en-kebab>», o «AAAA-MM-DD-<etiqueta-en-kebab>-HHmm» si no hay
 * título (o el título no deja letras ni cifras).
 */
export function nombreBase({ titulo, etiqueta, fecha, hhmm }) {
    const k = kebab(titulo);
    return k ? `${fecha}-${k}` : `${fecha}-${kebab(etiqueta)}-${hhmm}`;
}

/** Una ruta libre en `carpeta`: «<base>.md»; si existe, «<base>-HHmmss.md», y después «-2», «-3»… */
export function rutaLibre(carpeta, base, hhmmss, existe) {
    const ruta = (nombre) => (carpeta && carpeta !== "/" ? `${carpeta}/${nombre}.md` : `${nombre}.md`);
    if (!existe(ruta(base))) return ruta(base);
    for (let i = 1; ; i++) {
        const nombre = i === 1 ? `${base}-${hhmmss}` : `${base}-${hhmmss}-${i}`;
        if (!existe(ruta(nombre))) return ruta(nombre);
    }
}

/** «[tipo, otra, …]»: la primera etiqueta es siempre el tipo, sin repetirlo. */
export const listaEtiquetas = (tipo, otras = []) => `[${[tipo, ...otras.filter((t) => t && t !== tipo)].join(", ")}]`;

/**
 * El frontmatter: las líneas de `campos` (una «clave: plantilla» por línea, con {id} {tipo} {titulo} {estado} {fecha}
 * {hora} {tags}) y después los campos propios del tipo, «clave: valor».
 */
export function frontmatter(campos, valores, extra = {}) {
    const lineas = String(campos ?? "")
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l.trim())
        .map((l) => rellenar(l, valores));
    for (const [clave, valor] of Object.entries(extra ?? {})) lineas.push(`${clave}: ${valor ?? ""}`);
    return ["---", ...lineas, "---", ""].join("\n");
}

/**
 * La nota completa de un tipo `t` ({ id, etiqueta, emoji, tipo, estado, extra, cuerpo }): frontmatter, encabezado
 * (`titular`, p. ej. «# {emoji} {titulo}») y cuerpo. El encabezado y el cuerpo admiten {titulo} {emoji} {etiqueta}
 * {tipo} {fecha} {hora} {id}.
 */
export function nota(t, { campos, titular }, { id, fecha, hora, titulo }) {
    const tipo = t.tipo || t.id;
    const fm = frontmatter(
        campos,
        { id, tipo, titulo: escalar(titulo), estado: t.estado ?? "", fecha, hora, tags: listaEtiquetas(tipo) },
        t.extra,
    );
    const v = { id, tipo, titulo, emoji: t.emoji ?? "", etiqueta: t.etiqueta ?? "", fecha, hora };
    const cabeza = String(titular ?? "").trim() ? rellenar(titular, v) + "\n\n" : "";
    return fm + cabeza + rellenar(t.cuerpo ?? "", v) + "\n";
}

export const OTRA = "\u0000otra";
export const BANDEJA = "\u0000bandeja";

/** Las opciones de destino: con carpeta sugerida, guardar ahí · elegir otra · bandeja; sin ella, bandeja · elegir otra. */
export function opcionesDestino(sugerida) {
    const s = String(sugerida ?? "").replace(/\/+$/, "").trim();
    return s
        ? [
              { etiqueta: `✅ Guardar en ${s}  (Enter)`, valor: s },
              { etiqueta: "📁 Elegir otra carpeta…", valor: OTRA },
              { etiqueta: "📥 Dejar en la bandeja", valor: BANDEJA },
          ]
        : [
              { etiqueta: "📥 Dejar en la bandeja  (Enter)", valor: BANDEJA },
              { etiqueta: "📁 Elegir otra carpeta…", valor: OTRA },
          ];
}

/**
 * Las carpetas que se ofrecen al «Elegir otra carpeta…», ordenadas. Cada entrada de `ocultas` es un prefijo: oculta la
 * carpeta, lo que cuelga de ella y toda carpeta cuyo nombre empiece así («scripts_» tapa scripts_for_linux…).
 */
export const carpetasVisibles = (rutas, ocultas = []) =>
    rutas.filter((p) => p && p !== "/" && !ocultas.some((o) => o && p.startsWith(o))).sort();

/** La página de una anotación de Zotero en el texto seleccionado (…?page=N&annotation=…), o null. */
export function paginaDe(seleccion) {
    const m = /\?page=(.*?)&annotation/.exec(String(seleccion ?? ""));
    return m ? m[1] : null;
}

/**
 * El encabezado de una extracción: la nota actual hasta la línea `marca` y los dos caracteres que la siguen (su salto
 * de línea y la línea en blanco), con el campo en línea «<campo>:: » puesto a la página de la anotación seleccionada.
 * Sin `marca` en la nota no hay encabezado; sin página en la selección, el campo queda como estaba.
 */
export function encabezado(contenido, seleccion, { marca = "### Note", campo = "pagina" } = {}) {
    const i = marca ? contenido.indexOf(marca) : -1;
    if (i < 0) return "";
    const cabecera = contenido.substring(0, i + marca.length + 2);
    const pagina = paginaDe(seleccion);
    if (pagina === null || !campo) return cabecera;
    const clave = `${campo}:: `;
    const inicio = cabecera.indexOf(clave);
    const fin = inicio < 0 ? -1 : cabecera.indexOf("\n", inicio);
    if (fin < 0) return cabecera;
    return cabecera.slice(0, inicio) + clave + pagina + cabecera.slice(fin);
}

const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Las etiquetas que hereda una tarea extraída: las de la nota (con o sin «#») que empiezan por uno de los `prefijos`
 * («proyecto», «proyecto/…»), sin «#», sin repetir, y escritas con el primer prefijo («project/x» → «proyecto/x»).
 */
export function etiquetasHeredadas(etiquetas, prefijos = []) {
    const ps = prefijos.map((p) => String(p).trim()).filter(Boolean);
    if (!ps.length) return [];
    const rx = new RegExp(`^#?(${ps.map(escapar).join("|")})(?=/|$)`);
    const salida = [];
    for (const e of etiquetas ?? []) {
        const m = rx.exec(e);
        if (!m) continue;
        const heredada = ps[0] + e.replace(/^#/, "").slice(m[1].length);
        if (!salida.includes(heredada)) salida.push(heredada);
    }
    return salida;
}

/** «clave: valor» por línea → { clave: valor } (los campos propios de un tipo, en orden). */
export function leerCampos(texto) {
    const campos = {};
    for (const l of String(texto ?? "").split("\n")) {
        const i = l.indexOf(":");
        if (i <= 0) continue;
        const clave = l.slice(0, i).trim();
        if (clave) campos[clave] = l.slice(i + 1).trim();
    }
    return campos;
}

/** { clave: valor } → «clave: valor» por línea. */
export const escribirCampos = (campos) =>
    Object.entries(campos ?? {})
        .map(([k, v]) => `${k}: ${v ?? ""}`)
        .join("\n");

/** Para buscar sin mayúsculas ni tildes. */
export const normalizar = (texto) =>
    String(texto ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
