import {
  inferirAccionesDesdeRecipientes,
  mergeAcciones,
  toggleAccion,
} from "./acciones";

const inferidas = inferirAccionesDesdeRecipientes([
  { tratado: "larvicida" },
  { tratado: "tapado" },
  { tratado: "ninguno" },
]);
if (!inferidas.includes("larvicida")) throw new Error("falta larvicida");
if (!inferidas.includes("eliminar_tapar")) throw new Error("falta eliminar_tapar");
if (inferidas.includes("malla")) throw new Error("malla no debe inferirse");

const toggled = toggleAccion(["larvicida"], "malla");
if (toggled.join(",") !== "larvicida,malla") throw new Error(`toggle: ${toggled}`);

const merged = mergeAcciones(["entrenar_hogar"], inferidas);
if (merged[0] !== "eliminar_tapar") throw new Error("orden de catálogo");
if (!merged.includes("entrenar_hogar") || !merged.includes("larvicida")) {
  throw new Error("merge incompleto");
}

console.log("acciones.test.ts ok");
