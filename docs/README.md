# Guía de la solución (pitch) — ZANKU / VENTANA SECA

Documento LaTeX para que el equipo entienda problemática + producto y arme el pitch.

**Para Overleaf (recomendado):** subí la carpeta lista  
[`overleaf-zanku-guia/`](overleaf-zanku-guia/) — ahí están `main.tex` + las 16 capturas.

| Archivo / carpeta | Qué es |
|-------------------|--------|
| [`overleaf-zanku-guia/`](overleaf-zanku-guia/) | Paquete listo para Upload Project |
| [`guia-solucion-zanku.tex`](guia-solucion-zanku.tex) | Misma fuente (nombre local) |
| [`figuras/app/`](figuras/app/) | Capturas PNG |
| [`scripts/capture-app.mjs`](scripts/capture-app.mjs) | Script Playwright |

El paper científico largo sigue en la raíz: `VENTANA-SECA-documento-latex.txt`.

## Overleaf (TeX Live)

1. Comprimí `overleaf-zanku-guia` en ZIP **o** subí sus archivos.
2. Main document = `main.tex`
3. Compiler = **pdfLaTeX**
4. Recompile ×2

## Compilar en local (opcional)

TeX Live o MiKTeX:

```bash
cd docs
pdflatex guia-solucion-zanku.tex
pdflatex guia-solucion-zanku.tex
```

## Regenerar capturas

```bash
cd web
npm run dev   # p. ej. :3001
node scripts/capture-guia.mjs
```

Demos: `brigada.ventana@gmail.com` / `jefe.ventana@gmail.com` · `Demo1234!`
