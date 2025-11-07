// dashboard.js (Professor)

// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';

// Variáveis globais para estado
let CURRENT_USER_ID = null;
let CURRENT_ROOM_ID = 1;      // Ex: Sala 101 (Fixo por enquanto)
let CURRENT_COURSE_ID = 1;    // Ex: Curso de IA (Fixo por enquanto)
let CURRENT_SCHEDULE_ID = 1;  // Ex: Horário da segunda-feira às 19h (Fixo por enquanto)

// --- SELETORES DO DOM ---
let lightSlider, lightSliderValue, acToggle, tempValue, tempPlusBtn, tempMinusBtn,
    agendaContainer, studentListContainer, confirmAttendanceBtn;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. VERIFICAÇÃO DE LOGIN
    const userJson = localStorage.getItem('user');
    if (!userJson) {
        alert('Você precisa fazer login primeiro!');
        window.location.href = '../index.html';
        return;
    }
    const user = JSON.parse(userJson);
    if (user.role !== 'Professor') {
        alert('Acesso negado: Área exclusiva para professores.');
        window.location.href = '../index.html';
        return;
    }

    // 2. DEFINE O ID DO USUÁRIO ATUAL
    CURRENT_USER_ID = user.id;
    console.log('Dashboard iniciada para Professor ID:', CURRENT_USER_ID);

    // --- ATUALIZAÇÃO DA INTERFACE COM O NOME DO PROFESSOR ---
    // Procura os elementos pelo ID e atualiza o texto
    const userNameSidebar = document.getElementById('user-name');
    const userWelcomeHeader = document.getElementById('user-welcome');
    // Se você quiser também atualizar a foto, precisaria ter a URL dela no 'user'
    // const userAvatar = document.querySelector('[data-alt="Foto de perfil do professor"]');

    if (userNameSidebar) userNameSidebar.textContent = user.name;
    if (userWelcomeHeader) userWelcomeHeader.textContent = `Bem-vindo(a), ${user.name}`;
    // -------------------------------------------------------

    // 3. SELETORES DO DOM
    lightSlider = document.getElementById('light-slider');
    lightSliderValue = document.getElementById('light-slider-value');
    acToggle = document.getElementById('ac-toggle');
    tempValue = document.getElementById('temp-value');
    tempPlusBtn = document.getElementById('temp-plus-btn');
    tempMinusBtn = document.getElementById('temp-minus-btn');
    agendaContainer = document.getElementById('agenda-container');
    studentListContainer = document.getElementById('student-list-container');
    confirmAttendanceBtn = document.getElementById('confirm-attendance-btn');

    // 4. CARREGAR DADOS
    loadPageData();

    // 5. EVENT LISTENERS (Controles da Sala)
    if (lightSlider) {
        lightSlider.addEventListener('input', (e) => {
            if (lightSliderValue) lightSliderValue.textContent = `${e.target.value}%`;
        });
        lightSlider.addEventListener('change', sendRoomUpdate);
    }

    document.querySelectorAll('input[name="lighting-scene"]').forEach(radio => {
        radio.addEventListener('change', sendRoomUpdate);
    });

    if (acToggle) acToggle.addEventListener('change', sendRoomUpdate);

    if (tempPlusBtn && tempValue) {
        tempPlusBtn.addEventListener('click', () => {
            let currentTemp = parseInt(tempValue.textContent);
            tempValue.textContent = `${++currentTemp}°C`;
            sendRoomUpdate();
        });
    }

    if (tempMinusBtn && tempValue) {
        tempMinusBtn.addEventListener('click', () => {
            let currentTemp = parseInt(tempValue.textContent);
            tempValue.textContent = `${--currentTemp}°C`;
            sendRoomUpdate();
        });
    }

    if (confirmAttendanceBtn) {
        confirmAttendanceBtn.addEventListener('click', confirmAttendance);
    }
});

// --- FUNÇÕES DE CARREGAMENTO (GET) ---

async function loadPageData() {
    if (!CURRENT_USER_ID) return;
    loadInitialRoomState(CURRENT_ROOM_ID);
    loadSchedule(CURRENT_USER_ID);
    loadStudentList(CURRENT_COURSE_ID);
}

async function loadInitialRoomState(roomId) {
    try {
        const response = await fetch(`${API_URL}/rooms/${roomId}`);
        if (!response.ok) throw new Error('Sala não encontrada');

        const room = await response.json();

        if (lightSlider) lightSlider.value = room.lighting_intensity || 60;
        if (lightSliderValue) lightSliderValue.textContent = `${room.lighting_intensity || 60}%`;
        if (acToggle) acToggle.checked = !!room.ac_on;
        if (tempValue) tempValue.textContent = `${room.ac_temperature || 22}°C`;

    } catch (error) {
        console.error('Erro ao carregar estado da sala:', error);
    }
}

async function loadSchedule(professorId) {
    try {
        const response = await fetch(`${API_URL}/schedules`);
        if (!response.ok) throw new Error('Erro ao buscar agenda');

        const allSchedules = await response.json();
        // Filtra a agenda para mostrar SOMENTE a do professor logado
        const mySchedules = allSchedules.filter(s => s.professor_id === professorId);

        if (!agendaContainer) return;
        agendaContainer.innerHTML = '';

        if (mySchedules.length === 0) {
            agendaContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">Nenhuma aula agendada para hoje.</p>';
            return;
        }

        mySchedules.forEach(item => {
            // Lógica simplificada para destacar a aula "atual" (primeira da lista)
            const isAtual = (item.course_id === CURRENT_COURSE_ID); 

            const scheduleHtml = `
            <div class="flex items-center gap-4 p-4 rounded-lg ${isAtual ? 'bg-primary/10 ring-2 ring-primary dark:bg-primary/20' : 'bg-gray-50 dark:bg-gray-700/50'} shadow-sm transition-all">
              <div class="flex flex-col items-center justify-center min-w-[4rem] ${isAtual ? 'text-primary font-bold' : 'text-gray-500 dark:text-gray-400'}">
                <span class="text-sm">${item.start_time.substring(0, 5)}</span>
                <span class="text-xs opacity-75">${item.end_time.substring(0, 5)}</span>
              </div>
              <div class="w-1 ${isAtual ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'} h-10 rounded-full"></div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-gray-800 dark:text-white truncate">${item.course_name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${item.room_name} • ${item.day_of_week}</p>
              </div>
            </div>
            `;
            agendaContainer.innerHTML += scheduleHtml;
        });

    } catch (error) {
        console.error('Erro ao carregar agenda:', error);
        if (agendaContainer) agendaContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar agenda.</p>';
    }
}

async function loadStudentList(courseId) {
    try {
        const response = await fetch(`${API_URL}/enrollments/course/${courseId}`);
        if (!response.ok) throw new Error('Erro ao buscar alunos');

        const students = await response.json();

        if (!studentListContainer) return;
        studentListContainer.innerHTML = '';

        if (students.length === 0) {
            studentListContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">Nenhum aluno matriculado.</p>';
            return;
        }

        students.forEach((student) => {
            // Adiciona um ID único para cada grupo de radio buttons usando o ID do aluno
            const radioGroupName = `student_${student.student_id}`;
            
            const studentHtml = `
            <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" data-student-id="${student.student_id}">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                  ${student.student_name.charAt(0)}
                </div>
                <p class="font-medium text-gray-800 dark:text-white truncate">${student.student_name}</p>
              </div>
              <div class="flex items-center gap-4 flex-shrink-0 ml-4">
                <label class="flex items-center cursor-pointer group">
                  <input class="form-radio w-4 h-4 text-green-600 focus:ring-green-500 transition-all" type="radio" name="${radioGroupName}" value="Presente" checked />
                  <span class="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">P</span>
                </label>
                <label class="flex items-center cursor-pointer group">
                  <input class="form-radio w-4 h-4 text-red-600 focus:ring-red-500 transition-all" type="radio" name="${radioGroupName}" value="Ausente" />
                  <span class="ml-2 text-sm font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">A</span>
                </label>
              </div>
            </div>
            `;
            studentListContainer.innerHTML += studentHtml;
        });

    } catch (error) {
        console.error('Erro ao carregar lista de alunos:', error);
        if (studentListContainer) studentListContainer.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar lista.</p>';
    }
}

// --- FUNÇÕES DE ATUALIZAÇÃO (PUT/POST) ---

async function sendRoomUpdate() {
    if (!CURRENT_ROOM_ID) return;
    
    try {
        const intensity = lightSlider ? lightSlider.value : 0;
        const temp = tempValue ? parseInt(tempValue.textContent) : 22;
        const acOn = acToggle ? acToggle.checked : false;

        const roomData = {
            lighting_intensity: intensity,
            ac_temperature: temp,
            ac_on: acOn,
            status: 'Em Aula',
            current_course_id: CURRENT_COURSE_ID
        };

        const response = await fetch(`${API_URL}/rooms/status/${CURRENT_ROOM_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData),
        });

        if (!response.ok) throw new Error('Falha ao atualizar sala');
        // console.log('Sala atualizada'); // Opcional

    } catch (error) {
        console.error('Erro em sendRoomUpdate:', error);
    }
}

async function confirmAttendance() {
    if (!CURRENT_SCHEDULE_ID || !studentListContainer) return;

    try {
        const attendance_list = [];
        const studentRows = studentListContainer.querySelectorAll('div[data-student-id]');

        studentRows.forEach(row => {
            const student_id = row.getAttribute('data-student-id');
            // Busca o radio button selecionado DENTRO da linha do aluno específico
            const selectedRadio = row.querySelector(`input[name="student_${student_id}"]:checked`);
            
            if (selectedRadio) {
                 attendance_list.push({
                    student_id: parseInt(student_id),
                    status: selectedRadio.value
                });
            }
        });

        if (attendance_list.length === 0) {
            alert('Nenhum aluno encontrado para confirmar presença.');
            return;
        }

        const payload = {
            schedule_id: CURRENT_SCHEDULE_ID,
            attendance_list: attendance_list
        };

        const response = await fetch(`${API_URL}/attendance/manual-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error('Falha ao confirmar presença');

        const result = await response.json();
        alert('Presença confirmada com sucesso!');

    } catch (error) {
        console.error('Erro em confirmAttendance:', error);
        alert('Erro ao confirmar presença. Verifique o console.');
    }
}