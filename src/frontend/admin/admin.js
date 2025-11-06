// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';
// !!!!!!!!!!!!!!!!!! ATENÇÃO !!!!!!!!!!!!!!!!!!
// MUDE ESTE ID para o ID do Coordenador/Admin logado
// (Ex: 5, para "Lucca Giordano" da sua lista)
const CURRENT_ADMIN_ID = 5; 
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// --- DOM ONLOAD ---
document.addEventListener('DOMContentLoaded', () => {
    loadPageData();
});

/**
 * Carrega todos os dados da página em paralelo
 */
function loadPageData() {
    loadAdminInfo(CURRENT_ADMIN_ID);
    loadMetrics();
    loadRoomStatus();
}

/**
 * Carrega o nome do admin e o total de notificações
 */
async function loadAdminInfo(adminId) {
    try {
        const response = await fetch(`${API_URL}/users/${adminId}`);
        if (!response.ok) throw new Error('Admin não encontrado');
        
        const admin = await response.json();
        document.getElementById('admin-welcome').textContent = `Olá ${admin.name}, bem-vindo de volta!`;
    } catch (error) {
        console.error('Erro - loadAdminInfo:', error);
        document.getElementById('admin-welcome').textContent = 'Olá, bem-vindo de volta!';
    }
    
    // Carrega o contador de notificações
    try {
        const response = await fetch(`${API_URL}/notices`);
        const notices = await response.json();
        document.getElementById('notification-badge').textContent = notices.length;
    } catch (error) {
        console.error('Erro - loadNotices count:', error);
    }
}

/**
 * Carrega os 4 cards de métricas
 */
async function loadMetrics() {
    // 1. Alunos e Professores
    try {
        const response = await fetch(`${API_URL}/users`);
        const users = await response.json();
        
        const totalAlunos = users.filter(u => u.role === 'Aluno').length;
        const totalProfessores = users.filter(u => u.role === 'Professor').length;
        
        document.getElementById('metric-alunos').textContent = totalAlunos;
        document.getElementById('metric-professores').textContent = totalProfessores;
        
    } catch (error) {
        console.error('Erro - loadMetrics (Users):', error);
    }

    // 2. Média de Presença
    try {
        const response = await fetch(`${API_URL}/metrics/attendance/overall`);
        const data = await response.json();
        document.getElementById('metric-presenca').textContent = `${data.percentage}%`;
        
    } catch (error) {
        console.error('Erro - loadMetrics (Attendance):', error);
    }

    // 3. Ocupação das Salas
    try {
        const response = await fetch(`${API_URL}/rooms`);
        const rooms = await response.json();
        
        const totalSalas = rooms.length;
        const salasOcupadas = rooms.filter(r => r.status === 'Em Aula').length;
        
        const ocupacao = totalSalas > 0 ? Math.round((salasOcupadas / totalSalas) * 100) : 0;
        document.getElementById('metric-ocupacao').textContent = `${ocupacao}%`;
        
    } catch (error) {
        console.error('Erro - loadMetrics (Rooms):', error);
    }
}

/**
 * Carrega a lista de status de salas em tempo real
 */
async function loadRoomStatus() {
    try {
        const response = await fetch(`${API_URL}/rooms/detailed`); // Rota nova
        if (!response.ok) throw new Error('Erro ao buscar salas');
        
        const rooms = await response.json();
        const container = document.getElementById('room-status-container');
        container.innerHTML = '';

        if (rooms.length === 0) {
            container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Nenhuma sala cadastrada.</p>';
            return;
        }

        const statusStyles = {
            'Em Aula': { text: 'Em Aula', color: 'status-green', dot: 'status-green' },
            'Livre': { text: 'Livre', color: 'status-blue', dot: 'status-blue' },
            'Manutencao': { text: 'Manutenção', color: 'status-red', dot: 'status-red' },
            'Alerta': { text: 'Alerta', color: 'status-yellow', dot: 'status-yellow' }
            // Adicione "Alerta" no CHECK da tabela Rooms se quiser usar
        };

        rooms.forEach(room => {
            const style = statusStyles[room.status] || statusStyles['Livre'];
            const course = room.course_name ? `${room.course_name} - Prof. ${room.professor_name || 'N/D'}` : 'Nenhuma aula associada';

            const roomHtml = `
            <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div>
                    <p class="font-semibold text-gray-800 dark:text-white">${room.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${course}</p>
                </div>
                <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-${style.color}/10 text-${style.color}">
                    <span class="w-2 h-2 rounded-full bg-${style.dot}"></span>
                    <p class="text-sm font-medium">${style.text}</p>
                </div>
            </div>
            `;
            container.innerHTML += roomHtml;
        });

    } catch (error) {
        console.error('Erro - loadRoomStatus:', error);
    }
}