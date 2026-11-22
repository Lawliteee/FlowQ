import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api';

function randomEmail() {
  const rand = Math.random().toString(36).substring(2, 8);
  return `integration_${Date.now()}_${rand}@flowq-test.local`;
}

describe('Интеграционный модуль 01: Auth API (регистрация и авторизация)', () => {
  const testEmail = randomEmail();
  const testPassword = 'StrongPassword123!';
  const testDisplayName = 'Интеграционный Тестировщик';

  // Тест 1
  it('Тест 1: Регистрация нового пользователя возвращает токен и профиль (POST /api/auth/register)', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        displayName: testDisplayName,
      }),
    });

    assert.equal(res.status, 201, 'Ожидался статус 201 Created');
    const data = await res.json();

    assert.ok(data.token, 'В ответе должен присутствовать JWT токен');
    assert.ok(data.user, 'В ответе должен присутствовать объект user');
    assert.equal(data.user.email, testEmail.toLowerCase());
    assert.equal(data.user.displayName, testDisplayName);
  });

  // Тест 2
  it('Тест 2: Запрет повторной регистрации с тем же email (возврат 409 Conflict)', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'AnotherPassword999',
        displayName: 'Дубликат',
      }),
    });

    assert.equal(res.status, 409, 'Ожидался статус 409 Conflict');
  });

  // Тест 3
  it('Тест 3: Отклонение регистрации при пароле короче 6 символов (возврат 400 Bad Request)', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail(),
        password: '123', // короче 6 символов
        displayName: 'Короткий пароль',
      }),
    });

    assert.equal(res.status, 400, 'Ожидался статус 400 Bad Request');
  });

  // Тест 4
  it('Тест 4: Успешная аутентификация через POST /api/auth/login с выдачей JWT токена', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    assert.equal(res.status, 200, 'Ожидался статус 200 OK');
    const data = await res.json();
    assert.ok(data.token, 'Должен быть выдан токен авторизации');
    assert.equal(data.user.email, testEmail.toLowerCase());
  });

  // Тест 5
  it('Тест 5: Отклонение входа с неверным паролем (возврат 401 Unauthorized)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'IncorrectPassword!',
      }),
    });

    assert.equal(res.status, 401, 'Ожидался статус 401 Unauthorized');
  });

  // Тест 6
  it('Тест 6: Отклонение входа с несуществующим email (возврат 401 Unauthorized)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody_exists_here_never@flowq-test.local',
        password: 'SomePassword',
      }),
    });

    assert.equal(res.status, 401, 'Ожидался статус 401 Unauthorized');
  });
});
