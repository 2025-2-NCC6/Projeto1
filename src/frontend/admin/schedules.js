// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';

// --- DOM ONLOAD ---
document.addEventListener('DOMContentLoaded', () => {
    loadPageData();
});

/**
 * Carrega todos os dados da página (filtros e tabela)
 */
function loadPageData() {
    loadFilters();
    loadSchedules();
}

/**
 * Carrega os dados para os <select> de filtro
 */
async function loadFilters() {
    try {
        // Carrega Professores
        const usersResponse = await fetch(`${API_URL}/users`);
        const users = await usersResponse.json();
        const teacherSelect = document.getElementById('teacher-filter');
        users.filter(u => u.role === 'Professor').forEach(prof => {
            teacherSelect.innerHTML += `<option value="${prof.id}">${prof.name}</option>`;
        });

        // Carrega Disciplinas
        const coursesResponse = await fetch(`${API_URL}/courses`);
        const courses = await coursesResponse.json();
        const classSelect = document.getElementById('class-filter');
        courses.forEach(course => {
            classSelect.innerHTML += `<option value="${course.id}">${course.name}</option>`;
        });

        // Carrega Salas
        const roomsResponse = await fetch(`${API_URL}/rooms`);
        const rooms = await roomsResponse.json();
        const roomSelect = document.getElementById('room-filter');
        rooms.forEach(room => {
            roomSelect.innerHTML += `<option value="${room.id}">${room.name}</option>`;
        });

    } catch (error) {
        console.error('Erro - loadFilters:', error);
    }
}

/**
 * Carrega a tabela principal de horários
 */
async function loadSchedules() {
    try {
        const response = await fetch(`${API_URL}/schedules/detailed`); // Rota nova
        if (!response.ok) throw new Error('Erro ao buscar horários');
        
        const schedules = await response.json();
        const container = document.getElementById('schedules-table-body');
        container.innerHTML = ''; // Limpa o "Carregando..."

        if (schedules.length === 0) {
            container.innerHTML = `<tr class="bg-white dark:bg-gray-800"><td colspan="6" class="px-6 py-4 text-center text-gray-500">Nenhum horário cadastrado.</td></tr>`;
            return;
        }

        schedules.forEach(item => {
            const rowHtml = `
            <tr id="schedule-row-${item.id}" class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">${item.start_time} - ${item.end_time}</td>
                <td class="px-6 py-4">${item.course_name}</td>
                <td class="px-6 py-4">${item.day_of_week}</td>
                <td class="px-6 py-4">${item.professor_name || 'N/D'}</td>
                <td class="px-6 py-4">${item.room_name}</td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button class="p-2 text-gray-500 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300">
                            <span class="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button data-id="${item.id}" class="btn-delete p-2 text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10">
                            <span class="material-symbols-outlined text-xl">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
            `;
            container.innerHTML += rowHtml;
        });

        // Adiciona listeners para os novos botões de delete
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-id');
                deleteSchedule(id);
            });
        });

    } catch (error) {
        console.error('Erro - loadSchedules:', error);
    }
}

/**
 * Deleta um horário específico
 */
async function deleteSchedule(id) {
    if (!confirm(`Tem certeza que deseja deletar o horário ${id}?`)) return;

    try {
        const response = await fetch(`${API_URL}/schedules/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Falha ao deletar');

        // Remove a linha da tabela
        const row = document.getElementById(`schedule-row-${id}`);
        if (row) {
            row.remove();
        }
        
    } catch (error) {
        console.error('Erro - deleteSchedule:', error);
        alert('Não foi possível deletar o horário.');
    }
}