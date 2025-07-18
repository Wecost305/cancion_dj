// netlify/functions/request-handler.js
const Pusher = require('pusher');
const { Client } = require('@notionhq/client');

// --- CONFIGURACIÓN --- 
// Estos datos los pondrás en las variables de entorno de Netlify
const { 
    PUSHER_APP_ID, 
    PUSHER_KEY, 
    PUSHER_SECRET, 
    PUSHER_CLUSTER, 
    NOTION_TOKEN, 
    NOTION_DB_ID 
} = process.env;

const pusher = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true
});

const notion = new Client({ auth: NOTION_TOKEN });

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST' ) {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const tallyPayload = JSON.parse(event.body);
        const fields = tallyPayload.data.fields;

        // Extraer datos del formulario de Tally
        const song = fields.find(f => f.key.includes('field_')).value || 'Desconocida';
        const artist = fields.find(f => f.key.includes('field_')).value || 'Desconocido';
        const name = fields.find(f => f.key.includes('field_')).value || 'Anónimo';

        const requestData = { song, artist, name, id: new Date().getTime() };

        // 1. Enviar a Pusher en tiempo real
        await pusher.trigger('dj-channel', 'new-request', requestData);

        // 2. Guardar en Notion (opcional)
        if (NOTION_TOKEN && NOTION_DB_ID) {
            await notion.pages.create({
                parent: { database_id: NOTION_DB_ID },
                properties: {
                    'Canción': { title: [{ text: { content: song } }] },
                    'Artista': { rich_text: [{ text: { content: artist } }] },
                    'Nombre del Solicitante': { rich_text: [{ text: { content: name } }] },
                }
            });
        }

        return { statusCode: 200, body: 'Request processed.' };

    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
