import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api';

function randomEmail() {
  const rand = Math.random().toString(36).substring(2, 8);
  return `integration_${Date.now()}_${rand}@flowq-test.local`;
}

function randomQueueName(prefix = 'Интеграционная очередь') {
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix} [${Date.now()}-${rand}]`;
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('Интеграционный модуль 03: Admin API (авторизованное управление очередью)', () => {
  let adminToken = null;
  let adminUserId = null;
  let queueId = null;
  let participantId = null;

  before(async () => {
    // Регистрируем администратора
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail(),
        password: 'AdminPassword123!',
        displayName: 'Главный Администратор',
      }),
    });
    const regData = await regRes.json();
    adminToken = regData.token;
    adminUserId = regData.user.id;

    // Создаем тестовую очередь с привязкой к админу
    const qRes = await fetch(`${BASE_URL}/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queueName: randomQueueName('Admin Queue Test'),
        description: 'Тест панели администратора',
        startTime: '11:00',
        maxParticipants: 10,
        hasPriority: false,
        priorityCount: 0,
        initialPriority: 0,
        skipFeature: true,
        skipDuration: 10,
        imFreeFeature: true,
        swapPositions: true,
        admins: [adminUserId],
      }),
    });
    const qData = await qRes.json();
    queueId = qData.id;

    // Добавляем участника в очередь
    const joinRes = await fetch(`${BASE_URL}/queues/${queueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ожидающий Участник', userId: '' }),
    });
    const joinData = await joinRes.json();
    participantId = joinData.participantId;
  });

  // Тест 13
  it('Тест 13: Защита админских маршрутов: запрос без JWT токена отклоняется (401 Unauthorized)', async () => {
    const res = await fetch(`${BASE_URL}/admin/queues/${queueId}/next`, {
      method: 'POST',
    });
    assert.equal(res.status, 401, 'Запрос без Authorization заголовка должен возвращать 401');
  });

  // Тест 14
  it('Тест 14: Защита админских маршрутов: запрос с невалидным JWT токеном отклоняется (401 Unauthorized)', async () => {
    const res = await fetch(`${BASE_URL}/admin/queues/${queueId}/next`, {
      method: 'POST',
      headers: { Authorization: 'Bearer fake.invalid.jwt.token' },
    });
    assert.equal(res.status, 401, 'Запрос с недействительным токеном должен возвращать 401');
  });

  // Тест 15
  it('Тест 15: Вызов следующего участника администратором через POST /api/admin/queues/:id/next', async () => {
    const res = await fetch(`${BASE_URL}/admin/queues/${queueId}/next`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(adminToken),
      },
    });

    assert.equal(res.status, 200, 'Ожидался статус 200 OK при вызове');
    const data = await res.json();
    assert.equal(data.currentNumber, 1, 'currentNumber должен вырасти до 1');
    assert.ok(data.currentParticipant, 'Должен быть указан вызванный участник');
    assert.equal(data.currentParticipant.id, participantId);
  });

  // Тест 16
  it('Тест 16: Получение очередей текущего пользователя через GET /api/admin/users/me/queues', async () => {
    const res = await fetch(`${BASE_URL}/admin/users/me/queues`, {
      headers: authHeader(adminToken),
    });

    assert.equal(res.status, 200, 'Ожидался статус 200 OK');
    const data = await res.json();
    assert.ok(Array.isArray(data.adminQueues), 'adminQueues должен быть массивом');
    assert.ok(Array.isArray(data.participantQueues), 'participantQueues должен быть массивом');
  });

  // Тест 17
  it('Тест 17: Завершение очереди администратором через POST /api/admin/queues/:id/finish', async () => {
    const res = await fetch(`${BASE_URL}/admin/queues/${queueId}/finish`, {
      method: 'POST',
      headers: authHeader(adminToken),
    });
    assert.equal(res.status, 200, 'Ожидался статус 200 OK при завершении');

    // Проверяем, что флаг finished = true
    const checkRes = await fetch(`${BASE_URL}/queues/${queueId}`);
    const checkData = await checkRes.json();
    assert.equal(checkData.finished, true, 'Поле finished очереди должно стать true');
  });
});
