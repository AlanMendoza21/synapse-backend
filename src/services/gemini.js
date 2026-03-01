const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');
const { trackUsage } = require('./tokenTracker');

const SYSTEM_PROMPT = `Eres Synapse, un co-piloto de productividad personal. Tu trabajo es ayudar al usuario a organizar su día de forma inteligente.

CONTEXTO DEL USUARIO:
{USER_CONTEXT}

EVENTOS DE GOOGLE CALENDAR (si disponibles):
{CALENDAR_EVENTS}

REGLAS DE PRIORIZACIÓN:
1. Tareas con deadline fijo van primero en el horario correspondiente.
2. Tareas que requieren alta concentración van en las horas de mayor energía del usuario.
3. Tareas rápidas (menos de 15 min) se agrupan juntas.
4. Incluir descansos de 10-15 min entre bloques de trabajo de 2 horas.
5. Tareas físicas (gimnasio, compras) van después de bloques mentales como transición.
6. Los eventos de Google Calendar son FIJOS y no se pueden mover. Organiza las tareas alrededor de ellos.

FORMATO DE RESPUESTA:
- Responde siempre en español.
- Usa emojis moderados para hacer el plan visual y amigable.
- Incluye horarios específicos.
- Al final, pregunta si quiere ajustar algo.
- Sé breve y directo. No des explicaciones largas.

FLUJO:
- Si el usuario envía un saludo, preséntate brevemente y pregunta qué tareas tiene para hoy.
- Si el usuario envía tareas sin horario, pregunta su disponibilidad.
- Si ya conoces su disponibilidad (del perfil o porque ya la dijo), genera el plan directamente.
- Si el usuario dice "ya terminé [tarea]", felicítalo brevemente y dile qué sigue.
- Si el usuario dice que algo cambió, reorganiza el plan.
- Si el usuario dice "¿qué sigue?", responde solo con la siguiente tarea.
- Si el usuario dice "¿cómo me fue?" o algo similar, da un resumen del día con porcentaje de completado.`;

let genAI = null;

function getClient() {
  if (!genAI && config.gemini.apiKey) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return genAI;
}

function buildSystemPrompt(userProfile, calendarEvents) {
  let context = 'No hay información de perfil disponible.';
  if (userProfile) {
    const parts = [];
    if (userProfile.occupation) parts.push(`Ocupación: ${userProfile.occupation}`);
    if (userProfile.peak_energy) parts.push(`Hora de mayor energía: ${userProfile.peak_energy}`);
    if (userProfile.challenges) parts.push(`Dificultades: ${userProfile.challenges}`);
    if (userProfile.fixed_schedules) parts.push(`Horarios fijos: ${userProfile.fixed_schedules}`);
    context = parts.join('\n') || context;
  }

  let events = 'No hay calendario conectado.';
  if (calendarEvents && calendarEvents.length > 0) {
    events = calendarEvents.map(e => `- ${e.start} a ${e.end}: ${e.title}`).join('\n');
  }

  return SYSTEM_PROMPT
    .replace('{USER_CONTEXT}', context)
    .replace('{CALENDAR_EVENTS}', events);
}

async function chat(userId, conversationHistory, userProfile, calendarEvents) {
  const client = getClient();
  if (!client) {
    return {
      response: 'Lo siento, el servicio de IA no está configurado. Contacta al administrador.',
      usage: null,
    };
  }

  const model = client.getGenerativeModel({ model: config.gemini.model });
  const systemPrompt = buildSystemPrompt(userProfile, calendarEvents);

  // Build conversation as a single prompt with context
  let fullPrompt = systemPrompt + '\n\n--- CONVERSACIÓN ---\n';
  for (const msg of conversationHistory) {
    const role = msg.role === 'assistant' ? 'Synapse' : 'Usuario';
    fullPrompt += `${role}: ${msg.message}\n`;
  }
  fullPrompt += '\nSynapse:';

  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();
    const usageMetadata = response.usageMetadata || {};

    const usage = await trackUsage(userId, 'chat', {
      promptTokens: usageMetadata.promptTokenCount || 0,
      completionTokens: usageMetadata.candidatesTokenCount || 0,
      model: config.gemini.model,
    });

    return { response: text, usage };
  } catch (err) {
    console.error('Gemini API error detail:', err.message);
    throw err;
  }
}

module.exports = { chat, buildSystemPrompt };
