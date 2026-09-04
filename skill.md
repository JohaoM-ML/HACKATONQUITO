# SKILL: Mockup de página web — sistema de diseño personalizado

## Cuándo usar esta skill
Cuando el usuario pida crear o iterar un **mockup de página web** (landing page, sitio informativo, dashboard, app web) en HTML/CSS. Es una adaptación al formato web de la skill de presentaciones (`SKILL-presentaciones-neoconsulting.md`): mismo flujo de trabajo y disciplina de iteración, pero con anatomía de página en vez de anatomía de slide, y sin logos ni imágenes reales.

---

## 1. Flujo de trabajo (no te lo saltes)

1. **Fase de contenido (HTML, barato)**: arma la página sección por sección (navbar → hero → cada bloque de contenido → footer), pidiendo confirmación antes de avanzar a la siguiente. Todas las decisiones de copy, jerarquía y qué va en cada sección se cierran aquí.
2. **Fase de verificación**: si hay cifras, precios o datos concretos en el mockup, verificarlos antes de darlos por definitivos — no inventarlos "para que se vea bien".
3. **Fase final**: solo cuando toda la estructura está aprobada, pulir detalles de responsive/consistencia. No hay fase de conversión a otro formato salvo que el usuario la pida explícitamente.

**Estructura de la página siempre libre — la propone el usuario.** Esta skill no impone un orden de secciones fijo; si el usuario no trae estructura, se le pregunta o se le sugiere solo si la pide.

---

## 2. Sistema de diseño (tokens fijos — no improvisar otros)

```css
--cream:      #F2EDD5;  /* fondo base, secciones claras */
--red-orange: #E7390D;  /* acento primario — CTAs, botones principales, elementos de energía/urgencia */
--orange:     #F26716;  /* acento secundario — hovers, badges, íconos, subrayados */
--green-dark: #084A24;  /* color de marca — headers, navbar, texto principal, botones secundarios */
--green-deep: #04261E;  /* casi negro — texto de cuerpo largo, fondos oscuros (footer, secciones de contraste) */
```

**Tipografía — familia DM y variantes**:
- **DM Sans** (400 regular / 500 medium / 700 bold, + itálicas) para texto de cuerpo, navegación, botones, labels.
- **DM Serif Display** para titulares grandes de hero/secciones — es de la misma familia tipográfica "DM", pensada específicamente para combinar con DM Sans (contraste serif/sans sin salirse del sistema). Si se prefiere una sola familia, usar DM Sans Bold/700 para todos los titulares.
- Eyebrows/labels de categoría: DM Sans Medium, mayúsculas, `letter-spacing: 1.5-2px`.

**Nunca mezclar otros colores o tipografías fuera de este sistema.**

---

## 3. Anatomía de la página (el "chrome")

- **Navbar fija arriba**: a la izquierda, recuadro punteado en blanco de tamaño logo (`[LOGO]`) — nunca un logo real ni placeholder de imagen genérico de internet. A la derecha, links de navegación + botón CTA (fondo `--red-orange`, texto `--cream`).
- **Hero**: titular grande (DM Serif Display o DM Sans Bold, `--green-dark` o `--green-deep`), subtítulo corto en DM Sans regular, botón CTA primario. Si el hero pide una imagen/foto, dejar un recuadro punteado con el texto `[imagen: descripción de qué iría ahí]` — nunca buscar ni insertar una imagen real.
- **Secciones de contenido**: alternar fondo `--cream` y `--green-deep` (con texto `--cream` encima) para dar ritmo visual, o mantener todo sobre `--cream` con tarjetas si se prefiere más minimalismo — a definir con el usuario en la fase de contenido.
- **Footer**: fondo `--green-deep`, texto `--cream`, links en `--orange` al hover.

---

## 4. Componentes reutilizables

- **Botón primario**: fondo `--red-orange`, texto `--cream`, hover a `--orange`.
- **Botón secundario/outline**: borde `--green-dark`, texto `--green-dark`, fondo transparente; hover con fondo `--green-dark` y texto `--cream`.
- **Tarjeta**: fondo blanco o `--cream` con borde sutil, borde izquierdo de 3-4px en `--orange` o `--red-orange` para destacar. Ícono circular simple (sin imagen, solo SVG de línea) o recuadro `[icono]` si no se genera en código.
- **Placeholder de imagen**: siempre un recuadro con borde punteado `--green-dark`, fondo `--cream` ligeramente más oscuro, y texto centrado tipo `[imagen: ...]` — nunca imagen real, nunca ícono de marca externa.
- **Note-box / badge**: fondo `--cream` oscurecido, borde izquierdo `--green-dark` de 3px, texto pequeño DM Sans.

---

## 5. Reglas de contenido

- **Texto corto por defecto.** Frases, no párrafos largos, salvo que la sección lo pida explícitamente (ej. "sobre nosotros").
- **Sé neutral si el usuario lo pide.** Mismo tratamiento visual para opciones/planes comparados si no se quiere insinuar jerarquía.
- **Marca lo no confirmado.** Si un dato (precio, cifra) no está verificado, indicarlo en vez de presentarlo como definitivo.
- **No repitas el mismo dato con redacción distinta en dos secciones.**

---

## 6. Qué NO hacer

- No usar colores o tipografías fuera de la sección 2.
- No insertar imágenes, fotos ni logos reales — siempre recuadro punteado con `[imagen: ...]` o `[LOGO]`.
- No generar el mockup completo de un tirón: sección por sección, con confirmación.
- No imponer una estructura de página fija — la propone el usuario.