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
    } else if (path.match(/\/file\/(.+)\/delete/) || (method === 'DELETE' && path.match(/\/file\/(.+)/))) {
      action = 'deleteFile';
      const match = path.match(/\/file\/(.+)\/delete/) || path.match(/\/file\/(.+)/);
      guid = match[1];
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
      
      // Відправляємо як JSON з base64 данними (Apps Script це розуміє)
      requestOptions.headers['Content-Type'] = 'application/json';
      
      // Netlify автоматично кодує binary в base64
      const base64Data = event.isBase64Encoded ? event.body : Buffer.from(event.body).toString('base64');
      
      // Передаємо у форматі JSON
      const payload = {
        fileData: base64Data,
        mimeType: contentType,
        isBase64: true
      };
      
      requestOptions.body = JSON.stringify(payload);
      
      console.log(`Uploading file with Content-Type: ${contentType}, Base64 size: ${base64Data.length} chars`);
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
        } else if (jsonData.error.includes('не знайдено')) {
          statusCode = 400;
        } else if (jsonData.error.includes('Недійсні') || jsonData.error.includes('параметри') || jsonData.error.includes('дані')) {
          statusCode = 400;
        } else if (jsonData.error.includes('сервера')) {
          statusCode = 500;
        }
      } else if (jsonData.status === 'created') {
        // Для команди створення замовлення даємо 200
        if (action === 'create') {
          statusCode = 200;
        } 
        // Для запиту статусу даємо 250
        else if (action === 'status') {
          statusCode = 200;
        }
      } else if (jsonData.status === 'updated') {
        statusCode = 200;
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

