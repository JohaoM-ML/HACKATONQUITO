export type Rol = "brigadista" | "jefe";

export type EstadoVisita = "inspeccionada" | "cerrada" | "renuente" | "deshabitada";

export type TipoRecipiente =
  | "tanque_elevado"
  | "tanque_bajo"
  | "cisterna"
  | "barril_tambor"
  | "balde_tina"
  | "llanta"
  | "florero_planta"
  | "canaleta"
  | "chatarra_escombro"
  | "bebedero_animal"
  | "otro";

export type UsoRecipiente =
  | "almacenamiento_consumo"
  | "almacenamiento_limpieza"
  | "desecho"
  | "decorativo";

export type MotivoAlmacenamiento =
  | "corte_programado"
  | "corte_emergente"
  | "presion_baja"
  | "costumbre"
  | "no_aplica";

export interface Perfil {
  id: string;
  nombre: string;
  rol: Rol;
  brigada_id: string | null;
  telefono: string | null;
}

export interface Brigada {
  id: string;
  nombre: string;
  canton: string;
  jefe_id: string | null;
}

export interface Sector {
  id: string;
  slug: string;
  nombre: string;
  zona: string | null;
  lat: number | null;
  lon: number | null;
  radio_m?: number | null;
}

export type EstadoMinizona = "pendiente" | "en_curso" | "cubierta";
export type OrigenMinizona = "malla" | "cerco";

/** Celda H3 res 10 (~160 m). Unidad de muestreo a escala de vuelo del vector. */
export interface Minizona {
  id: string;
  sector_id: string;
  h3: string;
  lat: number;
  lon: number;
  estado: EstadoMinizona;
  origen: OrigenMinizona;
  foco_visita_id: string | null;
  meta_viviendas: number;
  sectores?: Sector;
}

export interface AsignacionMinizona {
  id: string;
  minizona_id: string;
  brigadista_id: string;
  orden: number | null;
  estado: "pendiente" | "en_curso" | "completada";
  minizonas?: Minizona;
}

export interface IndicesMinizona {
  minizona_id: string;
  h3: string;
  sector_id: string;
  sector_nombre: string;
  lat: number;
  lon: number;
  estado: EstadoMinizona;
  origen: OrigenMinizona;
  semana: string;
  viviendas_inspeccionadas: number;
  viviendas_positivas: number;
  recipientes_inspeccionados: number;
  recipientes_positivos: number;
  hi: number | null;
  ci: number | null;
  bi: number | null;
}

export interface CoberturaSector {
  sector_id: string;
  sector_nombre: string;
  zona: string | null;
  lat: number | null;
  lon: number | null;
  radio_m: number | null;
  minizonas_total: number;
  minizonas_cubiertas: number;
  minizonas_en_curso: number;
  minizonas_cerco: number;
  cercos_cerrados: number;
  pct_cobertura: number | null;
  pct_cercos_cerrados: number | null;
}

export interface ColaItem {
  id: string;
  sector_id: string;
  corte_id: string | null;
  fecha_eval: string;
  regla: "A" | "B" | "C" | null;
  puntaje: number;
  prioridad: number | null;
  accion: string | null;
  justificacion: string | null;
  hipotesis: boolean;
  requiere_confirmacion_humana: boolean;
  label_regla: string | null;
  aplica_d: boolean;
  evidencias: unknown[];
  incertidumbre: string[];
  origen_dato: string[];
  confianza: string | null;
  sectores?: Sector;
}

export interface Visita {
  id: string;
  sector_id: string;
  minizona_id: string | null;
  h3: string | null;
  cola_item_id: string | null;
  brigadista_id: string;
  brigada_id: string | null;
  estado_visita: EstadoVisita;
  codigo_vivienda: string | null;
  manzana: string | null;
  lat: number | null;
  lon: number | null;
  precision_m: number | null;
  fecha_hora: string;
  n_habitantes: number | null;
  tiene_conexion_red: boolean | null;
  dias_sin_agua_ultima_semana: number | null;
  horas_agua_por_dia: string | null;
  almacena_agua: boolean | null;
  motivo_almacenamiento: MotivoAlmacenamiento | null;
  dias_almacenada: number | null;
  recibio_tanquero: boolean | null;
  se_educo_hogar: boolean | null;
  material_entregado: boolean | null;
  requiere_reinspeccion: boolean | null;
  notas: string | null;
  /** Intervenciones hechas en el predio. Sirve para comparar reinfestación. */
  acciones: AccionVisita[];
}

export interface Recipiente {
  id?: string;
  visita_id?: string;
  tipo: TipoRecipiente;
  uso: UsoRecipiente | null;
  capacidad_l: string | null;
  tapado: "si" | "parcial" | "no" | null;
  con_agua: boolean | null;
  ubicacion: "interior" | "patio" | "techo" | null;
  positivo_larvas: boolean | null;
  positivo_pupas: boolean | null;
  n_pupas: "1_10" | "11_50" | "mas_50" | null;
  tratado: "larvicida" | "eliminado" | "tapado" | "ninguno" | null;
  foto_url?: string | null;
}

export interface IndicesSector {
  sector_id: string;
  sector_nombre: string;
  zona: string | null;
  semana: string;
  viviendas_inspeccionadas: number;
  viviendas_positivas: number;
  recipientes_inspeccionados: number;
  recipientes_positivos: number;
  positivos_almacenamiento: number;
  hi: number | null;
  ci: number | null;
  bi: number | null;
  pct_positivos_almacenamiento: number | null;
  umbral_hi: number;
  umbral_ci: number;
  umbral_bi: number;
}

export const TIPOS_RECIPIENTE: { value: TipoRecipiente; label: string }[] = [
  { value: "tanque_elevado", label: "Tanque elevado" },
  { value: "tanque_bajo", label: "Tanque bajo" },
  { value: "cisterna", label: "Cisterna" },
  { value: "barril_tambor", label: "Barril / tambor" },
  { value: "balde_tina", label: "Balde / tina" },
  { value: "llanta", label: "Llanta" },
  { value: "florero_planta", label: "Florero / planta" },
  { value: "canaleta", label: "Canaleta" },
  { value: "chatarra_escombro", label: "Chatarra" },
  { value: "bebedero_animal", label: "Bebedero" },
  { value: "otro", label: "Otro" },
];

export const USOS_RECIPIENTE: { value: UsoRecipiente; label: string }[] = [
  { value: "almacenamiento_consumo", label: "Consumo" },
  { value: "almacenamiento_limpieza", label: "Limpieza" },
  { value: "desecho", label: "Desecho" },
  { value: "decorativo", label: "Decorativo" },
];

export const ACCIONES_VISITA = [
  {
    value: "eliminar_tapar",
    label: "Eliminar o tapar recipiente",
    detalle: "Vaciar, destruir o tapar criaderos en el predio.",
  },
  {
    value: "larvicida",
    label: "Aplicar larvicida",
    detalle: "Tratar agua que el hogar todavía usa.",
  },
  {
    value: "malla",
    label: "Instalar malla",
    detalle: "Cubrir tanque, cisterna o ventanas.",
  },
  {
    value: "entrenar_hogar",
    label: "Entrenar al hogar",
    detalle: "Explicar criaderos y cómo evitarlos.",
  },
  {
    value: "entregar_material",
    label: "Entregar material",
    detalle: "Folleto, tapa, malla o kit al hogar.",
  },
] as const;

export type AccionVisita = (typeof ACCIONES_VISITA)[number]["value"];
