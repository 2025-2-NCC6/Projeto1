// dashboard.js

// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';

// IDs que deveriam ser dinâmicos (ex: vindos da página de login ou URL)
// Por enquanto, vamos "chumbar" os valores para teste
let CURRENT_USER_ID = 1; // ID do Professor (Ex: Dr. Ana Santos)
let CURRENT_ROOM_ID = 1; // ID da Sala (Ex: Sala 205)
let CURRENT_COURSE_ID = 1; // ID do Curso (Ex: Inteligência Artificial)
let CURRENT_SCHEDULE_ID = 1; // ID do Horário (Ex: IA das 19:00)

// --- SELETORES DO DOM ---
// Guardamos os elementos em variáveis para não ter que buscá-los toda hora
let lightSlider, lightSliderValue, acToggle, tempValue, tempPlusBtn, tempMinusBtn,
    agendaContainer, studentListContainer, confirmAttendanceBtn;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Selecionar todos os elementos da página
    lightSlider = document.getElementById('light-slider');
    lightSliderValue = document.getElementById('light-slider-value');
    acToggle = document.getElementById('ac-toggle');
    tempValue = document.getElementById('temp-value');
    tempPlusBtn = document.getElementById('temp-plus-btn');
    tempMinusBtn = document.getElementById('temp-minus-btn');
    agendaContainer = document.getElementById('agenda-container');
    studentListContainer = document.getElementById('student-list-container');
    confirmAttendanceBtn = document.getElementById('confirm-attendance-btn');

    // 2. Carregar os dados iniciais da API
    loadPageData();

    // 3. Adicionar "escutadores" de eventos para o Controle da Sala
    // Usamos 'input' para o slider para pegar o valor enquanto arrasta
    lightSlider.addEventListener('input', (e) => {
        lightSliderValue.textContent = `${e.target.value}%`;
    });
    // Usamos 'change' para enviar o valor final quando o usuário soltar o mouse
    lightSlider.addEventListener('change', sendRoomUpdate);

    // Eventos para os botões de rádio da Iluminação
    document.querySelectorAll('input[name="lighting-scene"]').forEach(radio => {
        radio.addEventListener('change', sendRoomUpdate);
    });

    acToggle.addEventListener('change', sendRoomUpdate);

    tempPlusBtn.addEventListener('click', () => {
        let currentTemp = parseInt(tempValue.textContent);
        tempValue.textContent = `${++currentTemp}°C`;
        sendRoomUpdate();
    });

    tempMinusBtn.addEventListener('click', () => {
        let currentTemp = parseInt(tempValue.textContent);
        tempValue.textContent = `${--currentTemp}°C`;
        sendRoomUpdate();
    });

    // 4. Adicionar "escutador" para o botão de Presença
    confirmAttendanceBtn.addEventListener('click', confirmAttendance);
});

// --- FUNÇÕES DE CARREGAMENTO (GET) ---

/**
 * Função principal que carrega todos os dados da página
 */
async function loadPageData() {
    // TODO: Adicionar lógica para buscar qual é a aula atual
    // e definir CURRENT_ROOM_ID, CURRENT_COURSE_ID, etc., dinamicamente.

    // Por enquanto, usamos os IDs "chumbados"
    loadInitialRoomState(CURRENT_ROOM_ID);
    loadSchedule(CURRENT_USER_ID);
    loadStudentList(CURRENT_COURSE_ID);
}

/**
 * Carrega o estado inicial da sala (Luz, AC, Temp)
 */
async function loadInitialRoomState(roomId) {
    try {
        const response = await fetch(`${API_URL}/rooms/${roomId}`);
        if (!response.ok) throw new Error('Sala não encontrada');

        const room = await response.json();

        // Popula o Card "Controle da Sala"
        lightSlider.value = room.lighting_intensity || 60;
        lightSliderValue.textContent = `${room.lighting_intensity || 60}%`;

        acToggle.checked = !!room.ac_on; // Converte 1/0 para true/false
        tempValue.textContent = `${room.ac_temperature || 22}°C`;

        // TODO: Marcar o rádio da iluminação (ex: 'Presentation', 'Reading')
        // Você precisaria salvar esse 'scene' no seu banco de dados.

    } catch (error) {
        console.error('Erro ao carregar estado da sala:', error);
    }
}

/**
 * Carrega a agenda do professor
 */
async function loadSchedule(professorId) {
    try {
        // NOTA: Sua rota /api/schedules busca TUDO. O ideal seria criar
        // uma rota /api/schedules/professor/:id
        const response = await fetch(`${API_URL}/schedules`);
        if (!response.ok) throw new Error('Erro ao buscar agenda');

        const schedules = await response.json();

        // Filtra a agenda (temporário, o back-end deveria fazer isso)
        // Esta é uma suposição de como seus dados se parecem.
        // const professorSchedules = schedules.filter(s => s.professor_id === professorId);

        agendaContainer.innerHTML = ''; // Limpa o "Carregando..."

        schedules.forEach(item => {
            // TODO: Adicionar lógica para destacar a aula "Atual"
            const isAtual = item.course_name === 'Inteligência Artificial'; // Exemplo

            const scheduleHtml = `
            <div class="flex items-center gap-4 p-4 rounded-lg ${isAtual ? 'bg-primary/20 ring-2 ring-primary' : 'bg-background-light dark:bg-background-dark'}">
              <div class="flex flex-col items-center justify-center w-16 ${isAtual ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}">
                <span class="text-sm font-medium ${isAtual ? 'font-bold' : ''}">${item.start_time}</span>
                <span class="text-xs">${item.end_time}</span>
              </div>
              <div class="w-1 ${isAtual ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'} h-10 rounded-full"></div>
              <div>
                <h3 class="font-bold text-gray-800 dark:text-white">${item.course_name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">${item.room_name}</p>
              </div>
              ${isAtual ? '<span class="ml-auto px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">Atual</span>' : ''}
            </div>
            `;
            agendaContainer.innerHTML += scheduleHtml;
        });

    } catch (error) {
        console.error('Erro ao carregar agenda:', error);
    }
}

/**
 * Carrega a lista de alunos matriculados no curso atual
 */
async function loadStudentList(courseId) {
    try {
        const response = await fetch(`${API_URL}/enrollments/course/${courseId}`);
        if (!response.ok) throw new Error('Erro ao buscar alunos');

        const students = await response.json();

        studentListContainer.innerHTML = ''; // Limpa o "Carregando..."

        if (students.length === 0) {
            studentListContainer.innerHTML = '<p class="text-gray-500 text-center">Nenhum aluno matriculado neste curso.</p>';
            return;
        }

        students.forEach((student, index) => {
            const studentHtml = `
            <div class="flex items-center justify-between p-3 rounded-lg bg-background-light dark:bg-background-dark" data-student-id="${student.student_id || index}"> <p class="text-gray-800 dark:text-white">${student.student_name}</p>
              <div class="flex items-center gap-2">
                <label class="flex items-center cursor-pointer">
                  <input class="form-radio text-primary focus:ring-primary/50" name="student_${index}" type="radio" value="Presente" checked /> 
                  <span class="ml-2 text-sm text-gray-600 dark:text-gray-300">P</span>
                </label>
                <label class="flex items-center cursor-pointer">
                  <input class="form-radio text-red-500 focus:ring-red-500/50" name="student_${index}" type="radio" value="Ausente" /> 
                  <span class="ml-2 text-sm text-gray-600 dark:text-gray-300">A</span>
                </label>
              </div>
            </div>
            `;
            studentListContainer.innerHTML += studentHtml;
        });

    } catch (error) {
        console.error('Erro ao carregar lista de alunos:', error);
        studentListContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar alunos.</p>';
    }
}


// --- FUNÇÕES DE ATUALIZAÇÃO (PUT/POST) ---

/**
 * Envia o estado ATUAL do "Controle da Sala" para o back-end
 */
async function sendRoomUpdate() {
    try {
        // 1. Coletar todos os dados do card
        const intensity = lightSlider.value;
        const temp = parseInt(tempValue.textContent);
        const acOn = acToggle.checked;
        const lightScene = document.querySelector('input[name="lighting-scene"]:checked').value;

        // 2. Montar o objeto
        const roomData = {
            lighting_intensity: intensity,
            ac_temperature: temp,
            ac_on: acOn,
            status: 'Em Aula', // <--- CORRIGIDO
            current_course_id: CURRENT_COURSE_ID 
        };

        // 3. Enviar a requisição PUT
        const response = await fetch(`${API_URL}/rooms/status/${CURRENT_ROOM_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(roomData),
        });

        if (!response.ok) {
            throw new Error('Falha ao atualizar a sala');
        }

        const result = await response.json();
        console.log('Sala atualizada:', result.message);

    } catch (error) {
        console.error('Erro em sendRoomUpdate:', error);
    }
}

/**
 * Pega a lista de presença da tela e envia para o back-end
 */
async function confirmAttendance() {
    try {
        const attendance_list = [];

        // Encontra todas as linhas de aluno
        const studentRows = studentListContainer.querySelectorAll('div[data-student-id]');

        studentRows.forEach(row => {
            const student_id = row.getAttribute('data-student-id');
            const status = row.querySelector('input[type="radio"]:checked').value; // 'Presente' ou 'Ausente'

            attendance_list.push({
                student_id: parseInt(student_id),
                status: status
            });
        });

        // Monta o payload final
        const payload = {
            schedule_id: CURRENT_SCHEDULE_ID,
            attendance_list: attendance_list
        };

        // Envia para a NOVA rota de bulk
        const response = await fetch(`${API_URL}/attendance/manual-bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Falha ao confirmar presença');
        }

        const result = await response.json();
        console.log('Presença confirmada:', result.message);
        alert('Presença confirmada com sucesso!');

    } catch (error) {
        console.error('Erro em confirmAttendance:', error);
        alert('Erro ao confirmar presença. Veja o console.');
    }
}