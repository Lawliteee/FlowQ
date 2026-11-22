import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Модуль тестирования граничных случаев авторизации и сообщений чата (FlowQ).
 * Проверяет пограничную длину паролей, нормализацию email, граничную длину чата и XSS-защиту.
 */

// Эмуляция серверной валидации и нормализации учетных данных (auth_handlers.go)
function validateAndNormalizeAuthInput({ email, password }) {
  const normEmail = (email ?? '').trim().toLowerCase();
  const trimmedPassword = (password ?? '').trim();

  if (!normEmail || !password) {
    return { valid: false, error: 'Email and password are required' };
  }
  // Пароль не должен состоять из одних пробелов
  if (trimmedPassword.length === 0) {
    return { valid: false, error: 'Password cannot be only spaces' };
  }
  // Граничное условие: минимум 6 символов
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }

  return { valid: true, email: normEmail, password };
}

// Эмуляция обработки входящего сообщения в WebSocket-чате (websocket.go / handlers.go)
function processIncomingChatMessage(rawText, senderName) {
  const text = (rawText ?? '').trim();
  if (text.length === 0) {
    return null; // Пустые сообщения отбрасываются
  }

  // Граничное условие: ровно до 100 символов
  const truncated = text.length > 100 ? text.slice(0, 100) : text;
  const safeSender = (senderName ?? '').trim() || 'Участник';

  return {
    type: 'chat_message',
    senderName: safeSender,
    text: truncated,
  };
}

// Экранирование спецсимволов HTML для предотвращения XSS-инъекций в чате
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

describe('Модуль 08: edge_cases_auth_and_chat (граничные случаи аутентификации и сообщений чата)', () => {
  // Тест 49
  it('Тест 49: Граница длины пароля: ровно 5 символов отклоняется, ровно 6 символов принимается', () => {
    const res5 = validateAndNormalizeAuthInput({ email: 'test@mail.com', password: '12345' });
    assert.equal(res5.valid, false);
    assert.match(res5.error, /at least 6 characters/);

    const res6 = validateAndNormalizeAuthInput({ email: 'test@mail.com', password: '123456' });
    assert.equal(res6.valid, true);
  });

  // Тест 50
  it('Тест 50: Нормализация email: приведение к нижнему регистру и удаление начальных/конечных пробелов', () => {
    const res = validateAndNormalizeAuthInput({
      email: '  Admin.FlowQ@Example.COM  ',
      password: 'password123',
    });
    assert.equal(res.valid, true);
    assert.equal(res.email, 'admin.flowq@example.com');
  });

  // Тест 51
  it('Тест 51: Отклонение пароля, состоящего только из пробелов', () => {
    const res = validateAndNormalizeAuthInput({ email: 'user@mail.com', password: '      ' });
    assert.equal(res.valid, false);
    assert.match(res.error, /Password cannot be only spaces/);
  });

  // Тест 52
  it('Тест 52: Чат: игнорирование пустых сообщений и сообщений из одних пробелов', () => {
    assert.equal(processIncomingChatMessage('', 'Иван'), null);
    assert.equal(processIncomingChatMessage('     ', 'Иван'), null);
    assert.equal(processIncomingChatMessage(null, 'Иван'), null);
  });

  // Тест 53
  it('Тест 53: Граничная длина сообщения чата: ровно 100 символов сохраняются полностью, 101 символ обрезается до 100', () => {
    const exactly100 = 'X'.repeat(100);
    const msg100 = processIncomingChatMessage(exactly100, 'Анна');
    assert.equal(msg100.text.length, 100);
    assert.equal(msg100.text, exactly100);

    const len101 = 'Y'.repeat(101);
    const msg101 = processIncomingChatMessage(len101, 'Анна');
    assert.equal(msg101.text.length, 100);
    assert.equal(msg101.text, 'Y'.repeat(100));
  });

  // Тест 54
  it('Тест 54: Санитизация XSS: экранирование специальных символов (<, >, &, ") при отображении сообщений чата', () => {
    const malicious = '<script>alert("hack")</script> & "test"';
    const escaped = escapeHtml(malicious);

    assert.equal(escaped.includes('<script>'), false);
    assert.equal(escaped.includes('&lt;script&gt;'), true);
    assert.equal(escaped.includes('&amp;'), true);
    assert.equal(escaped.includes('&quot;'), true);
  });

  // Тест 55
  it('Тест 55: Имя отправителя по умолчанию ("Участник"), если имя не задано или состоит из пробелов', () => {
    const msgDefault = processIncomingChatMessage('Привет всем!', '');
    assert.equal(msgDefault.senderName, 'Участник');

    const msgSpaces = processIncomingChatMessage('Привет всем!', '   ');
    assert.equal(msgSpaces.senderName, 'Участник');

    const msgValid = processIncomingChatMessage('Привет всем!', 'Мария');
    assert.equal(msgValid.senderName, 'Мария');
  });
});
