const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRHHq-0YUSZVNuGkv2hXm4Z0PW7nDXA92Td9V_d24yypnyazlSB4KqHssRot5MsR5X/exec';
const API_KEY = 'doros_mh0oorv7_a87c23d6761c420990afabc9cc59d91f';

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 200, headers, body: '' };

  try {
    const method = event.httpMethod;
    const path = event.path.replace('/.netlify/functions/api', '');
    
    let action = '';
    let guid = '';

    if (path.startsWith('/order/create') || path === '/order/create') {
      action = 'create';
    } else if (path.match(/\/order\/cancel\/(.+)/)) {
      action = 'cancel';
      guid = path.match(/\/order\/cancel\/(.+)/)[1];
    } else if (path.match(/\/order\/edit\/(.+)/)) {
      action = 'edit';
      guid = path.match(/\/order\/edit\/(.+)/)[1];
    } else if (path.match(/\/order\/status\/(.+)/)) {
      action = 'status';
      guid = path.match(/\/order\/status\/(.+)/)[1];
    } else if (path.match(/\/order\/(.+)\/upload/)) {
      action = 'upload';
      guid = path.match(/\/order\/(.+)\/upload/)[1];
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Ендпоінт не знайдено' })
      };
    }

    let appsScriptUrl = `${APPS_SCRIPT_URL}?action=${action}&apiKey=${API_KEY}`;
    if (guid)
      appsScriptUrl += `&guid=${guid}`;

    const appsScriptMethod = (method === 'GET') ? 'GET' : 'POST';
    
    const requestOptions = {
      method: appsScriptMethod,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (event.body && appsScriptMethod === 'POST')
      requestOptions.body = event.body;

    console.log(`Forwarding ${method} ${path} -> ${appsScriptUrl}`);
    
    const response = await fetch(appsScriptUrl, requestOptions);
    const data = await response.text();

    console.log(`Response from Apps Script: ${response.status}`);

    return {
      statusCode: response.status,
      headers,
      body: data
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Внутрішня помилка сервера', 
        details: error.message 
      })
    };
  }
};

