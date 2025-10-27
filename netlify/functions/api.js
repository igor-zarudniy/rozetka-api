const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRHHq-0YUSZVNuGkv2hXm4Z0PW7nDXA92Td9V_d24yypnyazlSB4KqHssRot5MsR5X/exec';

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
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (!authHeader)
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Відсутній API-ключ' })
      };
    
    const apiKey = authHeader.replace('Bearer ', '').trim();
    
    if (!apiKey)
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Невірний формат API-ключа' })
      };
    
    const method = event.httpMethod;
    let path = event.path;
    
    path = path.replace('/.netlify/functions/api', '');
    path = path.replace('/v1', '');
    
    console.log(`Original path: ${event.path}, Cleaned path: ${path}, Method: ${method}, API Key: ${apiKey.substring(0, 10)}...`);
    
    let action = '';
    let guid = '';

    if (path === '/order/create' || path.startsWith('/order/create')) {
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
    } else if (path.match(/\/file\/(.+)\/delete/)) {
      action = 'deleteFile';
      guid = path.match(/\/file\/(.+)\/delete/)[1];
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'Ендпоінт не знайдено',
          receivedPath: event.path,
          cleanedPath: path
        })
      };
    }

    let appsScriptUrl = `${APPS_SCRIPT_URL}?action=${action}&apiKey=${apiKey}`;
    if (guid)
      appsScriptUrl += `&guid=${guid}`;

    const appsScriptMethod = (method === 'GET') ? 'GET' : 'POST';
    
    const requestOptions = {
      method: appsScriptMethod,
      headers: {}
    };

    // Для завантаження файлів обробляємо binary дані
    if (action === 'upload' && event.body) {
      const contentType = event.headers['content-type'] || event.headers['Content-Type'] || 'application/octet-stream';
      
      requestOptions.headers['Content-Type'] = contentType;
      
      // Якщо дані прийшли як base64 (Netlify автоматично кодує binary)
      if (event.isBase64Encoded) {
        // Декодуємо base64 і передаємо як binary
        const buffer = Buffer.from(event.body, 'base64');
        requestOptions.body = buffer;
      } else {
        requestOptions.body = event.body;
      }
      
      console.log(`Uploading file with Content-Type: ${contentType}, Size: ${requestOptions.body.length} bytes`);
    } 
    // Для звичайних JSON запитів
    else {
      requestOptions.headers['Content-Type'] = 'application/json';
      
      if (event.body && appsScriptMethod === 'POST')
        requestOptions.body = event.body;
    }

    console.log(`Forwarding ${method} ${path} -> ${appsScriptUrl}`);
    
    const response = await fetch(appsScriptUrl, requestOptions);
    const data = await response.text();

    console.log(`Response from Apps Script: ${response.status}`);

    let statusCode = response.status;
    
    try {
      const jsonData = JSON.parse(data);
      
      if (jsonData.error) {
        if (jsonData.error.includes('API-ключ') || jsonData.error.includes('авторизації')) {
          statusCode = 401;
        } else if (jsonData.error.includes('Недійсні') || jsonData.error.includes('параметри') || jsonData.error.includes('дані')) {
          statusCode = 400;
        } else if (jsonData.error.includes('не знайдено')) {
          statusCode = 404;
        } else if (jsonData.error.includes('сервера')) {
          statusCode = 500;
        }
      } else if (jsonData.status === 'pending') {
        statusCode = 250;
      }
    } catch (e) {
      console.log('Response is not JSON or parsing failed');
    }

    return {
      statusCode: statusCode,
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

