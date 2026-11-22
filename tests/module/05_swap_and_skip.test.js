import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Модуль логики обмена местами (Swap) и временного пропуска очереди (Skip & Return).
 * Проверяет бизнес-правила безопасности обмена и расчет времени возврата.
 */

// Проверка допустимости запроса на обмен местами
function validateSwapRequest({ fromId, toId, currentParticipantId, participants }) {
  if (!fromId || !toId) {
    return { allowed: false, reason: 'Идентификаторы участников обязательны' };
  }
  if (fromId === toId) {
    return { allowed: false, reason: 'Нельзя предложить обмен самому себе' };
  }
  if (currentParticipantId && toId === currentParticipantId) {
    return { allowed: false, reason: 'Нельзя меняться с участником, которого уже вызвали' };
  }

  const fromExists = participants.some((p) => p.id === fromId);
  const toExists = participants.some((p) => p.id === toId);

  if (!fromExists) {
    return { allowed: false, reason: 'Инициатор обмена не найден в очереди' };
  }
  if (!toExists) {
    return { allowed: false, reason: 'Целевой участник не найден в очереди' };
  }

  // Находим 1-based позицию инициатора
  const fromPos = participants.findIndex((p) => p.id === fromId) + 1;

  return { allowed: true, fromPos };
}

// Расчет оставшегося времени пропуска в секундах
function calculateSkipTimeLeft(skipUntilDate, currentDate = new Date()) {
  if (!skipUntilDate) return 0;
  const diffMs = skipUntilDate.getTime() - currentDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 1000);
}

// Модель изолированного хранилища активных предложений обмена (SwapStore)
class InMemorySwapStore {
  constructor() {
    this.offers = new Map();
  }

  add(offer) {
    this.offers.set(offer.id, offer);
  }

  take(swapId) {
    if (!this.offers.has(swapId)) {
      return null;
    }
    const offer = this.offers.get(swapId);
    this.offers.delete(swapId); // Разовое извлечение: предложение удаляется
    return offer;
  }
}

describe('Модуль 05: swap_and_skip (логика обмена местами и пропуска очереди)', () => {
  const participants = [
    { id: 'part-1', name: 'Анна' },
    { id: 'part-2', name: 'Борис' },
    { id: 'part-3', name: 'Виктор' },
  ];

  // Тест 30
  it('Тест 30: Запрет отправки запроса на обмен местами самому себе', () => {
    const res = validateSwapRequest({
      fromId: 'part-1',
      toId: 'part-1',
      currentParticipantId: null,
      participants,
    });
    assert.equal(res.allowed, false);
    assert.match(res.reason, /самому себе/);
  });

  // Тест 31
  it('Тест 31: Запрет отправки запроса на обмен текущему обслуживаемому участнику', () => {
    const res = validateSwapRequest({
      fromId: 'part-2',
      toId: 'part-1',
      currentParticipantId: 'part-1',
      participants,
    });
    assert.equal(res.allowed, false);
    assert.match(res.reason, /уже вызвали/);
  });

  // Тест 32:
  it('Тест 32: Корректное определение 1-based позиции (fromPos) для уведомления об обмене', () => {
    const res = validateSwapRequest({
      fromId: 'part-2',
      toId: 'part-3',
      currentParticipantId: null,
      participants,
    });
    assert.equal(res.allowed, true);
    assert.equal(res.fromPos, 2); // Борис занимает 2-ю позицию в очереди
  });

  // Тест 33
  it('Тест 33: Расчет оставшегося времени пропуска (skipTimeLeft) в секундах', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    const skipUntil = new Date('2026-11-22T12:01:30Z'); // 90 секунд спустя

    const timeLeft = calculateSkipTimeLeft(skipUntil, now);
    assert.equal(timeLeft, 90);
  });

  // Тест 34
  it('Тест 34: Истечение времени пропуска: если skipUntil в прошлом, таймер возвращает 0', () => {
    const now = new Date('2026-11-22T12:05:00Z');
    const pastSkipUntil = new Date('2026-11-22T12:04:59Z');

    assert.equal(calculateSkipTimeLeft(pastSkipUntil, now), 0);
    assert.equal(calculateSkipTimeLeft(null, now), 0);
  });

  // Тест 35
  it('Тест 35: Жизненный цикл Swap-оффера: извлечение однократное, повторный запрос возвращает null', () => {
    const store = new InMemorySwapStore();
    const offer = { id: 'swap-999', fromId: 'part-1', toId: 'part-2' };

    store.add(offer);

    // Первое извлечение успешно
    const taken = store.take('swap-999');
    assert.deepEqual(taken, offer);

    // Второе извлечение (повторный клик или попытка гонки) возвращает null
    const takenAgain = store.take('swap-999');
    assert.equal(takenAgain, null);
  });
});
