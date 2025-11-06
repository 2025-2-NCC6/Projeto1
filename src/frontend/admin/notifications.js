// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';

// --- Mapeamento de Tipos ---
// Mapeia os tipos do seu banco para os estilos do HTML
const noticeMeta = {
    'Cancelamento': { text: 'Prioridade Baixa', color: 'priority-low', bar: 'priority-low' },
    'Prazo': { text: 'Prioridade Baixa', color: 'priority-low', bar: 'priority-low' },
    'Palestra': { text: 'Prioridade Baixa', color: 'priority-low', bar: 'priority-low' },
    'Aviso Geral': { text: 'Prioridade Média', color: 'priority-medium', bar: 'priority-medium' },
    // Você pode adicionar mais tipos no seu banco e mapeá-los aqui
    'Manutencao': { text: 'Prioridade Alta', color: 'priority-high', bar: 'priority-high' } 
};

// --- DOM ONLOAD ---
document.addEventListener('DOMContentLoaded', () => {
    loadNotices();

    // Adiciona listener para o botão "Arquivar Todas"
    const archiveAllBtn = document.getElementById('archive-all-btn');
    archiveAllBtn.addEventListener('click', archiveAllNotices);
});

/**
 * Carrega a lista de avisos da API
 */
async function loadNotices() {
    try {
        const response = await fetch(`${API_URL}/notices`);
        if (!response.ok) throw new Error('Erro ao buscar avisos');
        
        const notices = await response.json();
        const container = document.getElementById('notifications-container');
        container.innerHTML = ''; // Limpa o "Carregando..."

        if (notices.length === 0) {
            container.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">Nenhum alerta recente.</p>';
            return;
        }

        notices.forEach(notice => {
            // Usa o mapeamento de tipos
            const meta = noticeMeta[notice.type] || noticeMeta['Aviso Geral'];
            
            const noticeHtml = `
            <div class="flex items-start gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50" id="notice-${notice.id}">
                <div class="w-1.5 h-10 rounded-full bg-${meta.bar}"></div>
                <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div>
                        <p class="font-semibold text-gray-900 dark:text-white">${notice.title}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${notice.content}</p>
                    </div>
                    <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span class="material-symbols-outlined text-base">calendar_today</span>
                        <span>${new Date().toLocaleDateString()}</span> <!-- API não fornece data, usamos a de hoje -->
                    </div>
                    <div class="flex items-center md:justify-end gap-2">
                        <span class="px-3 py-1 text-xs font-semibold rounded-full bg-${meta.color}/10 text-${meta.color}">${meta.text}</span>
                        <button data-id="${notice.id}" class="btn-archive p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400">
                            <span class="material-symbols-outlined text-xl">archive</span>
                        </button>
                    </div>
                </div>
            </div>
            `;
            container.innerHTML += noticeHtml;
        });

        // Adiciona listeners para os novos botões de arquivar
        document.querySelectorAll('.btn-archive').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-id');
                archiveNotice(id);
            });
        });

    } catch (error) {
        console.error('Erro - loadNotices:', error);
    }
}

/**
 * Arquiva (deleta) um aviso específico
 */
async function archiveNotice(id) {
    if (!confirm('Tem certeza que deseja arquivar este aviso?')) return;

    try {
        const response = await fetch(`${API_URL}/notices/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Falha ao arquivar');

        // Remove o item da tela
        const element = document.getElementById(`notice-${id}`);
        if (element) {
            element.remove();
        }
        
    } catch (error) {
        console.error('Erro - archiveNotice:', error);
        alert('Não foi possível arquivar o aviso.');
    }
}

/**
 * Arquiva (deleta) TODOS os avisos
 */
async function archiveAllNotices() {
    if (!confirm('Tem certeza que deseja arquivar TODOS os avisos? Esta ação não pode ser desfeita.')) return;

    try {
        const response = await fetch(`${API_URL}/notices/all`, { // Rota nova
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Falha ao arquivar todos');

        // Limpa a tela
        const container = document.getElementById('notifications-container');
        container.innerHTML = '<p class="p-4 text-center text-gray-500 dark:text-gray-400">Nenhum alerta recente.</p>';

    } catch (error) {
        console.error('Erro - archiveAllNotices:', error);
        alert('Não foi possível arquivar todos os avisos.');
    }
}