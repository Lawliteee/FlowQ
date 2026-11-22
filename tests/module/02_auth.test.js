import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getUser, saveUser, getToken, clearUser } from '../../frontend/src/utils/auth.js';

// Эмуляция поведения document.cookie в браузере для тестирования в Node.js
class MockDocumentCookie {
  constructor() {
    this._cookies = new Map();
  }

  get cookie() {
    return Array.from(this._cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  set cookie(cookieStr) {
    const [pair, ...flags] = cookieStr.split(';');
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return;

    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();

    const isExpired = flags.some((flag) => {
      const lower = flag.trim().toLowerCase();
      return lower.startsWith('max-age=-') || lower.includes('expires=thu, 01 jan 1970');
    });

    if (isExpired || val === '') {
      this._cookies.delete(key);
    } else {
      this._cookies.set(key, val);
    }
  }
}

describe('Модуль 02: auth.js (управление состоянием авторизации и токеном)', () => {
  beforeEach(() => {
    globalThis.document = new MockDocumentCookie();
  });

  // Тест 6
  it('Тест 6: getUser() должен возвращать null, если cookie пользователя не установлен', () => {
    const user = getUser();
    assert.equal(user, null);
  });

  // Тест 7
  it('Тест 7: saveUser() должен сохранять пользователя и токен, а getUser() и getToken() — считывать их', () => {
    const testUser = {
      id: 'usr-12345',
      email: 'alex@example.com',
      displayName: 'Alex Flow',
    };
    const testToken = 'jwt-mock-token-xyz';

    saveUser(testUser, testToken);

    const loadedUser = getUser();
    const loadedToken = getToken();

    assert.deepEqual(loadedUser, testUser);
    assert.equal(loadedToken, testToken);
  });

  // Тест 8
  it('Тест 8: getUser() должен возвращать null при некорректном / повреждённом JSON в cookie', () => {
    // Напрямую повреждаем cookie 'user'
    globalThis.document.cookie = 'user={not_valid_json}; path=/';

    const user = getUser();
    assert.equal(user, null);
  });

  // Тест 9
  it('Тест 9: clearUser() должен очищать и пользователя, и токен', () => {
    saveUser({ id: '1', email: 'test@mail.com' }, 'token-to-delete');

    assert.notEqual(getUser(), null);
    assert.notEqual(getToken(), null);

    clearUser();

    assert.equal(getUser(), null);
    assert.equal(getToken(), null);
  });
});
