/**
 * main.js — Notas tipadas, complemento de Obsidian (https://github.com/achalmed/obsidian-notas-tipadas).
 *
 * Una nota nueva de un tipo (idea, proyecto, reunión…): se elige el tipo, se escribe el título (Enter vacío = uno
 * automático), y se confirma la carpeta (la sugerida para el tipo, otra o la bandeja). La nota nace ya con su nombre
 * estándar «AAAA-MM-DD-<título>.md», su frontmatter y su cuerpo. Nunca mueve sin preguntar ni sobrescribe.
 * Además, dos extracciones de la selección: a una nota con el encabezado de la actual (la página de la anotación de
 * Zotero puesta al día), dejando un enlace en su lugar; y a una tarea que hereda las etiquetas de proyecto.
 * El núcleo (texto de entrada, texto de salida) está en nucleo.js.
 */
import { Plugin, PluginSettingTab, Setting, Notice, Modal, SuggestModal, TFolder, getAllTags, normalizePath } from "obsidian";
import * as n from "./nucleo.js";

const TIPO = (id, etiqueta, emoji, estado, extra, cuerpo) => ({ id, etiqueta, emoji, tipo: "", estado, carpeta: "", extra, cuerpo });

const AJUSTES = {
    campos: "id: {id}\ntipo: {tipo}\ntitulo: {titulo}\nestado: {estado}\ncreado: {fecha}\ntags: {tags}\naliases: []",
    titular: "# {emoji} {titulo}",
    bandeja: "",
    ocultas: [],
    tipos: [
        TIPO("nota", "Nota", "📝", "bandeja", {}, "- "),
        TIPO("idea", "Idea", "💡", "bandeja", {}, "## La idea\n\n-\n\n## ¿Por qué importa?\n\n-\n\n## Siguiente acción\n\n- [ ] "),
        TIPO("proyecto", "Proyecto", "🗂️", "activo", { objetivo: "", fecha_limite: "" }, "## Objetivo\n\n-\n\n## Siguiente acción\n\n- [ ]\n\n## Registro\n\n- {fecha} — creado."),
        TIPO("reunion", "Reunión", "🤝", "activo", { con: "", fecha_reunion: "" }, "## Agenda\n\n-\n\n## Notas\n\n-\n\n## Acuerdos\n\n- [ ] "),
        TIPO("persona", "Persona", "👤", "activo", { relacion: "", contacto: "" }, "## Quién es\n\n-\n\n## Pendientes con esta persona\n\n- [ ] "),
        TIPO("libro", "Libro", "📖", "bandeja", { autor: "", anio: "" }, "## ¿Por qué leerlo?\n\n-\n\n## Notas\n\n-\n\n## Citas\n\n> "),
        TIPO("referencia", "Referencia", "🔗", "activo", { url: "" }, "## ¿Para qué sirve?\n\n-\n\n## Extracto\n\n- "),
    ],
    extraerNota: { marca: "### Note", campo: "pagina" },
    extraerTarea: { nombre: "tarea nueva", titulo: "tarea nueva", tipo: "tarea", estado: "activo", heredar: ["proyecto"] },
};

export default class NotasTipadas extends Plugin {
    async onload() {
        const g = (await this.loadData()) || {};
        const d = structuredClone(AJUSTES);
        this.ajustes = {
            ...d,
            ...g,
            extraerNota: { ...d.extraerNota, ...(g.extraerNota || {}) },
            extraerTarea: { ...d.extraerTarea, ...(g.extraerTarea || {}) },
        };
        this.addSettingTab(new PestanaNotasTipadas(this.app, this));
        this.addCommand({ id: "nota-tipada", name: "Nota tipada nueva", callback: () => this.notaTipada() });
        this.addCommand({
            id: "extraer-nota",
            name: "Extraer la selección a una nota (con el encabezado de esta)",
            editorCallback: (editor, vista) => this.extraerNota(editor, vista),
        });
        this.addCommand({
            id: "extraer-tarea",
            name: "Extraer la selección a una tarea (con las etiquetas de proyecto)",
            editorCallback: (editor, vista) => this.extraerTarea(editor, vista),
        });
    }

    /** La carpeta de la bandeja: la de los ajustes o, vacía, la de las notas nuevas de Obsidian. */
    async bandeja(origen = "") {
        const propia = normalizePath(this.ajustes.bandeja || "/");
        const ruta = propia !== "/" ? propia : this.app.fileManager.getNewFileParent(origen).path;
        await this.asegurarCarpeta(ruta);
        return ruta;
    }

    async asegurarCarpeta(ruta) {
        if (ruta && ruta !== "/" && !this.app.vault.getAbstractFileByPath(ruta)) await this.app.vault.createFolder(ruta).catch(() => {});
    }

    /** El flujo completo de una nota tipada. */
    async notaTipada() {
        const a = this.ajustes;
        if (!a.tipos.length) return new Notice("No hay tipos de nota: añádelos en los ajustes de Notas tipadas.");
        const t = await elegir(
            this.app,
            a.tipos.map((t) => ({ etiqueta: `${t.emoji ? t.emoji + " " : ""}${t.etiqueta || t.id}`, valor: t, buscar: `${t.etiqueta} ${t.id}` })),
            "Tipo de nota",
            { esc: null },
        );
        if (!t) return;
        const etiqueta = t.etiqueta || t.id;
        const titulo = n.limpiarTitulo(await pedirTexto(this.app, `Título (${etiqueta}) — Enter = automático`));
        const destino = await this.destino(t);
        const m = n.marcas();
        const contenido = n.nota(t, a, { ...m, titulo: n.tituloFinal(titulo, etiqueta, m.hhmm) });
        const base = n.nombreBase({ titulo, etiqueta, ...m });
        const existe = (r) => Boolean(this.app.vault.getAbstractFileByPath(r));
        const origen = this.app.workspace.getActiveFile()?.path ?? "";

        let archivo = null;
        if (destino) {
            try {
                archivo = await this.app.vault.create(n.rutaLibre(destino, base, m.hhmmss, existe), contenido);
                new Notice(`📁 → ${destino}`);
            } catch (e) {
                console.error("[notas-tipadas]", e);
                new Notice(`⚠️ No se pudo mover a ${destino}: queda en la bandeja.`);
            }
        }
        if (!archivo) archivo = await this.app.vault.create(n.rutaLibre(await this.bandeja(origen), base, m.hhmmss, existe), contenido);
        await this.app.workspace.getLeaf(false).openFile(archivo, { state: { mode: "source" } });
    }

    /** ¿Dónde va? Siempre pregunta: la carpeta elegida, o null para la bandeja. */
    async destino(t) {
        const opciones = n.opcionesDestino(t.carpeta);
        let eleccion = await elegir(this.app, opciones, `Destino (${t.id})`);
        if (eleccion === n.OTRA) {
            const carpetas = n.carpetasVisibles(
                this.app.vault
                    .getAllLoadedFiles()
                    .filter((f) => f instanceof TFolder)
                    .map((f) => f.path),
                this.ajustes.ocultas,
            );
            eleccion = await elegir(this.app, carpetas.map((c) => ({ etiqueta: c, valor: c })), "Carpeta destino", { esc: n.BANDEJA });
        }
        if (!eleccion || eleccion === n.BANDEJA) return null;
        if (!this.app.vault.getAbstractFileByPath(eleccion)) {
            // Una carpeta nueva no nace en silencio: un destino mal escrito no deja carpetas fantasma.
            const crear = await elegir(
                this.app,
                [
                    { etiqueta: `✅ Sí, crear «${eleccion}» y mover aquí`, valor: "crear" },
                    { etiqueta: "📥 No: dejar en la bandeja", valor: n.BANDEJA },
                ],
                `La carpeta «${eleccion}» no existe. ¿Crearla?`,
                { esc: n.BANDEJA },
            );
            if (crear !== "crear") return null;
            await this.asegurarCarpeta(eleccion);
        }
        return eleccion;
    }

    /** La selección pasa a una nota nueva con el encabezado de esta, y en su lugar queda el enlace. */
    async extraerNota(editor, vista) {
        const nombre = n.limpiarTitulo(await pedirTexto(this.app, "Título de la nota nueva"));
        if (!nombre) return;
        const seleccion = editor.getSelection();
        const cabecera = n.encabezado(editor.getValue(), seleccion, this.ajustes.extraerNota);
        const carpeta = await this.bandeja(vista.file?.path ?? "");
        const ruta = this.app.vault.getAvailablePath(normalizePath(`${carpeta}/${nombre}`), "md");
        const archivo = await this.app.vault.create(ruta, cabecera + seleccion);
        editor.replaceSelection(`[[${archivo.basename}]]`);
    }

    /** La selección pasa a una nota de tarea que hereda las etiquetas de proyecto de esta (y sale de aquí). */
    async extraerTarea(editor, vista) {
        const x = this.ajustes.extraerTarea;
        const seleccion = editor.getSelection();
        const cache = vista.file ? this.app.metadataCache.getFileCache(vista.file) : null;
        const heredadas = n.etiquetasHeredadas(cache ? getAllTags(cache) ?? [] : [], x.heredar);
        const m = n.marcas();
        const fm = n.frontmatter(this.ajustes.campos, {
            ...m,
            tipo: x.tipo,
            titulo: n.escalar(x.titulo),
            estado: x.estado,
            tags: n.listaEtiquetas(x.tipo, heredadas),
        });
        const carpeta = await this.bandeja(vista.file?.path ?? "");
        const ruta = this.app.vault.getAvailablePath(normalizePath(`${carpeta}/${n.limpiarTitulo(x.nombre) || x.tipo}`), "md");
        const archivo = await this.app.vault.create(ruta, fm + "\n" + seleccion);
        editor.replaceSelection("");
        new Notice(`✅ → ${archivo.basename}`);
    }
}

/**
 * Elige entre opciones { etiqueta, valor, buscar? } (búsqueda sin mayúsculas ni tildes). Esc devuelve `esc` si se da;
 * si no, el valor de la primera opción (la de Enter).
 */
function elegir(app, opciones, titulo, { esc } = {}) {
    return new Promise((resolver) => {
        if (!opciones.length) return resolver(esc === undefined ? null : esc);
        let elegido = false;
        const modal = new (class extends SuggestModal {
            getSuggestions(consulta) {
                const q = n.normalizar(consulta);
                return opciones.filter((o) => n.normalizar(o.buscar ?? o.etiqueta).includes(q) || n.normalizar(o.etiqueta).includes(q));
            }
            renderSuggestion(o, el) {
                el.setText(o.etiqueta);
            }
            onChooseSuggestion(o) {
                elegido = true;
                resolver(o.valor);
            }
            onClose() {
                // onChooseSuggestion llega después de onClose: se espera un instante antes de dar el valor de Esc.
                setTimeout(() => elegido || resolver(esc === undefined ? opciones[0].valor : esc), 0);
            }
        })(app);
        modal.setPlaceholder(titulo);
        modal.open();
    });
}

/** Una línea de texto: Enter la da, Esc da "". */
function pedirTexto(app, titulo) {
    return new Promise((resolver) => {
        let valor = "";
        const modal = new Modal(app);
        modal.setTitle(titulo);
        const entrada = modal.contentEl.createEl("input", { type: "text", cls: "notas-tipadas-entrada" });
        entrada.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.isComposing) {
                e.preventDefault();
                valor = entrada.value;
                modal.close();
            }
        });
        modal.onClose = () => resolver(valor);
        modal.open();
        setTimeout(() => entrada.focus(), 0);
    });
}

class PestanaNotasTipadas extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        const a = this.plugin.ajustes;
        const guardar = () => this.plugin.saveData(a);
        containerEl.empty();
        containerEl.createEl("p", {
            cls: "setting-item-description",
            text: "Órdenes: «Nota tipada nueva», «Extraer la selección a una nota» y «Extraer la selección a una tarea» (asígnales atajos en Ajustes → Atajos).",
        });
        const texto = (el, obj, clave, nombre, desc) =>
            new Setting(el).setName(nombre).setDesc(desc).addText((t) => t.setValue(obj[clave] ?? "").onChange(async (v) => ((obj[clave] = v), await guardar())));
        const area = (el, nombre, desc, valor, alCambiar, filas = 6) =>
            new Setting(el).setName(nombre).setDesc(desc).addTextArea((t) => {
                t.inputEl.rows = filas;
                t.inputEl.addClass("notas-tipadas-area");
                t.setValue(valor).onChange(async (v) => (alCambiar(v), await guardar()));
            });

        new Setting(containerEl).setName("Toda nota").setHeading();
        area(
            containerEl,
            "Campos del frontmatter",
            "Uno por línea, «clave: valor», antes de los campos propios del tipo. Variables: {id} {tipo} {titulo} {estado} {fecha} {hora} {tags} (la primera etiqueta es el tipo).",
            a.campos,
            (v) => (a.campos = v),
            9,
        );
        texto(containerEl, a, "titular", "Encabezado", "La primera línea tras el frontmatter. Variables: {emoji} {titulo} {etiqueta} {tipo} {fecha} {hora}. Vacío = sin encabezado.");
        texto(containerEl, a, "bandeja", "Bandeja", "Donde queda la nota si no se archiva, y donde nacen las extracciones. Vacía = la carpeta de notas nuevas de Obsidian.");
        area(
            containerEl,
            "Carpetas ocultas al elegir",
            "Una por línea. Son prefijos: «meta» oculta meta y lo que cuelga de ella; «scripts_» oculta toda carpeta que empiece así.",
            a.ocultas.join("\n"),
            (v) => (a.ocultas = v.split("\n").map((l) => l.trim()).filter(Boolean)),
        );

        new Setting(containerEl).setName("Tipos").setHeading();
        a.tipos.forEach((t, i) => {
            const caja = containerEl.createEl("details", { cls: "notas-tipadas-tipo" });
            caja.createEl("summary", { text: `${t.emoji ? t.emoji + " " : ""}${t.etiqueta || t.id}${t.carpeta ? `  → ${t.carpeta}` : ""}` });
            texto(caja, t, "id", "Identificador", "Único; se muestra al preguntar el destino.");
            texto(caja, t, "etiqueta", "Nombre", "El de la lista y el del nombre de archivo cuando no hay título.");
            texto(caja, t, "emoji", "Emoji", "Para el encabezado ({emoji}).");
            texto(caja, t, "tipo", "Tipo declarado", "El campo `tipo` del frontmatter. Vacío = el identificador.");
            texto(caja, t, "estado", "Estado", "El campo `estado` del frontmatter.");
            texto(caja, t, "carpeta", "Carpeta sugerida", "La que se propone al crearla (siempre se pregunta). Vacía = la bandeja.");
            area(caja, "Campos propios", "Uno por línea, «clave: valor»; van tras los comunes.", n.escribirCampos(t.extra), (v) => (t.extra = n.leerCampos(v)), 4);
            area(caja, "Cuerpo", "Tras el encabezado. Variables: {fecha} {hora} {titulo} {tipo}.", t.cuerpo ?? "", (v) => (t.cuerpo = v), 10);
            new Setting(caja)
                .addButton((b) =>
                    b.setButtonText("Subir").setDisabled(i === 0).onClick(async () => {
                        a.tipos.splice(i - 1, 0, a.tipos.splice(i, 1)[0]);
                        await guardar();
                        this.display();
                    }),
                )
                .addButton((b) =>
                    b.setButtonText("Quitar este tipo").setWarning().onClick(async () => {
                        a.tipos.splice(i, 1);
                        await guardar();
                        this.display();
                    }),
                );
        });
        new Setting(containerEl).addButton((b) =>
            b.setButtonText("Añadir un tipo").onClick(async () => {
                a.tipos.push(TIPO(`tipo-${Date.now().toString(36)}`, "Nuevo", "📝", "bandeja", {}, "- "));
                await guardar();
                this.display();
            }),
        );

        new Setting(containerEl).setName("Extraer a una nota").setHeading();
        texto(containerEl, a.extraerNota, "marca", "Fin del encabezado", "La nueva nota copia la actual hasta esta línea (y la línea en blanco que la sigue). Sin ella en la nota, no hay encabezado.");
        texto(containerEl, a.extraerNota, "campo", "Campo de la página", "El campo en línea «<campo>:: » que toma la página de la anotación de Zotero (…?page=N&annotation=…).");

        new Setting(containerEl).setName("Extraer a una tarea").setHeading();
        texto(containerEl, a.extraerTarea, "nombre", "Nombre del archivo", "En la bandeja; si existe, «<nombre> 1», «<nombre> 2»…");
        texto(containerEl, a.extraerTarea, "titulo", "Título", "El campo `titulo`.");
        texto(containerEl, a.extraerTarea, "tipo", "Tipo", "El campo `tipo` y la primera etiqueta.");
        texto(containerEl, a.extraerTarea, "estado", "Estado", "El campo `estado`.");
        new Setting(containerEl)
            .setName("Etiquetas que hereda")
            .setDesc("Prefijos separados por comas. La tarea hereda las etiquetas de la nota que empiezan así, escritas con el primero («proyecto, project»: project/x → proyecto/x).")
            .addText((t) =>
                t.setValue(a.extraerTarea.heredar.join(", ")).onChange(async (v) => {
                    a.extraerTarea.heredar = v.split(",").map((p) => p.trim()).filter(Boolean);
                    await guardar();
                }),
            );
    }
}
