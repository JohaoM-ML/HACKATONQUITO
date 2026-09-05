"use client";

import { MisMinizonas } from "@/components/ruta/MisMinizonas";

/**
 * Ruta del brigadista: solo minizonas. El cupo diario se recorta
 * en MisMinizonas; el bloque geográfico completo queda para varios días.
 */
export function RutaClient({ brigadistaId }: { brigadistaId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ios-label-2">
        Hoy recorres un tramo de minizonas de tu bloque. La unidad de trabajo es la
        celda (~1 km), no el sector entero.
      </p>
      <MisMinizonas brigadistaId={brigadistaId} />
    </div>
  );
}
