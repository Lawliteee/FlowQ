<template>
  <main>
    <!-- Заголовок -->
    <h1>Управляйте очередями без хаоса и потери времени!</h1>
    <p class="subtitle">
      FlowQ - гибкая система виртуальных очередей с чатом, обменом местами и приоритетами
    </p>

    <!-- Кнопки ролей -->
    <section class="role-section">
      <h2>Выберите роль:</h2>
      <div class="role-cards">
        <div class="role-card">
          <span class="role-label">Участник</span>
          <button class="btn-primary1" @click="modalOpen = true">Вступить в очередь</button>
        </div>
        <div class="role-card">
          <span class="role-label">Организатор</span>
          <button class="btn-primary2" @click="router.push('/create-queue')">
            Создать очередь
          </button>
        </div>
      </div>
    </section>
  </main>

  <JoinQueueModal v-if="modalOpen" @close="modalOpen = false" />
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import JoinQueueModal from '../components/JoinModal.vue'

const router = useRouter()
const modalOpen = ref(false) // Открыто ли окно
</script>

<style scoped>
main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 70px 20px;
  text-align: center;
}

h1 {
  font-size: 40px;
  font-weight: 400;
  color: var(--text);
  max-width: 1200px;
  line-height: 1.2;
  margin-bottom: 14px;
  margin-top: 20px;
}

.subtitle {
  font-size: 16px;
  color: var(--text-muted);
  font-weight: 400;
  max-width: 360px;
  line-height: 1.6;
  margin-bottom: 92px;
}

.role-section h2 {
  font-size: 28px;
  font-weight: 400;
  margin-bottom: 28px;
  color: var(--text);
}

.role-cards {
  display: flex;
}

.role-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0 40px;
}

.role-card + .role-card {
  border-left: 2px solid var(--divider);
}

.role-label {
  font-size: 18px;
  font-weight: 400;
  color: var(--text);
}

.btn-primary1,
.btn-primary2 {
  background: var(--primary-dark);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 14px 32px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  font-family: 'Fira Sans', sans-serif;
  transition: background 0.18s;
  white-space: nowrap;
}

.btn-primary2 {
  padding: 14px 40px;
}

.btn-primary1:hover,
.btn-primary2:hover {
  background: var(--primary-hover);
}

@media (max-width: 1024px) {
  main {
    padding: 50px 20px;
  }

  h1 {
    font-size: 34px;
  }
}

@media (max-width: 768px) {
  main {
    padding: 30px 16px;
  }

  h1 {
    font-size: 26px;
  }

  .subtitle {
    margin-bottom: 48px;
  }

  .role-section h2 {
    font-size: 24px;
  }

  /* карточки ролей друг под другом */
  .role-cards {
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .role-card {
    padding: 0;
  }

  .role-card + .role-card {
    border-left: none;
    border-top: 2px solid var(--divider);
    padding-top: 24px;
  }
}
</style>
