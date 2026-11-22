import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Модуль тестирования очереди с приоритетами и состояний завершения (FlowQ).
 * Рассматривает сортировку участников по приоритету, сохранение FIFO при равном приоритете,
 * расчет ETA и защиту завершенной очереди.
 */

// Алгоритм упорядочивания участников в очереди с поддержкой приоритетов
function sortQueueParticipants(participants, hasPriority = false) {
  if (!hasPriority) {
    // Чистый FIFO по времени входа
    return [...participants].sort((a, b) => a.joinedAt - b.joinedAt);
  }

  // Приоритетная очередь:
  // 1. По убыванию приоритета (высший приоритет идет первым)
  // 2. При равном приоритете — по возрастанию времени входа (FIFO)
  return [...participants].sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return a.joinedAt - b.joinedAt;
  });
}

// Проверка возможности выполнения операций над очередью в зависимости от статуса завершения
function validateQueueActionAllowed(queueState, actionType) {
  if (queueState.finished) {
    return {
      allowed: false,
      reason: `Операция ${actionType} невозможна: очередь уже завершена`,
      statusCode: 400,
    };
  }
  return { allowed: true };
}

describe('Модуль 09: priority_queue (приоритеты участников и защита завершенной очереди)', () => {
  const t1 = new Date('2026-11-22T10:00:00Z').getTime();
  const t2 = new Date('2026-11-22T10:01:00Z').getTime();
  const t3 = new Date('2026-11-22T10:02:00Z').getTime();

  // Тест 56
  it('Тест 56: Приоритетная очередь: участник с более высоким приоритетом встает впереди участников с низким приоритетом', () => {
    const list = [
      { id: 'regular-1', name: 'Обычный 1', priority: 0, joinedAt: t1 },
      { id: 'regular-2', name: 'Обычный 2', priority: 0, joinedAt: t2 },
      { id: 'vip-1', name: 'VIP', priority: 2, joinedAt: t3 },
    ];

    const sorted = sortQueueParticipants(list, true);
    assert.equal(sorted[0].id, 'vip-1'); // VIP обогнал обычных, несмотря на более позднее время
    assert.equal(sorted[1].id, 'regular-1');
    assert.equal(sorted[2].id, 'regular-2');
  });

  // Тест 57
  it('Тест 57: Приоритетная очередь: при одинаковом приоритете порядок определяется строго по времени входа (FIFO)', () => {
    const list = [
      { id: 'vip-b', name: 'VIP Б', priority: 2, joinedAt: t2 },
      { id: 'vip-a', name: 'VIP А', priority: 2, joinedAt: t1 },
    ];

    const sorted = sortQueueParticipants(list, true);
    assert.equal(sorted[0].id, 'vip-a'); // t1 раньше t2
    assert.equal(sorted[1].id, 'vip-b');
  });

  // Тест 58
  it('Тест 58: Добавление участника с нулевым приоритетом в очередь с приоритетными помещает его в самый конец', () => {
    const list = [
      { id: 'vip-1', priority: 1, joinedAt: t1 },
      { id: 'vip-2', priority: 3, joinedAt: t2 },
      { id: 'regular', priority: 0, joinedAt: t1 - 1000 }, // зашел раньше всех, но приоритет 0
    ];

    const sorted = sortQueueParticipants(list, true);
    assert.equal(sorted[0].id, 'vip-2'); // приоритет 3
    assert.equal(sorted[1].id, 'vip-1'); // приоритет 1
    assert.equal(sorted[2].id, 'regular'); // приоритет 0 в конце
  });

  // Тест 59
  it('Тест 59: Корректный пересчет ETA в приоритетной очереди с учетом эффективной позиции участника', () => {
    const list = [
      { id: 'u1', priority: 0, joinedAt: t1 },
      { id: 'u2', priority: 2, joinedAt: t2 },
    ];
    const sorted = sortQueueParticipants(list, true);
    const avgWait = 5;

    // Эффективная позиция u2 (индекс 0): 5 мин; u1 (индекс 1): 10 мин
    const u2Index = sorted.findIndex((p) => p.id === 'u2');
    const u1Index = sorted.findIndex((p) => p.id === 'u1');

    assert.equal((u2Index + 1) * avgWait, 5);
    assert.equal((u1Index + 1) * avgWait, 10);
  });

  // Тест 60
  it('Тест 60: Исключение действий участников (вход, обмен, вызов), если очередь переведена в статус finished', () => {
    const activeQueue = { id: 'q1', finished: false };
    const finishedQueue = { id: 'q2', finished: true };

    assert.equal(validateQueueActionAllowed(activeQueue, 'join').allowed, true);
    assert.equal(validateQueueActionAllowed(finishedQueue, 'join').allowed, false);
    assert.equal(validateQueueActionAllowed(finishedQueue, 'swap').allowed, false);
    assert.equal(validateQueueActionAllowed(finishedQueue, 'callNext').allowed, false);
    assert.match(validateQueueActionAllowed(finishedQueue, 'join').reason, /уже завершена/);
  });
});
