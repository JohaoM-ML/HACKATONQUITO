/**
 * VENTANA SECA — app compartida: cola + IndexedDB + offline
 */
(function (global) {
  "use strict";

  const DB_NAME = "ventana-seca";
  const DB_VER = 1;
  const STORE_COLA = "cola";
  const STORE_PREDIOS = "predios";
  const URL_COLA = "./data/cola.json";

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_COLA)) {
          db.createObjectStore(STORE_COLA);
        }
        if (!db.objectStoreNames.contains(STORE_PREDIOS)) {
          const s = db.createObjectStore(STORE_PREDIOS, { keyPath: "id", autoIncrement: true });
          s.createIndex("barrioId", "barrioId", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(store, key, value) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          const req = key != null ? tx.objectStore(store).put(value, key) : tx.objectStore(store).put(value);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function idbGet(store, key) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).get(key);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  }

  function idbGetAll(store) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        })
    );
  }

  async function loadCola() {
    try {
      const res = await fetch(URL_COLA, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      await idbPut(STORE_COLA, "latest", data);
      return { data, from: "red" };
    } catch (err) {
      const cached = await idbGet(STORE_COLA, "latest");
      if (cached) return { data: cached, from: "cache" };
      throw new Error("No se pudo cargar cola.json ni hay copia local. " + (err.message || ""));
    }
  }

  async function savePredio(predio) {
    const row = {
      ...predio,
      ts: Date.now(),
      sincronizado: navigator.onLine,
    };
    const id = await idbPut(STORE_PREDIOS, null, row);
    return { ...row, id };
  }

  async function prediosPorBarrio(barrioId) {
    const all = await idbGetAll(STORE_PREDIOS);
    return all.filter((p) => p.barrioId === barrioId).sort((a, b) => b.ts - a.ts);
  }

  async function todosPredios() {
    return idbGetAll(STORE_PREDIOS);
  }

  function setupOfflineUI() {
    const banner = document.getElementById("offline-banner");
    const sync = document.getElementById("sync-banner");
    function paint() {
      if (banner) banner.classList.toggle("on", !navigator.onLine);
      if (sync && navigator.onLine) {
        // se muestra al reconectar vía evento
      }
    }
    window.addEventListener("offline", paint);
    window.addEventListener("online", async () => {
      paint();
      if (sync) {
        const n = (await todosPredios()).length;
        sync.textContent = "En línea · " + n + " predio(s) en este dispositivo";
        sync.classList.add("on");
        setTimeout(() => sync.classList.remove("on"), 4000);
      }
    });
    paint();
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch((e) => {
      console.warn("SW no registrado:", e.message);
    });
  }

  function origenLabel(origen) {
    if (!origen || !origen.length) return "unknown";
    return origen.join(" · ");
  }

  function formatDuracion(b) {
    if (b.duracion_horas) return b.duracion_horas + " h";
    if (b.duracion_horas_num != null) return b.duracion_horas_num + " h";
    return "duración unknown";
  }

  function colaBrigada(data) {
    const ids = new Set(data.cola_brigada || []);
    return (data.barrios || []).filter((b) => b.regla === "A" || ids.has(b.id));
  }

  function alertasB(data) {
    return (data.barrios || []).filter((b) => b.regla === "B");
  }

  global.VS = {
    loadCola,
    savePredio,
    prediosPorBarrio,
    todosPredios,
    setupOfflineUI,
    registerSW,
    origenLabel,
    formatDuracion,
    colaBrigada,
    alertasB,
    URL_COLA,
  };
})(window);
