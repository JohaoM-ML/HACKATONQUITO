"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { celdaDesde, etiquetaMinizona } from "@/lib/geo/minizonas";
import {
  TIPOS_RECIPIENTE,
  USOS_RECIPIENTE,
  type EstadoVisita,
  type MotivoAlmacenamiento,
  type Recipiente,
  type TipoRecipiente,
  type UsoRecipiente,
} from "@/types";

type Props = {
  sectorId: string;
  sectorNombre: string;
  colaItemId: string | null;
  justificacion: string | null;
  accion: string | null;
  brigadistaId: string;
  brigadaId: string | null;
  /** Minizona preasignada desde la ruta (`?minizona=`). GPS puede confirmar u override. */
  minizonaId?: string | null;
  minizonaH3?: string | null;
  minizonaOrigen?: string | null;
};

const emptyRecip = (): Recipiente => ({
  tipo: "balde_tina",
  uso: "almacenamiento_consumo",
  capacidad_l: "20_100",
  tapado: "no",
  con_agua: true,
  ubicacion: "patio",
  positivo_larvas: false,
  positivo_pupas: false,
  n_pupas: null,
  tratado: "ninguno",
});

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div className={cn("grid gap-2", cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("chip text-center", value === o.value && "chip-active")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function InspeccionForm(props: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nivel 1 — si viene minizona por URL, se preliga; GPS puede confirmar u override
  const preligada = !!props.minizonaId;
  const [estadoVisita, setEstadoVisita] = useState<EstadoVisita>("inspeccionada");
  const [codigo, setCodigo] = useState("");
  const [manzana, setManzana] = useState("");
  const [gps, setGps] = useState<{ lat: number; lon: number; precision_m: number | null } | null>(null);
  const [gpsMsg, setGpsMsg] = useState("Sin GPS aún");
  const [h3, setH3] = useState<string | null>(props.minizonaH3 ?? null);
  const [minizonaId, setMinizonaId] = useState<string | null>(props.minizonaId ?? null);
  const [minizonaMsg, setMinizonaMsg] = useState<string | null>(() => {
    if (!props.minizonaH3) return null;
    const et = etiquetaMinizona(props.minizonaH3);
    return props.minizonaOrigen === "cerco"
      ? `${et} · cerco de un foco (asignada)`
      : `${et} · asignada a tu ruta`;
  });
  const [gpsOverride, setGpsOverride] = useState(false);

  // Nivel 2
  const [nHab, setNHab] = useState(4);
  const [conexion, setConexion] = useState(true);
  const [diasSinAgua, setDiasSinAgua] = useState(0);
  const [horasAgua, setHorasAgua] = useState<"menos_4" | "4_8" | "8_16" | "todo_el_dia">("4_8");
  const [almacena, setAlmacena] = useState(true);
  const [motivo, setMotivo] = useState<MotivoAlmacenamiento>("corte_programado");
  const [diasAlmacenada, setDiasAlmacenada] = useState(3);
  const [tanquero, setTanquero] = useState(false);

  // Nivel 3
  const [recipientes, setRecipientes] = useState<Recipiente[]>([emptyRecip()]);
  const [idxRec, setIdxRec] = useState(0);

  // Nivel 4
  const [educo, setEduco] = useState(true);
  const [material, setMaterial] = useState(false);
  const [reinspeccion, setReinspeccion] = useState(false);

  const actual = recipientes[idxRec];

  function patchRec(patch: Partial<Recipiente>) {
    setRecipientes((prev) => prev.map((r, i) => (i === idxRec ? { ...r, ...patch } : r)));
  }

  function capturarGps() {
    if (!navigator.geolocation) {
      setGpsMsg("GPS no disponible en este dispositivo");
      return;
    }
    setGpsMsg("Obteniendo…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGps({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          precision_m: pos.coords.accuracy,
        });
        setGpsMsg(`±${Math.round(pos.coords.accuracy)} m`);

        const celda = celdaDesde(pos.coords.latitude, pos.coords.longitude);

        // Si ya hay minizona preligada y el GPS cae en la misma celda → confirma.
        if (preligada && props.minizonaH3 && celda === props.minizonaH3) {
          setH3(props.minizonaH3);
          setMinizonaId(props.minizonaId ?? null);
          setGpsOverride(false);
          setMinizonaMsg(
            `${etiquetaMinizona(celda)}${
              props.minizonaOrigen === "cerco" ? " · cerco de un foco" : ""
            } · GPS confirma`
          );
          return;
        }

        // GPS en otra celda: override (sigue permitiendo guardar la visita real).
        setH3(celda);
        const { data } = await createClient()
          .from("minizonas")
          .select("id, origen")
          .eq("h3", celda)
          .maybeSingle();
        setMinizonaId(data?.id ?? null);
        setGpsOverride(preligada);
        setMinizonaMsg(
          data
            ? `${etiquetaMinizona(celda)}${data.origen === "cerco" ? " · cerco de un foco" : ""}${
                preligada ? " · GPS distinta a la asignada" : ""
              }`
            : `${etiquetaMinizona(celda)} · fuera de la malla${
                preligada ? " · GPS distinta a la asignada" : ""
              }`
        );
      },
      () => setGpsMsg("No se pudo obtener GPS"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  const puedeContinuar = useMemo(() => {
    if (paso === 1) return !!estadoVisita;
    return true;
  }, [paso, estadoVisita]);

  async function guardar() {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const visitaPayload = {
      sector_id: props.sectorId,
      minizona_id: minizonaId,
      h3,
      cola_item_id: props.colaItemId,
      brigadista_id: props.brigadistaId,
      brigada_id: props.brigadaId,
      estado_visita: estadoVisita,
      codigo_vivienda: codigo || null,
      manzana: manzana || null,
      lat: gps?.lat ?? null,
      lon: gps?.lon ?? null,
      precision_m: gps?.precision_m ?? null,
      n_habitantes: estadoVisita === "inspeccionada" ? nHab : null,
      tiene_conexion_red: estadoVisita === "inspeccionada" ? conexion : null,
      dias_sin_agua_ultima_semana: estadoVisita === "inspeccionada" ? diasSinAgua : null,
      horas_agua_por_dia: estadoVisita === "inspeccionada" ? horasAgua : null,
      almacena_agua: estadoVisita === "inspeccionada" ? almacena : null,
      motivo_almacenamiento: estadoVisita === "inspeccionada" ? (almacena ? motivo : "no_aplica") : null,
      dias_almacenada: estadoVisita === "inspeccionada" && almacena ? diasAlmacenada : null,
      recibio_tanquero: estadoVisita === "inspeccionada" ? tanquero : null,
      se_educo_hogar: educo,
      material_entregado: material,
      requiere_reinspeccion: reinspeccion,
    };

    const { data: visita, error: vErr } = await supabase
      .from("visitas")
      .insert(visitaPayload)
      .select("id")
      .single();

    if (vErr || !visita) {
      setError(vErr?.message || "No se guardó la visita");
      setSaving(false);
      return;
    }

    if (estadoVisita === "inspeccionada" && recipientes.length) {
      const rows = recipientes.map((r) => ({
        visita_id: visita.id,
        tipo: r.tipo,
        uso: r.uso,
        capacidad_l: r.capacidad_l,
        tapado: r.tapado,
        con_agua: r.con_agua,
        ubicacion: r.ubicacion,
        positivo_larvas: r.positivo_larvas,
        positivo_pupas: r.positivo_pupas,
        n_pupas: r.positivo_pupas ? r.n_pupas : null,
        tratado: r.tratado,
      }));
      const { error: rErr } = await supabase.from("recipientes").insert(rows);
      if (rErr) {
        setError(rErr.message);
        setSaving(false);
        return;
      }

      // Foco confirmado: se abren las minizonas vecinas (~225 m) como pendientes.
      const hayFoco = recipientes.some((r) => r.positivo_larvas || r.positivo_pupas);
      if (hayFoco && h3) {
        await fetch("/api/minizonas/cerco", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visita_id: visita.id }),
        }).catch(() => null);
      }
    }

    router.push("/ruta");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="font-heading text-lg font-bold">{props.sectorNombre}</p>
        {preligada && props.minizonaH3 && (
          <p className="mt-1 text-sm font-semibold text-primary">
            Minizona {etiquetaMinizona(props.minizonaH3)}
            {props.minizonaOrigen === "cerco" ? " · cerco ~225 m" : " · celda ~160 m"}
          </p>
        )}
        {props.accion && <p className="mt-1 text-sm font-medium text-primary">{props.accion}</p>}
        {props.justificacion && (
          <p className="mt-2 text-xs leading-relaxed text-ios-label-2">{props.justificacion}</p>
        )}
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4].map((p) => (
            <div
              key={p}
              className={cn("h-1.5 flex-1 rounded-full", p <= paso ? "bg-primary" : "bg-ios-fill")}
            />
          ))}
        </div>
        <p className="mt-1 text-[11px] text-ios-label-3">
          Paso {paso}/4 · {["Visita", "Hogar", "Recipientes", "Acción"][paso - 1]}
        </p>
      </div>

      {paso === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label-field">Estado de la visita (obligatorio)</label>
            <ChipGroup
              cols={2}
              value={estadoVisita}
              onChange={setEstadoVisita}
              options={[
                { value: "inspeccionada", label: "Inspeccionada" },
                { value: "cerrada", label: "Cerrada" },
                { value: "renuente", label: "Renuente" },
                { value: "deshabitada", label: "Deshabitada" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">Código vivienda</label>
            <input className="input-field" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej. M3-12" />
          </div>
          <div>
            <label className="label-field">Manzana (opcional)</label>
            <input className="input-field" value={manzana} onChange={(e) => setManzana(e.target.value)} />
          </div>
          <button type="button" className="btn-secondary" onClick={capturarGps}>
            {preligada ? "Confirmar / actualizar GPS" : "Capturar GPS"} · {gpsMsg}
          </button>
          {minizonaMsg && (
            <p className="text-xs text-ios-label-2">
              Minizona <span className="font-semibold">{minizonaMsg}</span>
            </p>
          )}
          {gpsOverride && (
            <p className="text-[11px] text-ios-orange">
              El GPS cayó en otra celda: se usará esa ubicación al guardar (override).
            </p>
          )}
          {preligada && !gps && (
            <p className="text-[11px] text-ios-label-3">
              La visita ya está ligada a esta minizona. Capturá GPS para confirmar o corregir.
            </p>
          )}
        </div>
      )}

      {paso === 2 && estadoVisita === "inspeccionada" && (
        <div className="space-y-4">
          <div>
            <label className="label-field">Nº habitantes: {nHab}</label>
            <input
              type="range"
              min={1}
              max={15}
              value={nHab}
              onChange={(e) => setNHab(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="label-field">¿Tiene conexión a red?</label>
            <ChipGroup
              value={conexion ? "si" : "no"}
              onChange={(v) => setConexion(v === "si")}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">Días sin agua (última semana): {diasSinAgua}</label>
            <input
              type="range"
              min={0}
              max={7}
              value={diasSinAgua}
              onChange={(e) => setDiasSinAgua(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="label-field">Horas de agua por día</label>
            <ChipGroup
              value={horasAgua}
              onChange={setHorasAgua}
              options={[
                { value: "menos_4", label: "<4 h" },
                { value: "4_8", label: "4–8 h" },
                { value: "8_16", label: "8–16 h" },
                { value: "todo_el_dia", label: "Todo el día" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">¿Almacena agua?</label>
            <ChipGroup
              value={almacena ? "si" : "no"}
              onChange={(v) => setAlmacena(v === "si")}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          {almacena && (
            <>
              <div>
                <label className="label-field">Motivo de almacenamiento</label>
                <ChipGroup
                  value={motivo}
                  onChange={setMotivo}
                  options={[
                    { value: "corte_programado", label: "Corte programado" },
                    { value: "corte_emergente", label: "Corte emergente" },
                    { value: "presion_baja", label: "Presión baja" },
                    { value: "costumbre", label: "Costumbre" },
                  ]}
                />
              </div>
              <div>
                <label className="label-field">Días con agua almacenada: {diasAlmacenada}</label>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={diasAlmacenada}
                  onChange={(e) => setDiasAlmacenada(Number(e.target.value))}
                  className="w-full"
                />
                {diasAlmacenada >= 7 && (
                  <p className="mt-1 text-xs font-semibold text-ios-orange">
                    ≥7 días ≈ ciclo huevo→adulto de Aedes
                  </p>
                )}
              </div>
            </>
          )}
          <div>
            <label className="label-field">¿Recibió tanquero?</label>
            <ChipGroup
              value={tanquero ? "si" : "no"}
              onChange={(v) => setTanquero(v === "si")}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
        </div>
      )}

      {paso === 2 && estadoVisita !== "inspeccionada" && (
        <p className="card text-sm text-ios-label-2">
          Visita no inspeccionada: se salta el contexto del hogar y los recipientes. Solo se registra el
          estado (denominador LIRAa).
        </p>
      )}

      {paso === 3 && estadoVisita === "inspeccionada" && actual && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-heading font-bold">
              Recipiente {idxRec + 1}/{recipientes.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="chip"
                disabled={idxRec === 0}
                onClick={() => setIdxRec((i) => Math.max(0, i - 1))}
              >
                ←
              </button>
              <button
                type="button"
                className="chip"
                disabled={idxRec >= recipientes.length - 1}
                onClick={() => setIdxRec((i) => Math.min(recipientes.length - 1, i + 1))}
              >
                →
              </button>
            </div>
          </div>

          <div>
            <label className="label-field">Tipo</label>
            <ChipGroup
              cols={2}
              value={actual.tipo}
              onChange={(v: TipoRecipiente) => patchRec({ tipo: v })}
              options={TIPOS_RECIPIENTE}
            />
          </div>
          <div>
            <label className="label-field">Uso</label>
            <ChipGroup
              value={actual.uso}
              onChange={(v: UsoRecipiente) => patchRec({ uso: v })}
              options={USOS_RECIPIENTE}
            />
          </div>
          <div>
            <label className="label-field">Capacidad</label>
            <ChipGroup
              value={actual.capacidad_l as string}
              onChange={(v) => patchRec({ capacidad_l: v })}
              options={[
                { value: "menos_20", label: "<20 L" },
                { value: "20_100", label: "20–100" },
                { value: "100_500", label: "100–500" },
                { value: "mas_500", label: ">500 L" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">Tapado</label>
            <ChipGroup
              cols={3}
              value={actual.tapado}
              onChange={(v) => patchRec({ tapado: v as Recipiente["tapado"] })}
              options={[
                { value: "si", label: "Sí" },
                { value: "parcial", label: "Parcial" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">¿Con agua?</label>
            <ChipGroup
              value={actual.con_agua ? "si" : "no"}
              onChange={(v) => patchRec({ con_agua: v === "si" })}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">Ubicación</label>
            <ChipGroup
              cols={3}
              value={actual.ubicacion}
              onChange={(v) => patchRec({ ubicacion: v as Recipiente["ubicacion"] })}
              options={[
                { value: "interior", label: "Interior" },
                { value: "patio", label: "Patio" },
                { value: "techo", label: "Techo" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">¿Larvas?</label>
            <ChipGroup
              value={actual.positivo_larvas ? "si" : "no"}
              onChange={(v) => patchRec({ positivo_larvas: v === "si" })}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">¿Pupas?</label>
            <ChipGroup
              value={actual.positivo_pupas ? "si" : "no"}
              onChange={(v) => patchRec({ positivo_pupas: v === "si", n_pupas: v === "si" ? "1_10" : null })}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          {actual.positivo_pupas && (
            <div>
              <label className="label-field">Nº pupas (rango)</label>
              <ChipGroup
                cols={3}
                value={actual.n_pupas}
                onChange={(v) => patchRec({ n_pupas: v as Recipiente["n_pupas"] })}
                options={[
                  { value: "1_10", label: "1–10" },
                  { value: "11_50", label: "11–50" },
                  { value: "mas_50", label: ">50" },
                ]}
              />
            </div>
          )}
          <div>
            <label className="label-field">Tratamiento</label>
            <ChipGroup
              value={actual.tratado}
              onChange={(v) => patchRec({ tratado: v as Recipiente["tratado"] })}
              options={[
                { value: "larvicida", label: "Larvicida" },
                { value: "eliminado", label: "Eliminado" },
                { value: "tapado", label: "Tapado" },
                { value: "ninguno", label: "Ninguno" },
              ]}
            />
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setRecipientes((prev) => [...prev, emptyRecip()]);
              setIdxRec(recipientes.length);
            }}
          >
            + Otro recipiente
          </button>
        </div>
      )}

      {paso === 3 && estadoVisita !== "inspeccionada" && (
        <p className="card text-sm text-ios-label-2">Sin recipientes: la vivienda no fue inspeccionada.</p>
      )}

      {paso === 4 && (
        <div className="space-y-4">
          <div>
            <label className="label-field">¿Se educó al hogar?</label>
            <ChipGroup
              value={educo ? "si" : "no"}
              onChange={(v) => setEduco(v === "si")}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">¿Material entregado?</label>
            <ChipGroup
              value={material ? "si" : "no"}
              onChange={(v) => setMaterial(v === "si")}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">¿Requiere reinspección?</label>
            <ChipGroup
              value={reinspeccion ? "si" : "no"}
              onChange={(v) => setReinspeccion(v === "si")}
              options={[
                { value: "si", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm font-medium text-ios-red">{error}</p>}

      <div className="flex gap-2 pb-4">
        {paso > 1 && (
          <button type="button" className="btn-secondary flex-1" onClick={() => setPaso((p) => p - 1)}>
            Atrás
          </button>
        )}
        {paso < 4 && (
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={!puedeContinuar}
            onClick={() => {
              if (paso === 1 && estadoVisita !== "inspeccionada") setPaso(4);
              else setPaso((p) => p + 1);
            }}
          >
            Siguiente
          </button>
        )}
        {paso === 4 && (
          <button type="button" className="btn-primary flex-1" disabled={saving} onClick={guardar}>
            {saving ? "Guardando…" : "Guardar visita"}
          </button>
        )}
      </div>
    </div>
  );
}
