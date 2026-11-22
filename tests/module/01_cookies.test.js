import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getCookie, setCookie, removeCookie } from '../../frontend/src/utils/cookies.js';

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

    // Проверяем флаги истечения / удаления
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

  clear() {
    this._cookies.clear();
  }
}

describe('Модуль 01: cookies.js (управление cookie в браузере)', () => {
  let mockDoc;

  beforeEach(() => {
    mockDoc = new MockDocumentCookie();
    globalThis.document = mockDoc;
  });

  // Тест 1
  it('Тест 1: должен успешно сохранять и считывать cookie', () => {
    setCookie('test_token', 'abc123xyz', 1);
    const value = getCookie('test_token');
    assert.equal(value, 'abc123xyz');
  });

  // Тест 2
  it('Тест 2: должен возвращать null для несуществующего cookie', () => {
    const value = getCookie('non_existent');
    assert.equal(value, null);
  });

  // Тест 3
  it('Тест 3: должен корректно находить нужный cookie среди нескольких сохранённых', () => {
    setCookie('user_id', '42');
    setCookie('session_id', 'sess_999');
    setCookie('participantId_queue1', 'part_123');

    assert.equal(getCookie('user_id'), '42');
    assert.equal(getCookie('session_id'), 'sess_999');
    assert.equal(getCookie('participantId_queue1'), 'part_123');
  });

  // Тест 4
  it('Тест 4: должен корректно удалять cookie через removeCookie', () => {
    setCookie('temp_key', 'temp_val');
    assert.equal(getCookie('temp_key'), 'temp_val');

    removeCookie('temp_key');
    assert.equal(getCookie('temp_key'), null);
  });

  // Тест 5
  it('Тест 5: должен перезаписывать существующий cookie при повторном вызове setCookie', () => {
    setCookie('role', 'user');
    assert.equal(getCookie('role'), 'user');

    setCookie('role', 'admin');
    assert.equal(getCookie('role'), 'admin');
  });
});
