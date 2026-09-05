"use client";

import { MisMinizonas } from "@/components/ruta/MisMinizonas";

/**
 * Ruta del brigadista: solo minizonas. El cupo diario (8 celdas) se recorta
 * en MisMinizonas; el bloque geográfico completo queda para varios días.
 */
export function RutaClient({ brigadistaId }: { brigadistaId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-fg">
        Hoy recorres un tramo de minizonas de tu bloque. La unidad de trabajo es la
        celda (~160 m), no el sector entero.
      </p>
      <MisMinizonas brigadistaId={brigadistaId} />
    </div>
  );
}
