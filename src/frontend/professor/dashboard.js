// dashboard.js (Professor) - VERSÃO DINÂMICA E EM TEMPO REAL

// --- CONFIGURAÇÃO ---
const API_URL = 'http://localhost:4000/api';
const REFRESH_INTERVAL = 5000; // Atualiza a cada 5 segundos

// --- Variáveis de Estado Global ---
let CURRENT_USER_ID = null;
let CURRENT_ROOM_ID = 1; // Fixo para a nossa maquete, que representa a Sala 1
let currentSchedule = {
    id: null,
    courseId: null,
    students: [] // Cache da lista de alunos da turma atual
};
let intervalId = null; // ID do nosso intervalo de atualização
const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];


// --- SELETORES DO DOM ---
// (Definidos dentro do DOMContentLoaded para garantir que existam)
let userNameSidebar, userWelcomeHeader, lightSlider, lightSliderValue, acToggle,
    tempValue, tempPlusBtn, tempMinusBtn, agendaContainer, studentListContainer,
    confirmAttendanceBtn, currentClassTitle, currentClassInfo;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Validação de Login
    const user = validateLogin();
    if (!user) return;
    CURRENT_USER_ID = user.id;

    // 2. Mapeamento de Elementos do DOM
    mapDOMElements();

    // 3. Atualiza a UI com informações do usuário
    updateUserInfo(user);

    // 4. Carrega os dados da página pela primeira vez
    loadFullDashboardState();

    // 5. Inicia a atualização em tempo real
    startRealtimeUpdates();

    // 6. Configura os listeners de eventos para os controles da sala
    setupEventListeners();
});

// --- FUNÇÕES DE SETUP ---

function validateLogin() {
    const userJson = localStorage.getItem('user');
    if (!userJson) {
        alert('Você precisa fazer login primeiro!');
        window.location.href = '../index.html';
        return null;
    }
    const user = JSON.parse(userJson);
    if (user.role !== 'Professor') {
        alert('Acesso negado: Área exclusiva para professores.');
        window.location.href = '../index.html';
        return null;
    }
    return user;
}

function mapDOMElements() {
    userNameSidebar = document.getElementById('user-name');
    userWelcomeHeader = document.getElementById('user-welcome');
    lightSlider = document.getElementById('light-slider');
    lightSliderValue = document.getElementById('light-slider-value');
    acToggle = document.getElementById('ac-toggle');
    tempValue = document.getElementById('temp-value');
    tempPlusBtn = document.getElementById('temp-plus-btn');
    tempMinusBtn = document.getElementById('temp-minus-btn');
    agendaContainer = document.getElementById('agenda-container');
    studentListContainer = document.getElementById('student-list-container');
    confirmAttendanceBtn = document.getElementById('confirm-attendance-btn');
    currentClassTitle = document.getElementById('current-class-title');
    currentClassInfo = document.getElementById('current-class-info');
}

function updateUserInfo(user) {
    if (userNameSidebar) userNameSidebar.textContent = user.name;
    if (userWelcomeHeader) userWelcomeHeader.textContent = `Bem-vindo(a), ${user.name}`;
}

function setupEventListeners() {
    if (lightSlider) {
        lightSlider.addEventListener('input', (e) => {
            if (lightSliderValue) lightSliderValue.textContent = `${e.target.value}%`;
        });
        lightSlider.addEventListener('change', sendRoomUpdate);
    }
    if (acToggle) acToggle.addEventListener('change', sendRoomUpdate);
    if (tempPlusBtn) tempPlusBtn.addEventListener('click', () => {
        let currentTemp = parseInt(tempValue.textContent);
        tempValue.textContent = `${++currentTemp}°C`;
        sendRoomUpdate();
    });
    if (tempMinusBtn) tempMinusBtn.addEventListener('click', () => {
        let currentTemp = parseInt(tempValue.textContent);
        tempValue.textContent = `${--currentTemp}°C`;
        sendRoomUpdate();
    });
    if (confirmAttendanceBtn) {
        confirmAttendanceBtn.addEventListener('click', confirmAttendance);
    }
}

// --- LÓGICA DE ATUALIZAÇÃO ---

function startRealtimeUpdates() {
    if (intervalId) clearInterval(intervalId); 
    
    intervalId = setInterval(() => {
        // Primeiro, chama a rota de manutenção para finalizar aulas expiradas
        fetch(`${API_URL}/rooms/update-state`, { method: 'POST' })
            .then(() => {
                // Depois, atualiza a interface com o estado mais recente
                updateLiveClassState(CURRENT_ROOM_ID);
            })
            .catch(error => console.error("Erro na manutenção de estado:", error));

    }, REFRESH_INTERVAL);
}


// Carrega tudo que não precisa de atualização constante
async function loadFullDashboardState() {
    await loadSchedule(CURRENT_USER_ID);
    await updateLiveClassState(CURRENT_ROOM_ID); // Carrega o estado da aula pela primeira vez
}

// Função central que verifica se há aula e atualiza a UI
async function updateLiveClassState(roomId) {
    try {
        const response = await fetch(`${API_URL}/rooms/detailed`);
        const rooms = await response.json();
        const room = rooms.find(r => r.id === roomId);

        if (!room) throw new Error("Sala não encontrada na resposta da API");

        // CENÁRIO 1: AULA EM ANDAMENTO
        if (room.status === 'Em Aula' && room.current_schedule_id) {
            confirmAttendanceBtn.disabled = false;
            currentClassTitle.textContent = `Em Andamento: ${room.course_name}`;
            currentClassInfo.textContent = `Professor: ${room.professor_name}`;

            // Se a aula mudou, recarrega a lista de alunos
            if (currentSchedule.id !== room.current_schedule_id) {
                console.log(`Nova aula detectada! Schedule ID: ${room.current_schedule_id}`);
                currentSchedule.id = room.current_schedule_id;
                currentSchedule.courseId = room.current_course_id;
                currentSchedule.students = await getStudentList(room.current_course_id);
            }
            // Sempre atualiza a presença
            const presentStudents = await getAttendanceList(currentSchedule.id);
            renderStudentList(currentSchedule.students, presentStudents);

        }
        // CENÁRIO 2: NENHUMA AULA EM ANDAMENTO
        else {
            confirmAttendanceBtn.disabled = true;
            currentClassTitle.textContent = "Nenhuma aula em andamento";
            currentClassInfo.textContent = "Aproxime seu cartão RFID no leitor para iniciar a aula.";
            studentListContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Aguardando início da aula...</p>';
            currentSchedule.id = null;
            currentSchedule.courseId = null;
            currentSchedule.students = [];
        }

    } catch (error) {
        console.error('Erro ao atualizar estado da aula:', error);
    }
}


// --- FUNÇÕES DE BUSCA DE DADOS (GET) ---

async function loadSchedule(professorId) {
    try {
        const response = await fetch(`${API_URL}/schedules`);
        const allSchedules = await response.json();
        const mySchedules = allSchedules.filter(s => s.professor_id === professorId);
        // ALTERAÇÃO AQUI:
        renderProfessorAgenda(mySchedules); // Chamando a nova função
    } catch (error) {
        console.error('Erro ao carregar agenda:', error);
        // Opcional: Limpar ambos containers em caso de erro
        document.getElementById('agenda-hoje-container').innerHTML = '<p class="text-red-500">Erro.</p>';
        document.getElementById('agenda-semana-container').innerHTML = '<p class="text-red-500">Erro.</p>';
    }
}

async function getStudentList(courseId) {
    try {
        const response = await fetch(`${API_URL}/enrollments/course/${courseId}`);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Erro ao buscar lista de alunos:', error);
        return [];
    }
}

async function getAttendanceList(scheduleId) {
    try {
        const response = await fetch(`${API_URL}/attendance/schedule/${scheduleId}`);
        if (!response.ok) return [];
        const records = await response.json();
        // Retorna um array de nomes de alunos presentes
        return records.filter(r => r.status === 'Presente').map(r => r.student_name);
    } catch (error) {
        console.error('Erro ao buscar lista de presença:', error);
        return [];
    }
}

// --- FUNÇÕES DE RENDERIZAÇÃO NA TELA ---

function renderProfessorAgenda(schedules) {
    const hojeContainer = document.getElementById('agenda-hoje-container');
    const semanaContainer = document.getElementById('agenda-semana-container');
    if (!hojeContainer || !semanaContainer) return;

    hojeContainer.innerHTML = '';
    semanaContainer.innerHTML = '';

    const hojeNumero = new Date().getDay();

    const aulasDeHoje = schedules.filter(s => s.day_of_week == hojeNumero);
    const aulasDaSemana = schedules.filter(s => s.day_of_week != hojeNumero);

    // NOVO: Ordena a lista de aulas de hoje pelo horário de início.
    aulasDeHoje.sort((a, b) => a.start_time.localeCompare(b.start_time));

    // NOVO: Ordena a lista de aulas da semana, primeiro por dia, depois por hora.
    aulasDaSemana.sort((a, b) => {
        // Primeiro, ordena pelo dia da semana
        const dayDifference = a.day_of_week - b.day_of_week;
        if (dayDifference !== 0) {
            return dayDifference;
        }
        // Se os dias forem os mesmos, ordena pelo horário de início
        return a.start_time.localeCompare(b.start_time);
    });


    // Renderiza aulas de hoje (agora ordenadas)
    if (aulasDeHoje.length === 0) {
        hojeContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma aula agendada para hoje.</p>';
    } else {
        aulasDeHoje.forEach(item => {
            hojeContainer.innerHTML += `
            <div class="flex items-center gap-4 p-4 rounded-lg bg-primary/10 ring-1 ring-primary/50 dark:bg-primary/20">
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-gray-800 dark:text-white truncate">${item.course_name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${item.start_time.substring(0, 5)} - ${item.end_time.substring(0, 5)} • ${item.room_name}</p>
              </div>
            </div>`;
        });
    }

    // Renderiza aulas da semana (agora ordenadas)
    if (aulasDaSemana.length === 0) {
        semanaContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhuma outra aula na semana.</p>';
    } else {
        aulasDaSemana.forEach(item => {
            semanaContainer.innerHTML += `
            <div class="flex items-center gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-gray-800 dark:text-white truncate">${item.course_name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${diasSemana[item.day_of_week]} • ${item.start_time.substring(0, 5)}</p>
              </div>
            </div>`;
        });
    }
}

function renderStudentList(students, presentStudents) {
    if (!studentListContainer) return;
    studentListContainer.innerHTML = '';
    if (students.length === 0) {
        studentListContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">Nenhum aluno matriculado neste curso.</p>';
        return;
    }
    students.forEach(student => {
        const isPresent = presentStudents.includes(student.student_name);
        const radioGroupName = `student_${student.student_id}`;
        studentListContainer.innerHTML += `
        <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50" data-student-id="${student.student_id}">
          <p class="font-medium text-gray-800 dark:text-white truncate">${student.student_name}</p>
          <div class="flex items-center gap-4">
            <label class="flex items-center cursor-pointer">
              <input class="form-radio" type="radio" name="${radioGroupName}" value="Presente" ${isPresent ? 'checked' : ''} />
              <span class="ml-2 text-sm">P</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input class="form-radio" type="radio" name="${radioGroupName}" value="Ausente" ${!isPresent ? 'checked' : ''} />
              <span class="ml-2 text-sm">A</span>
            </label>
          </div>
        </div>`;
    });
}


// --- FUNÇÕES DE ATUALIZAÇÃO (PUT/POST) ---

async function sendRoomUpdate() {
    // Esta função permanece a mesma, pois já envia os dados corretamente
    const roomData = {
        lighting_intensity: lightSlider.value,
        ac_temperature: parseInt(tempValue.textContent),
        ac_on: acToggle.checked,
    };
    try {
        await fetch(`${API_URL}/rooms/status/${CURRENT_ROOM_ID}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData),
        });
    } catch (error) {
        console.error('Erro em sendRoomUpdate:', error);
    }
}

async function confirmAttendance() {
    // Esta função permanece a mesma, pois já lê os valores da tela corretamente
    if (!currentSchedule.id) {
        alert("Nenhuma aula ativa para confirmar a presença.");
        return;
    }
    const attendance_list = [];
    document.querySelectorAll('div[data-student-id]').forEach(row => {
        const student_id = row.dataset.studentId;
        const selectedRadio = row.querySelector(`input[name="student_${student_id}"]:checked`);
        if (selectedRadio) {
            attendance_list.push({ student_id: parseInt(student_id), status: selectedRadio.value });
        }
    });
    try {
        await fetch(`${API_URL}/attendance/manual-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedule_id: currentSchedule.id, attendance_list }),
        });
        alert('Presença confirmada com sucesso!');
    } catch (error) {
        console.error('Erro em confirmAttendance:', error);
        alert('Erro ao confirmar presença.');
    }
}

function getDiaSemanaTextoJS() {
    const dias = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return dias[new Date().getDay()];
}