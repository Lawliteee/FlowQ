<template>
  <div class="admin-page">

    <!-- Кнопка чата -->
    <button class="chat-btn" @click="showChat = true" title="Чат">
      <img src="/icons/chat.png" alt="чат" width="30" height="30" />
    </button>

    <!-- Верхняя панель -->
    <div class="queue-bar">
      <div class="queue-meta">
        <span class="queue-name" :title="queue.name">{{ queue.name }}</span>
        <span class="queue-time">начало: {{ queue.startTime }}</span>
      </div>
      <button class="btn-copy" :class="{ 'btn-copy--copied': copied }" @click="copyId">
        <span class="btn-text">{{ copied ? 'Скопировано' : 'Скопировать ID' }}</span>
      </button>
    </div>

    <!-- Текущий участник -->
    <div class="current-block" :class="{ 'current-block-ns': notStarted }">
      <div class="current-label">
        <span class="current-text">{{ notStarted ? 'Следующий:' : 'Текущий участник:' }}</span>
        <span class="current-number" v-if="!notStarted">#{{ queue.currentNumber }}</span>
      </div>
      <div class="current-participant-info">
        <span class="participant-name">{{ displayedParticipant?.name ?? '—' }}</span>
        <span class="participant-priority">Приоритет {{ displayedParticipant?.priority ?? '-' }}</span>
      </div>
    </div>

    <!-- Список участников -->
    <div class="participants-panel" :class="{ 'participants-panel-ns': notStarted }">
      <div
        v-for="(p, idx) in displayedParticipants"
        :key="p.id"
        class="participant-row"
        :class="{ 'participant-row--first': idx === 0 }"
      >
        <span class="p-number">{{ idx + 1 }}</span>
        <span class="p-name">{{ p.name }}</span>
        <button
          v-if="idx !== 0"
          class="btn-remove"
          @click="removeParticipant(p.id)"
          title="Исключить"
        >
          &times;
        </button>
      </div>
      <div v-if="displayedParticipants.length === 0" class="empty-list">Участников пока нет</div>
    </div>

    <!-- кнопки внизу -->
    <div class="actions">
      <button class="btn-secondary">Открыть чат</button>
      <button class="btn-next" @click="callNext">
        {{ notStarted ? 'Начать очередь' : 'Позвать следующего' }}
      </button>
      <button class="btn-secondary" @click="finishQueue">Завершить очередь</button>
    </div>
  </div>

  <ChatModal v-if="showChat" @close="showChat = false" />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import ChatModal from '../components/ChatModal.vue'

let pollTimer = null

const showChat = ref(false)

const notStarted = computed(() => queue.value.currentNumber === 0)

const route = useRoute()
const router = useRouter()

const queue = ref({
  id: null,
  name: '',
  startTime: '',
  currentNumber: 1,
  participants: [],
})

// Участник для отображения
const displayedParticipant = computed(
  () => queue.value.currentParticipant ?? queue.value.participants[0] ?? null,
)

// Список для отображения
const displayedParticipants = computed(() => {
  const cp = queue.value.currentParticipant
  if (!cp) {
    return queue.value.participants
  }
  return [cp, ...queue.value.participants] // Список с текущим и последующими участниками
})

onMounted(async () => {
  await fetchQueue()
  pollTimer = setInterval(fetchQueue, 1200)
})

onUnmounted(() => clearInterval(pollTimer))

async function fetchQueue() {
  const queueId = route.params.id
  try {
    const response = await axios.get(`http://localhost:8080/api/queues/${queueId}`)
    const data = response.data

    queue.value = {
      id: data.id,
      name: data.name,
      startTime: data.startTime || '12:00',
      currentNumber: data.currentNumber ?? null,
      participants: data.participants || [],
      currentParticipant: data.currentParticipant || null,
    }
  } catch (error) {
    console.error('Ошибка загрузки:', error)
  }
}

const copied = ref(false)
function copyId() {
  if (queue.value.id) {
    navigator.clipboard.writeText(queue.value.id)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  }
}

// Вызываем следующего участника
async function callNext() {
  const response = await axios.post(
    `http://localhost:8080/api/admin/queues/${route.params.id}/next`,
  )
  queue.value.currentNumber = response.data.currentNumber
  queue.value.participants = response.data.participant
  queue.value.currentParticipant = response.data.currentParticipant ?? null
}

// Удаляет участника очереди
async function removeParticipant(participantId) {
  await axios.delete(
    `http://localhost:8080/api/queues/${route.params.id}/participants/${participantId}`
  )

  // Новый массив без удаленного участника
  queue.value.participants = queue.value.participants.filter((p) => p.id !== participantId)
}

// Завершаем очередь
async function finishQueue() {
  await axios.post(`http://localhost:8080/api/admin/queues/${route.params.id}/finish`)
  router.push('/')
}
</script>

<style scoped>
.admin-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px 48px max(32px, env(safe-area-inset-bottom));
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  height: calc(100dvh - 80px);
  overflow: hidden;
  position: relative;
}

/* Чат */
.chat-btn {
  position: fixed;
  top: 90px;
  left: 20px;
  width: 46px;
  height: 46px;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 10;
}
.chat-btn:hover {
  background: var(--panel-hover);
}

.queue-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.queue-meta {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.queue-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.queue-time {
  font-size: 15px;
  font-weight: 400;
  color: var(--text-muted);
  white-space: nowrap;
}

.btn-copy {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Fira Sans', sans-serif;
  min-width: 140px;
  text-align: center;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-copy:hover {
  background: var(--panel-hover);
}

.btn-copy--copied,
.btn-copy--copied:hover {
  background: var(--primary-dark);
  border-color: var(--primary-dark);
  color: white;
}

.btn-text {
  display: inline-block;
  width: 100%;
}

.current-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px 28px;
  flex-wrap: wrap;
  flex-shrink: 0;
  padding: 8px 0;
}

.current-label {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.current-text {
  font-size: 36px;
  font-weight: 700;
  color: var(--text);
}

.current-number {
  font-size: 56px;
  font-weight: 700;
  color: var(--primary-dark);
  line-height: 1;
}

.current-participant-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.participant-name {
  font-size: 20px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.participant-priority {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
}

.participants-panel {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  box-shadow: var(--shadow-panel);
  padding: 8px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.participant-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
}

.participant-row + .participant-row {
  position: relative;
}

.participant-row + .participant-row::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 1px;
  background: var(--divider);
}

.participant-row--first {
  background: var(--input-bg);
  box-shadow: 0 1px 6px rgba(154, 85, 184, 0.12);
}

.participant-row--first + .participant-row::before {
  display: none;
}

.participant-row--first .p-name {
  font-weight: 700;
}

.p-number {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--panel-hover);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.participant-row--first .p-number {
  background: var(--primary-dark);
  color: white;
}

.p-name {
  font-size: 15px;
  font-weight: 400;
  color: var(--text);
  min-width: 0;
  overflow-wrap: anywhere;
}

.empty-list {
  padding: 40px 28px;
  text-align: center;
  color: var(--text-muted);
  font-size: 15px;
}

/* Кнопка исключения участника */
.btn-remove {
  margin-left: auto;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}

.btn-remove:hover {
  background: var(--panel-hover);
  color: #d04a4a;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-shrink: 0;
  margin-top: auto;
}

.btn-secondary {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Fira Sans', sans-serif;
  transition: background 0.2s;
  white-space: nowrap;
}

.btn-secondary:hover {
  background: var(--panel-hover);
}

.btn-next {
  background: var(--primary-button);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 12px 36px;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  font-family: 'Fira Sans', sans-serif;
  transition: background 0.18s;
  white-space: nowrap;
}

.btn-next:hover {
  background: var(--primary-button-hover);
}

.btn-copy:focus-visible,
.btn-secondary:focus-visible,
.btn-next:focus-visible,
.btn-remove:focus-visible,
.chat-btn:focus-visible {
  outline: 2px solid var(--primary-dark);
  outline-offset: 2px;
}

.participants-panel-ns {
  opacity: 0.4;
}

.current-block-ns {
  opacity: 0.4;
}

@media (max-width: 1024px) {
  .admin-page {
    padding: 16px 32px max(28px, env(safe-area-inset-bottom));
  }

  .chat-btn {
    display: none;
  }

  .current-text {
    font-size: 30px;
  }

  .current-number {
    font-size: 48px;
  }
}

@media (max-width: 768px) {
  .admin-page {
    padding: 16px 16px max(20px, env(safe-area-inset-bottom));
    gap: 16px;
    height: auto;
    min-height: calc(100dvh - 80px);
    overflow: visible;
  }

  /* название на всю строку, время и кнопка копирования - ниже */
  .queue-bar {
    flex-wrap: wrap;
    gap: 10px 12px;
  }

  .queue-meta {
    flex: 1 1 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .queue-name {
    font-size: 18px;
    max-width: 100%;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .btn-copy {
    width: 100%;
  }

  .current-block {
    flex-direction: column;
    gap: 6px;
    text-align: center;
  }

  .current-label {
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .current-text {
    font-size: 22px;
  }

  .current-number {
    font-size: 44px;
  }

  .current-participant-info {
    align-items: center;
  }

  .participants-panel {
    flex: 1 1 auto;
    min-height: 200px;
    max-height: 55dvh;
  }

  .actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-top: 0;
  }

  .btn-next {
    order: -1;
    padding: 14px 20px;
  }

  .btn-secondary {
    padding: 13px 20px;
  }
}
</style>

