import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api';

function randomQueueName(prefix = 'Интеграционная очередь') {
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix} [${Date.now()}-${rand}]`;
}

describe('Интеграционный модуль 02: Queue Lifecycle API (создание, чтение, вход и выход)', () => {
  let createdQueueId = null;
  let participant1Id = null;
  let participant2Id = null;
  const queueName = randomQueueName('Интеграция Lifecycle');

  // Тест 7
  it('Тест 7: Создание новой очереди через POST /api/queues с получением ID и ссылки', async () => {
    const res = await fetch(`${BASE_URL}/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queueName,
        description: 'Очередь для интеграционного тестирования жизненного цикла',
        startTime: '10:00',
        maxParticipants: 2, // лимит 2 участника для проверки переполнения
        hasPriority: false,
        priorityCount: 0,
        initialPriority: 0,
        skipFeature: true,
        skipDuration: 10,
        imFreeFeature: true,
        swapPositions: true,
        admins: [],
      }),
    });

    assert.equal(res.status, 201, 'Ожидался статус 201 Created');
    const data = await res.json();
    assert.ok(data.id, 'Очередь должна иметь UUID');
    assert.equal(data.name, queueName);
    assert.ok(data.link.includes(data.id), 'Ссылка должна содержать ID очереди');

    createdQueueId = data.id;
  });

  // Тест 8
  it('Тест 8: Получение подробной информации об очереди через GET /api/queues/:id', async () => {
    const res = await fetch(`${BASE_URL}/queues/${createdQueueId}`);
    assert.equal(res.status, 200, 'Ожидался статус 200 OK');

    const data = await res.json();
    assert.equal(data.id, createdQueueId);
    assert.equal(data.name, queueName);
    assert.equal(data.currentNumber, 0);
    assert.equal(data.finished, false);
    assert.equal(data.maxParticipants, 2);
    assert.ok(Array.isArray(data.participants), 'Список участников должен быть массивом');
    assert.equal(data.participants.length, 0);
  });

  // Тест 9
  it('Тест 9: Запрос несуществующей очереди возвращает статус 404 Not Found', async () => {
    const res = await fetch(`${BASE_URL}/queues/non_existent_queue_uuid_9999`);
    assert.equal(res.status, 404, 'Ожидался статус 404 Not Found');
  });

  // Тест 10
  it('Тест 10: Вступление участников в созданную очередь через POST /api/queues/:id/join', async () => {
    // Первый участник
    const res1 = await fetch(`${BASE_URL}/queues/${createdQueueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Участник 1', userId: '' }),
    });
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.ok(data1.participantId);
    assert.equal(data1.position, 1);
    participant1Id = data1.participantId;

    // Второй участник
    const res2 = await fetch(`${BASE_URL}/queues/${createdQueueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Участник 2', userId: '' }),
    });
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.ok(data2.participantId);
    assert.equal(data2.position, 2);
    participant2Id = data2.participantId;
  });

  // Тест 11
  it('Тест 11: Превышение лимита участников maxParticipants блокируется с кодом 409 Conflict', async () => {
    // Лимит был задан равным 2. Третий участник должен получить 409 Conflict
    const res = await fetch(`${BASE_URL}/queues/${createdQueueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Участник 3 (Лишний)', userId: '' }),
    });

    assert.equal(res.status, 409, 'Ожидался статус 409 Conflict (Queue is full)');
  });

  // Тест 12
  it('Тест 12: Выход участника из очереди через DELETE /api/queues/:id/participants/:pid', async () => {
    // Участник 2 покидает очередь
    const res = await fetch(`${BASE_URL}/queues/${createdQueueId}/participants/${participant2Id}`, {
      method: 'DELETE',
    });
    assert.equal(res.status, 200, 'Ожидался статус 200 OK при выходе');

    // Проверяем, что в очереди остался только 1 участник
    const qRes = await fetch(`${BASE_URL}/queues/${createdQueueId}`);
    const qData = await qRes.json();
    assert.equal(qData.participants.length, 1);
    assert.equal(qData.participants[0].id, participant1Id);
  });
});
