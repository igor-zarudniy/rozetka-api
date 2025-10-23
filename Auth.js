/** API ключ для аутентифікації Розетки */
const ROZETKA_API_KEY = 'doros_mh0oorv7_a87c23d6761c420990afabc9cc59d91f';

class Auth {
  /** Генерує унікальний API ключ з префіксом doros
   * @returns {string} - Згенерований API ключ
   */
  static generateApiKey() {
    const randomBytes = Utilities.getUuid().replace(/-/g, '');
    const timestamp = new Date().getTime().toString(36);
    return `doros_${timestamp}_${randomBytes}`;
  }

  /** Перевіряє валідність API ключа з заголовка запиту
   * @param {Object} request - Об'єкт запиту з заголовками
   * @returns {Object} - Об'єкт з результатом валідації
   */
  static validateApiKey(request) {
    const authHeader = request.parameter?.apiKey;
    
    if (!authHeader)
      return { valid: false, error: 'Відсутній API-ключ', code: 401 };
    
    if (authHeader !== ROZETKA_API_KEY)
      return { valid: false, error: 'Невірний або відсутній API-ключ', code: 401 };
    
    return { valid: true };
  }

  /** Отримує поточний API ключ з конфігурації
   * @returns {string} - API ключ
   */
  static getApiKey() {
    return ROZETKA_API_KEY;
  }
}

