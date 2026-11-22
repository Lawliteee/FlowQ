import { test, expect } from '@playwright/test';

// Хелпер для быстрой регистрации админа и создания очереди через API
async function setupAdminAndQueue(request) {
  const email = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}@flowq-e2e.local`;
  const regRes = await request.post('http://localhost:8080/api/auth/register', {
    data: {
      email,
      password: 'AdminPassword123!',
      displayName: 'Тестовый Админ',
    },
  });
  const authData = await regRes.json();

  const qRes = await request.post('http://localhost:8080/api/queues', {
    data: {
      queueName: `E2E Реалтайм Очередь [${Date.now()}]`,
      description: 'Очередь для тестирования двух окон в браузере',
      startTime: '',
      maxParticipants: 10,
      hasPriority: false,
      priorityCount: 0,
      initialPriority: 0,
      skipFeature: true,
      skipDuration: 10,
      imFreeFeature: true,
      swapPositions: true,
      admins: [authData.user.id],
    },
  });
  const qData = await qRes.json();
  return { queueId: qData.id, adminUser: authData.user, adminToken: authData.token };
}

test.describe('E2E Модуль 03: Реалтайм-взаимодействие (два окна, чат и продвижение очереди)', () => {
  let queueId;
  let adminToken;
  let adminUser;

  test.beforeEach(async ({ request }) => {
    const setup = await setupAdminAndQueue(request);
    queueId = setup.queueId;
    adminToken = setup.adminToken;
    adminUser = setup.adminUser;
  });

  // Тест 9
  test('Тест 9: Вступление участника в очередь по ID и переход на экран ожидания (/queue/:id)', async ({ page }) => {
    await page.goto('/');

    // Открываем модалку вступления
    await page.locator('button.btn-primary1', { hasText: 'Вступить в очередь' }).click();

    // Заполняем поля
    await page.locator('.modal input[placeholder="Ваше имя"]').fill('Алексей Участник');
    await page.locator('.modal input[placeholder="Идентификатор очереди"]').fill(queueId);

    // Нажимаем "Вступить"
    await page.locator('.modal button.modal-btn', { hasText: 'Вступить' }).click();

    // Проверяем редирект на экран ожидания
    await expect(page).toHaveURL(new RegExp(`/queue/${queueId}`));
    await expect(page.locator('.queue-title')).toBeVisible();

    // Поскольку очередь еще не запущена админом, статус "Очередь ещё не началась"
    await expect(page.locator('p.wait-time')).toContainText('Очередь ещё не началась');
  });

  // Тест 10
  test('Тест 10: Открытие списка участников и отправка сообщения в чат на экране очереди', async ({ page }) => {
    // Вступаем в очередь
    await page.goto('/');
    await page.locator('button.btn-primary1').click();
    await page.locator('.modal input[placeholder="Ваше имя"]').fill('Ольга Чат');
    await page.locator('.modal input[placeholder="Идентификатор очереди"]').fill(queueId);
    await page.locator('.modal button.modal-btn').click();
    await expect(page).toHaveURL(new RegExp(`/queue/${queueId}`));

    // 1. Открытие списка участников (кнопка бургер)
    await page.locator('button.burger-btn').click();
    const participantsModal = page.locator('.modal');
    await expect(participantsModal).toBeVisible();
    await participantsModal.locator('.btn-close').click();
    await expect(participantsModal).not.toBeVisible();

    // 2. Открытие окна чата
    await page.locator('button.chat-btn').click();
    const chatModal = page.locator('.chat-modal');
    await expect(chatModal).toBeVisible();

    // Ввод и отправка сообщения
    const chatInput = chatModal.locator('input.chat-input');
    await chatInput.fill('Привет всем участникам очереди!');
    await chatModal.locator('button.btn-send').click();

    // Сообщение отображается в списке сообщений
    await expect(chatModal.locator('.chat-body')).toContainText('Привет всем участникам очереди!');

    // Закрытие чата
    await chatModal.locator('.btn-close').click();
    await expect(chatModal).not.toBeVisible();
  });

  // Тест 11
  test('Тест 11: Реалтайм-синхронизация двух вкладок: админ вызывает участника, у участника появляется "Ваша очередь!"', async ({ browser }) => {
    // 1. Создаем две независимые сессии браузера: админ (авторизован куками) и участник
    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      { name: 'token', value: adminToken, domain: 'localhost', path: '/' },
      { name: 'user', value: JSON.stringify(adminUser), domain: 'localhost', path: '/' },
    ]);

    const participantContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const participantPage = await participantContext.newPage();

    // 2. Участник вступает в очередь
    await participantPage.goto('/');
    await participantPage.locator('button.btn-primary1').click();
    await participantPage.locator('.modal input[placeholder="Ваше имя"]').fill('Виктор Тестер');
    await participantPage.locator('.modal input[placeholder="Идентификатор очереди"]').fill(queueId);
    await participantPage.locator('.modal button.modal-btn').click();
    await expect(participantPage).toHaveURL(new RegExp(`/queue/${queueId}`));

    // 3. Админ открывает панель управления /admin/:id
    await adminPage.goto(`/admin/${queueId}`);
    await expect(adminPage.locator('.queue-name')).toBeVisible();

    // 4. Админ нажимает "Начать очередь"
    const callNextBtn = adminPage.locator('button.btn-next');
    await callNextBtn.click();

    // 5. У участника на экране БЕЗ перезагрузки страницы реактивно появляется баннер "Ваша очередь!"
    await expect(participantPage.locator('p.your-turn')).toHaveText('Ваша очередь!', { timeout: 10000 });

    // Очистка контекстов
    await adminContext.close();
    await participantContext.close();
  });

  // Тест 12
  test('Тест 12: Нажатие кнопки "Я освободился" завершает обслуживание участника и возвращает на главную', async ({ browser }) => {
    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      { name: 'token', value: adminToken, domain: 'localhost', path: '/' },
      { name: 'user', value: JSON.stringify(adminUser), domain: 'localhost', path: '/' },
    ]);

    const participantContext = await browser.newContext();

    const adminPage = await adminContext.newPage();
    const participantPage = await participantContext.newPage();

    // Участник вступает в очередь
    await participantPage.goto('/');
    await participantPage.locator('button.btn-primary1').click();
    await participantPage.locator('.modal input[placeholder="Ваше имя"]').fill('Сергей Свободен');
    await participantPage.locator('.modal input[placeholder="Идентификатор очереди"]').fill(queueId);
    await participantPage.locator('.modal button.modal-btn').click();
    await expect(participantPage).toHaveURL(new RegExp(`/queue/${queueId}`));

    // Админ вызывает участника
    await adminPage.goto(`/admin/${queueId}`);
    await adminPage.locator('button.btn-next').click();

    // Участник видит "Ваша очередь!" и кнопку "Я освободился"
    await expect(participantPage.locator('p.your-turn')).toBeVisible({ timeout: 10000 });
    const freeBtn = participantPage.locator('button.btn-leave', { hasText: 'Я освободился' });
    await expect(freeBtn).toBeVisible();

    // Участник нажимает "Я освободился"
    await freeBtn.click();

    // Проверяем возврат участника на главную страницу "/"
    await expect(participantPage).toHaveURL(/\/$/, { timeout: 7000 });

    await adminContext.close();
    await participantContext.close();
  });
});
