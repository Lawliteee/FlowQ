import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Модуль аналитики ожидания, обработки ошибок базы данных и сетевых интерцепторов.
 */

// Расчет фактического среднего времени ожидания из истории (queue_wait_stats)
function calculateAverageWaitTime(waitStats, fallbackDefaultMinutes = 5) {
  if (!Array.isArray(waitStats) || waitStats.length === 0) {
    return fallbackDefaultMinutes;
  }
  const validTimes = waitStats.filter((t) => typeof t === 'number' && t > 0);
  if (validTimes.length === 0) {
    return fallbackDefaultMinutes;
  }
  const total = validTimes.reduce((sum, val) => sum + val, 0);
  return total / validTimes.length;
}

// Проверка на ошибку нарушения уникальности в PostgreSQL (код 23505 или ключевое слово 'unique')
function isUniqueViolation(error) {
  if (!error) return false;
  const msg = String(error.message || error).toLowerCase();
  return msg.includes('23505') || msg.includes('unique');
}

// Эмуляция логики интерцептора Axios (frontend/src/utils/api.js)
function applyAuthHeader(config, token) {
  const nextConfig = {
    ...config,
    headers: { ...(config.headers || {}) },
  };
  if (token && typeof token === 'string' && token.trim().length > 0) {
    nextConfig.headers.Authorization = `Bearer ${token.trim()}`;
  }
  return nextConfig;
}

// Форматирование метки времени начала очереди для интерфейса
function formatStartTimeLabel(startTime) {
  const trimmed = (startTime ?? '').trim();
  if (trimmed === '') {
    return 'не указано';
  }
  return `начало: ${trimmed}`;
}

describe('Модуль 06: analytics_and_helpers (аналитика ожидания, сетевые хелперы и ошибки БД)', () => {
  // Тест 36
  it('Тест 36: Расчет среднего времени ожидания: при пустой истории возвращается базовое время (5 мин)', () => {
    assert.equal(calculateAverageWaitTime([]), 5);
    assert.equal(calculateAverageWaitTime(null), 5);
    assert.equal(calculateAverageWaitTime([0, -3]), 5); // игнорирование некорректных значений
  });

  // Тест 37
  it('Тест 37: Расчет среднего времени ожидания: среднее арифметическое фактических замеров', () => {
    const stats = [4, 6, 8]; // (4 + 6 + 8) / 3 = 6
    assert.equal(calculateAverageWaitTime(stats), 6);

    const statsFloat = [3, 4]; // 3.5 мин
    assert.equal(calculateAverageWaitTime(statsFloat), 3.5);
  });

  // Тест 38
  it('Тест 38: Определение кода ошибки уникальности БД (код 23505 или ключевое слово "unique")', () => {
    assert.equal(isUniqueViolation('ERROR: duplicate key value violates unique constraint "users_email_key" (SQLSTATE 23505)'), true);
    assert.equal(isUniqueViolation({ message: 'pq: duplicate key unique' }), true);
    assert.equal(isUniqueViolation('connection refused'), false);
    assert.equal(isUniqueViolation(null), false);
  });

  // Тест 39
  it('Тест 39: Axios интерцептор: добавляет заголовок Authorization при наличии токена', () => {
    const initialConfig = { headers: { 'Content-Type': 'application/json' } };
    const updated = applyAuthHeader(initialConfig, 'jwt.sample.token');

    assert.equal(updated.headers.Authorization, 'Bearer jwt.sample.token');
    assert.equal(updated.headers['Content-Type'], 'application/json');
  });

  // Тест 40
  it('Тест 40: Axios интерцептор: не модифицирует заголовки при отсутствии токена', () => {
    const initialConfig = { headers: { Accept: 'application/json' } };

    const withNull = applyAuthHeader(initialConfig, null);
    assert.equal(withNull.headers.Authorization, undefined);

    const withEmpty = applyAuthHeader(initialConfig, '');
    assert.equal(withEmpty.headers.Authorization, undefined);
  });
});
