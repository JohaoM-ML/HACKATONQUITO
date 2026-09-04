/**
 * VENTANA SECA — router hash + vistas por rol (iOS)
 * Rutas:
 *   #/                  elegir rol
 *   #/brigada/cola
 *   #/brigada/mis
 *   #/brigada/ajustes
 *   #/brigada/detalle/:id
 *   #/jefe/resumen
 *   #/jefe/cola
 *   #/jefe/avisos
 *   #/jefe/ajustes
 */
(function () {
  "use strict";

  let COLA = null;
  let COUNTS = {};
  let estadoFilter = "pendientes";
  let searchTerm = "";
  let jefeFiltro = "A";
  let nrecValue = 1;
  let toastTimer = null;
  let detailId = null;

  const $ = (id) => document.getElementById(id);

  function parseHash() {
    const raw = (location.hash || "#/").replace(/^#/, "") || "/";
    const parts = raw.split("/").filter(Boolean);
    return { parts, path: "/" + parts.join("/") };
  }

  function go(path) {
    location.hash = path.startsWith("#") ? path : "#" + path;
  }

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function inicial(n) {
    return (n || "?").trim().charAt(0).toUpperCase();
  }

  function avatarClass(p) {
    if (p <= 2) return "p1";
    if (p <= 4) return "p2";
    return "p3";
  }

  function visitado(id) {
    return (COUNTS[id] || 0) > 0;
  }

  async function refreshCounts() {
    const predios = await VS.todosPredios();
    COUNTS = {};
    predios.forEach((p) => {
      COUNTS[p.barrioId] = (COUNTS[p.barrioId] || 0) + 1;
    });
    return predios;
  }

  function setNav(title, backPath) {
    $("nav-title").textContent = title || "";
    const back = $("nav-back");
    if (backPath) {
      back.classList.add("show");
      back.onclick = () => go(backPath);
    } else {
      back.classList.remove("show");
      back.onclick = null;
    }
  }

  function setTabs(rol, active) {
    const bar = $("tabbar");
    if (!rol) {
      bar.classList.add("hidden");
      bar.innerHTML = "";
      return;
    }
    bar.classList.remove("hidden");
    const tabs =
      rol === "brigadista"
        ? [
            { id: "cola", label: "Cola", href: "#/brigada/cola", icon: "i-list" },
            { id: "mis", label: "Mis registros", href: "#/brigada/mis", icon: "i-doc" },
            { id: "ajustes", label: "Ajustes", href: "#/brigada/ajustes", icon: "i-gear" },
          ]
        : [
            { id: "resumen", label: "Resumen", href: "#/jefe/resumen", icon: "i-chart" },
            { id: "cola", label: "Cola", href: "#/jefe/cola", icon: "i-list" },
            { id: "avisos", label: "Avisos", href: "#/jefe/avisos", icon: "i-wa" },
            { id: "ajustes", label: "Ajustes", href: "#/jefe/ajustes", icon: "i-gear" },
          ];
    bar.innerHTML = tabs
      .map(
        (t) =>
          '<a class="tab' +
          (t.id === active ? " active" : "") +
          '" href="' +
          t.href +
          '"><svg><use href="#' +
          t.icon +
          '"/></svg>' +
          t.label +
          "</a>"
      )
      .join("");
  }

  function hideAllViews() {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    $("detail").classList.remove("show");
    detailId = null;
  }

  function showView(id) {
    hideAllViews();
    const el = $(id);
    if (el) el.classList.add("active");
  }

  /* ---------- ROLE ---------- */
  function renderRole() {
    setNav("VENTANA SECA", null);
    setTabs(null);
    showView("view-role");
  }

  /* ---------- BRIGADA COLA ---------- */
  function matchesFilters(b) {
    const v = visitado(b.id);
    if (estadoFilter === "pendientes" && v) return false;
    if (estadoFilter === "visitados" && !v) return false;
    if (searchTerm && !b.nombre.toLowerCase().includes(searchTerm)) return false;
    return true;
  }

  function renderBrigadaCola() {
    if (!COLA) return;
    setNav("Cola", null);
    setTabs("brigadista", "cola");
    showView("view-brigada-cola");

    const items = VS.colaBrigada(COLA);
    const done = items.filter((b) => visitado(b.id)).length;
    $("rc-count").textContent = done + " / " + items.length;
    $("progressFill").style.width = (items.length ? (done / items.length) * 100 : 0) + "%";
    $("banner-cola").innerHTML =
      "Corte <strong>8 feb 2026</strong> · duración <strong>11–16 h</strong> (rango reportado). " +
      (items.length - done) +
      " de " +
      items.length +
      " barrios A sin predio en este dispositivo.";

    const list = $("lista-brigada");
    const visibles = items.filter(matchesFilters);
    if (!visibles.length) {
      list.innerHTML = '<p class="empty">Nada en este filtro.</p>';
      return;
    }
    list.innerHTML =
      '<div class="group">' +
      visibles
        .map((b, i) => {
          const v = visitado(b.id);
          return (
            '<button type="button" class="row with-avatar' +
            (i ? " row-sep" : "") +
            '" data-open="' +
            b.id +
            '">' +
            '<span class="avatar ' +
            avatarClass(b.prioridad) +
            '">' +
            inicial(b.nombre) +
            (v ? '<span class="check">✓</span>' : "") +
            "</span>" +
            '<span class="info"><span class="name">' +
            b.nombre +
            '</span><span class="meta"><span>' +
            VS.formatDuracion(b) +
            " · " +
            (b.zona || "") +
            '</span><span class="badge">Regla ' +
            b.regla +
            "</span></span></span>" +
            '<span class="chev">›</span></button>'
          );
        })
        .join("") +
      "</div>";
  }

  async function openDetail(id) {
    if (!COLA) return;
    const b = COLA.barrios.find((x) => x.id === id);
    if (!b) return;
    detailId = id;
    nrecValue = 1;
    $("nrecVal").textContent = nrecValue;
    $("d-name").textContent = b.nombre;
    $("d-tag-time").textContent = VS.formatDuracion(b) + " · " + (b.zona || "");
    $("d-tag-regla").textContent = "Regla " + b.regla + " · prioridad " + b.prioridad;
    $("d-just").textContent = b.justificacion;
    $("d-trace").innerHTML =
      "<span>origen: " +
      VS.origenLabel(b.origen_dato) +
      "</span><span>confianza: " +
      (b.confianza || "unknown") +
      "</span>" +
      (b.incertidumbre && b.incertidumbre.length
        ? "<span>incertidumbre: " + b.incertidumbre.join(", ") + "</span>"
        : "");
    const fu = $("d-fuente");
    if (b.fuente_url) {
      fu.innerHTML =
        'Fuente observada: <a href="' +
        b.fuente_url +
        '" target="_blank" rel="noopener">' +
        (b.fuente || "ver enlace") +
        "</a>";
    } else {
      fu.textContent = "Fuente: " + (b.fuente || "unknown");
    }
    setNav(b.nombre, "#/brigada/cola");
    setTabs("brigadista", "cola");
    showView("view-brigada-cola");
    $("detail").classList.add("show");
    await refreshVisitadosDetail();
  }

  async function refreshVisitadosDetail() {
    const ul = $("visitados");
    ul.innerHTML = "";
    if (!detailId) return;
    const rows = await VS.prediosPorBarrio(detailId);
    if (!rows.length) {
      ul.innerHTML = "<li>Ningún predio registrado aún</li>";
      return;
    }
    rows.forEach((p) => {
      const li = document.createElement("li");
      li.textContent =
        (p.casa || "Casa") +
        " · " +
        p.n +
        " " +
        (p.tipo || "").toLowerCase() +
        " · " +
        (p.larva ? "con larva" : "sin larva") +
        (p.sincronizado ? " · sync" : " · sin red");
      ul.appendChild(li);
    });
  }

  /* ---------- MIS REGISTROS ---------- */
  async function renderMis() {
    setNav("Mis registros", null);
    setTabs("brigadista", "mis");
    showView("view-mis");
    const predios = await VS.todosPredios();
    const box = $("lista-mis");
    if (!predios.length) {
      box.innerHTML = '<p class="empty">Aún no registraste predios en este dispositivo.</p>';
      return;
    }
    predios.sort((a, b) => b.ts - a.ts);
    box.innerHTML =
      '<div class="group">' +
      predios
        .map((p, i) => {
          const fecha = new Date(p.ts).toLocaleString("es-EC", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            '<div class="row' +
            (i ? " row-sep" : "") +
            '"><span class="info"><span class="name">' +
            (p.barrioNombre || p.barrioId) +
            '</span><span class="meta">' +
            (p.casa || "Sin dirección") +
            " · " +
            p.n +
            " " +
            (p.tipo || "").toLowerCase() +
            " · " +
            fecha +
            "</span></span></div>"
          );
        })
        .join("") +
      "</div>";
  }

  /* ---------- JEFE RESUMEN ---------- */
  async function renderJefeResumen() {
    setNav("Resumen", null);
    setTabs("jefe", "resumen");
    showView("view-jefe-resumen");
    const predios = await refreshCounts();
    const aItems = VS.colaBrigada(COLA);
    const visitadosA = aItems.filter((b) => visitado(b.id)).length;
    $("kpi-cov").textContent = visitadosA + " / " + aItems.length;
    $("kpi-pred").textContent = String(predios.length);
    $("kpi-regla").textContent = "A";

    const d = COLA.contexto_cantonal && COLA.contexto_cantonal.dengue;
    $("nota-d").innerHTML =
      "<strong>Regla D:</strong> tendencia " +
      (d ? d.tendencia : "unknown") +
      ". " +
      (d ? d.nota : "") +
      " Geografía: " +
      (d && d.geografia ? d.geografia : "unknown") +
      " · no define barrio.";
    $("nota-modelo").textContent = COLA.nota_modelo || "";
    const lluvia = COLA.contexto_cantonal && COLA.contexto_cantonal.lluvia;
    $("nota-c").textContent = (lluvia && lluvia.regla_c_razon) || "C sin ítems.";
    $("meta-jefe").textContent =
      COLA.canton + " · evaluación " + COLA.generado_en + " · " + COLA.empresa_agua;
  }

  /* ---------- JEFE COLA ---------- */
  function renderJefeCola() {
    setNav("Cola", null);
    setTabs("jefe", "cola");
    showView("view-jefe-cola");

    let rows = COLA.barrios || [];
    if (jefeFiltro === "A") rows = rows.filter((b) => b.regla === "A");
    else if (jefeFiltro === "B") rows = rows.filter((b) => b.regla === "B");

    document.querySelectorAll("#filtros-jefe button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.f === jefeFiltro);
    });

    const box = $("lista-jefe");
    if (!rows.length) {
      box.innerHTML = '<p class="empty">Sin ítems.</p>';
      return;
    }
    box.innerHTML =
      '<div class="group">' +
      rows
        .map((b, i) => {
          const n = COUNTS[b.id] || 0;
          return (
            '<div class="row with-avatar' +
            (i ? " row-sep" : "") +
            '">' +
            '<span class="avatar ' +
            avatarClass(b.prioridad) +
            '">' +
            inicial(b.nombre) +
            "</span>" +
            '<span class="info"><span class="name">' +
            b.nombre +
            '</span><span class="meta"><span>#' +
            b.prioridad +
            " · " +
            VS.formatDuracion(b) +
            '</span><span class="badge' +
            (b.regla === "B" ? " b" : "") +
            '">Regla ' +
            b.regla +
            (b.hipotesis ? " *" : "") +
            "</span><span>" +
            (n ? n + " predio(s)" : "Sin visita") +
            "</span></span>" +
            '<span style="display:block;font-size:12px;color:var(--ios-label-2);margin-top:4px">' +
            b.justificacion +
            "</span></span></div>"
          );
        })
        .join("") +
      "</div>";

    if (jefeFiltro === "B" || jefeFiltro === "all") {
      $("nota-b-jefe").style.display = "block";
    } else {
      $("nota-b-jefe").style.display = "none";
    }
  }

  /* ---------- AVISOS WHATSAPP ---------- */
  function renderAvisos() {
    setNav("Avisos", null);
    setTabs("jefe", "avisos");
    showView("view-avisos");
    const items = VS.colaBrigada(COLA);
    const box = $("lista-avisos");
    if (!items.length) {
      box.innerHTML = '<p class="empty">No hay barrios A para avisar.</p>';
      return;
    }
    box.innerHTML = items
      .map((b) => {
        const msg = VS.mensajeWhatsApp(b);
        const url = VS.waMeUrl(msg);
        return (
          '<div class="aviso-card" data-id="' +
          b.id +
          '">' +
          "<h3>" +
          b.nombre +
          "</h3>" +
          '<p class="msg">' +
          msg +
          "</p>" +
          '<div class="btn-row">' +
          '<a href="' +
          url +
          '" target="_blank" rel="noopener">Enviar por WhatsApp</a>' +
          '<button type="button" class="copy" data-copy="' +
          b.id +
          '">Copiar</button>' +
          "</div></div>"
        );
      })
      .join("");
  }

  /* ---------- AJUSTES ---------- */
  function renderAjustes(rol) {
    setNav("Ajustes", null);
    setTabs(rol, "ajustes");
    showView("view-ajustes");
    $("ajustes-rol").textContent = rol === "jefe" ? "Jefe de brigada" : "Brigadista";
    $("ajustes-meta").textContent = COLA
      ? "Cola " + COLA.generado_en + " · " + (COLA.modelo || "")
      : "";
  }

  /* ---------- ROUTER ---------- */
  async function route() {
    const { parts } = parseHash();
    const rol = VS.getRol();

    if (!parts.length || parts[0] === "") {
      if (rol === "brigadista") return go("/brigada/cola");
      if (rol === "jefe") return go("/jefe/resumen");
      return renderRole();
    }

    if (parts[0] === "brigada") {
      if (rol !== "brigadista") {
        VS.setRol(null);
        return go("/");
      }
      if (parts[1] === "cola" && parts[2] === "detalle" && parts[3]) {
        renderBrigadaCola();
        return openDetail(parts[3]);
      }
      if (parts[1] === "detalle" && parts[2]) {
        renderBrigadaCola();
        return openDetail(parts[2]);
      }
      if (parts[1] === "mis") return renderMis();
      if (parts[1] === "ajustes") return renderAjustes("brigadista");
      return renderBrigadaCola();
    }

    if (parts[0] === "jefe") {
      if (rol !== "jefe") {
        VS.setRol(null);
        return go("/");
      }
      if (parts[1] === "cola") return renderJefeCola();
      if (parts[1] === "avisos") return renderAvisos();
      if (parts[1] === "ajustes") return renderAjustes("jefe");
      return renderJefeResumen();
    }

    go("/");
  }

  /* ---------- EVENTS ---------- */
  function bind() {
    $("btn-rol-brigada").addEventListener("click", () => {
      VS.setRol("brigadista");
      go("/brigada/cola");
    });
    $("btn-rol-jefe").addEventListener("click", () => {
      VS.setRol("jefe");
      go("/jefe/resumen");
    });
    $("btn-cambiar-rol").addEventListener("click", () => {
      VS.setRol(null);
      go("/");
    });

    $("segmented").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-estado]");
      if (!btn) return;
      estadoFilter = btn.dataset.estado;
      document.querySelectorAll("#segmented button").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      renderBrigadaCola();
    });

    $("buscar").addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderBrigadaCola();
    });

    $("lista-brigada").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open]");
      if (!btn) return;
      go("/brigada/detalle/" + btn.dataset.open);
    });

    $("nrec-minus").addEventListener("click", () => {
      nrecValue = Math.max(0, nrecValue - 1);
      $("nrecVal").textContent = nrecValue;
    });
    $("nrec-plus").addEventListener("click", () => {
      nrecValue += 1;
      $("nrecVal").textContent = nrecValue;
    });

    $("tipos").addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") return;
      [...e.currentTarget.children].forEach((b) => b.setAttribute("aria-pressed", b === e.target));
    });
    $("larva").addEventListener("click", (e) => {
      if (e.target.tagName !== "BUTTON") return;
      [...e.currentTarget.children].forEach((b) => b.setAttribute("aria-pressed", b === e.target));
    });

    $("guardar").addEventListener("click", async () => {
      if (!detailId || !COLA) return;
      const b = COLA.barrios.find((x) => x.id === detailId);
      const casa = $("casa").value.trim();
      const tipo = [...$("tipos").querySelectorAll("button")].find(
        (x) => x.getAttribute("aria-pressed") === "true"
      ).textContent;
      const larva =
        [...$("larva").querySelectorAll("button")].find(
          (x) => x.getAttribute("aria-pressed") === "true"
        ).textContent === "Sí";
      await VS.savePredio({
        barrioId: detailId,
        barrioNombre: b ? b.nombre : detailId,
        casa: casa || "Sin dirección",
        n: nrecValue,
        tipo,
        larva,
        origen: "brigada_campo",
      });
      $("casa").value = "";
      nrecValue = 1;
      $("nrecVal").textContent = nrecValue;
      await refreshCounts();
      await refreshVisitadosDetail();
      showToast(navigator.onLine ? "Predio guardado" : "Guardado sin red");
    });

    $("filtros-jefe").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-f]");
      if (!btn) return;
      jefeFiltro = btn.dataset.f;
      renderJefeCola();
    });

    $("lista-avisos").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-copy]");
      if (!btn || !COLA) return;
      const b = COLA.barrios.find((x) => x.id === btn.dataset.copy);
      if (!b) return;
      const msg = VS.mensajeWhatsApp(b);
      try {
        await navigator.clipboard.writeText(msg);
        showToast("Mensaje copiado");
      } catch (_) {
        showToast("No se pudo copiar");
      }
    });

    window.addEventListener("hashchange", () => {
      route().catch((err) => {
        console.error(err);
        $("error").classList.add("on");
        $("error").textContent = err.message || String(err);
      });
    });
  }

  async function boot() {
    VS.setupOfflineUI();
    VS.registerSW();
    bind();
    try {
      const { data } = await VS.loadCola();
      COLA = data;
      await refreshCounts();
      $("error").classList.remove("on");
      await route();
    } catch (err) {
      $("error").classList.add("on");
      $("error").textContent = err.message || String(err);
      renderRole();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
