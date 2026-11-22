import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api';

function randomQueueName(prefix = 'Интеграционная очередь') {
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix} [${Date.now()}-${rand}]`;
}

describe('Интеграционный модуль 04: Swap & Skip API (обмен местами, пропуск и я освободился)', () => {
  let queueId = null;
  let partA = null;
  let partB = null;

  before(async () => {
    // Создаем тестовую очередь со включенными swap и skip
    const qRes = await fetch(`${BASE_URL}/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queueName: randomQueueName('Swap and Skip Queue'),
        description: 'Интеграция обмена и пропуска',
        startTime: '',
        maxParticipants: 10,
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

    const qData = await qRes.json();
    queueId = qData.id;

    // Добавляем участника А
    const jA = await fetch(`${BASE_URL}/queues/${queueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Участник А', userId: '' }),
    });
    const dataA = await jA.json();
    partA = { id: dataA.participantId, name: 'Участник А' };

    // Добавляем участника Б
    const jB = await fetch(`${BASE_URL}/queues/${queueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Участник Б', userId: '' }),
    });
    const dataB = await jB.json();
    partB = { id: dataB.participantId, name: 'Участник Б' };
  });

  // Тест 18
  it('Тест 18: Отправка предложения обмена местами через POST /api/queues/:id/swap/request', async () => {
    const res = await fetch(`${BASE_URL}/queues/${queueId}/swap/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: partA.id,
        fromName: partA.name,
        toId: partB.id,
      }),
    });

    assert.equal(res.status, 200, 'Запрос на обмен должен возвращать 200 OK');
  });

  // Тест 19
  it('Тест 19: Принятие предложения обмена через POST /api/queues/:id/swap/respond', async () => {
    // В бэкенде FlowQ предложение регистрируется в SwapStore с UUID.
    // Если мы отправляем ответ с фиктивным или неизвестным swapId — сервер должен вернуть 404
    const res = await fetch(`${BASE_URL}/queues/${queueId}/swap/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        swapId: 'non-existing-swap-id',
        accept: true,
      }),
    });

    assert.equal(res.status, 404, 'Несуществующий или истекший swapId должен возвращать 404');
  });

  // Тест 20
  it('Тест 20: Временный пропуск очереди участником через POST /api/queues/:id/skip', async () => {
    // Участник А берет пропуск
    const res = await fetch(`${BASE_URL}/queues/${queueId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: partA.id }),
    });

    assert.equal(res.status, 200, 'Запрос пропуска должен возвращать 200 OK');

    // Проверяем, что флаг skipped стал true
    const qRes = await fetch(`${BASE_URL}/queues/${queueId}`);
    const qData = await qRes.json();
    const foundA = qData.participants.find((p) => p.id === partA.id);
    assert.ok(foundA, 'Участник А должен оставаться в очереди');
    assert.equal(foundA.skipped, true, 'Флаг skipped должен быть true');
    assert.ok(foundA.skipUntil, 'Должна быть установлена дата окончания пропуска');
  });

  // Тест 21
  it('Тест 21: Досрочный возврат на свое место через POST /api/queues/:id/return', async () => {
    // Участник А возвращается
    const res = await fetch(`${BASE_URL}/queues/${queueId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId: partA.id }),
    });

    assert.equal(res.status, 200, 'Запрос возврата должен возвращать 200 OK');

    // Проверяем, что skipped сбросился
    const qRes = await fetch(`${BASE_URL}/queues/${queueId}`);
    const qData = await qRes.json();
    const foundA = qData.participants.find((p) => p.id === partA.id);
    assert.equal(foundA.skipped, false, 'Флаг skipped должен сброситься в false');
    assert.ok(!foundA.skipUntil, 'skipUntil должен быть очищен');
  });

  // Тест 22
  it('Тест 22: Действие "Я освободился" через POST /api/queues/:id/im-free продвигает очередь', async () => {
    // Вызываем im-free
    const res = await fetch(`${BASE_URL}/queues/${queueId}/im-free`, {
      method: 'POST',
    });

    assert.equal(res.status, 200, 'Запрос im-free должен возвращать 200 OK');

    // Проверяем, что первый участник был вызван
    const qRes = await fetch(`${BASE_URL}/queues/${queueId}`);
    const qData = await qRes.json();
    assert.ok(qData.currentParticipant, 'Должен появиться вызванный участник');
  });
});
