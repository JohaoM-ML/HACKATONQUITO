# C3 / C10 — Secretos y cuentas demo

Severidad: **P0** (cuentas) + **P1** (higiene de keys y Auth).

## C3 — credenciales demo en un repo público

`web/components/auth/RoleLogin.tsx` hardcodea email + password de brigadista y jefe, y el botón **Entrar con demo** los usa. Ese archivo está en `origin/main`.

Remote: https://github.com/JohaoM-ML/HACKATONQUITO (público).

En Supabase `ventana-seca` hay **exactamente 2 usuarios**, metadata `jefe` y `brigadista`. Encaja con esas cuentas.

Cualquiera que clone o abra el repo entra al panel y, por C1/C4/C5, exporta GPS o borra visitas.

No se repite la contraseña en este informe. Está en el cliente; hay que rotarla, no documentarla más.

### Qué hacer

1. En Auth: borrar o resetear esas dos cuentas. Revocar sesiones.
2. Quitar el objeto `DEMO` y el botón de demo del cliente.
3. Si hace falta demo en el jurado: usuarios temporales creados el día del evento, no en git.
4. Activar [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) (advisor en WARN).
5. Reactivar confirmación de email. El README la apaga “para demo rápida”: eso hace que C1 sea instantáneo.

`.env.local` **no** está trackeado (`.gitignore` tiene `.env.*`). Bien. No commitear `SUPABASE_SERVICE_ROLE_KEY`.

## C10 — Maps key y Auth flojo

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` viaja al browser por diseño. Si en Google Cloud no está restringida por HTTP referrer (`localhost` + dominio Vercel), cualquiera la reusa y genera factura.

Confirm-email desactivado + leaked-password protection off + signup abierto = cuentas privilegiadas en minutos.

### Qué hacer

- Restringir la key por referrer y por API (solo Maps JavaScript).
- No poner keys de Maps server en el cliente.
- Signup cerrado salvo invite.
