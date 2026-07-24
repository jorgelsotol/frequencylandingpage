/**
 * Cloudflare Pages Function — POST /api/diagnostico
 *
 * Recibe el formulario "Agendar diagnóstico" del landing y dispara el
 * evento "diagnostico_solicitado" en Loops (crea/actualiza el contacto
 * y puede activar un Loop de email configurado en tu dashboard de Loops).
 *
 * Requiere la variable de entorno LOOPS_API_KEY, configurada como secret
 * en Cloudflare Pages (Settings → Environment variables). Nunca vive en
 * este archivo ni en el HTML del cliente.
 *
 * Docs de la API: https://loops.so/docs/api-reference/send-event
 */

const LOOPS_EVENTS_URL = "https://app.loops.so/api/v1/events/send";
const NOMBRE_EVENTO = "diagnostico_solicitado";
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.LOOPS_API_KEY) {
    console.error("Falta la variable de entorno LOOPS_API_KEY.");
    return jsonRespuesta({ ok: false, error: "config" }, 500);
  }

  let datos;
  try {
    datos = await request.json();
  } catch {
    return jsonRespuesta({ ok: false, error: "cuerpo-invalido" }, 400);
  }

  const nombre = limpiar(datos.nombre);
  const correo = limpiar(datos.correo);
  const empresa = limpiar(datos.empresa);
  const sistemas = limpiar(datos.sistemas);

  if (!nombre || !correo || !empresa || !sistemas) {
    return jsonRespuesta({ ok: false, error: "campos-faltantes" }, 400);
  }
  if (!CORREO_VALIDO.test(correo)) {
    return jsonRespuesta({ ok: false, error: "correo-invalido" }, 400);
  }

  let respuestaLoops;
  try {
    respuestaLoops = await fetch(LOOPS_EVENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LOOPS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: correo,
        eventName: NOMBRE_EVENTO,
        // Quedan en el contacto: se pueden usar para segmentar y para
        // personalización ({{contact.firstName}}) en cualquier Loop futuro.
        contactProperties: {
          firstName: nombre,
          empresa: empresa,
          sistemas: sistemas,
        },
        // Quedan atadas a este evento puntual: para personalizar el
        // Loop que se dispare específicamente por "diagnostico_solicitado".
        eventProperties: {
          nombre: nombre,
          empresa: empresa,
          sistemas: sistemas,
        },
      }),
    });
  } catch (error) {
    console.error("No se pudo contactar a Loops:", error);
    return jsonRespuesta({ ok: false, error: "loops-inalcanzable" }, 502);
  }

  if (!respuestaLoops.ok) {
    const detalle = await respuestaLoops.text();
    console.error("Loops respondió con error:", respuestaLoops.status, detalle);
    return jsonRespuesta({ ok: false, error: "loops-rechazo" }, 502);
  }

  return jsonRespuesta({ ok: true });
}

function limpiar(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function jsonRespuesta(cuerpo, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
