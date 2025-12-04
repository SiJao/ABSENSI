const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw24x-uyRwP2PJBvNm_SntMFbgstizxoI_Z6LukL7uM1BOq6A35lBsu1axIwCtygwTH/exec";
const URL_USER_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAIpCKM-FLkgVPuNA9kEQWlUd_JTi-M1_43FC4mdV65-u83LWPMYkrtwtWBpDGB5Tds3ew9Yeq0H_W/pub?output=csv";

let usersData = [], studentsDataRaw = [], currentUser = null, chartInstance = null, calendar = null, suratData = [];
let listKamar = new Set(), listKelas = new Set(), selectedCategoryButton = null;
let dataReady = false, loadPromise = null;

setInterval(() => {
    const now = new Date();
    const clock = document.getElementById('clock');
    const date = document.getElementById('date');
    if (clock) clock.innerText = now.toLocaleTimeString('id-ID');
    if (date) date.innerText = now.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'short'});
    checkMealTime();
}, 1000);

function bindKeyListeners() {
    const ids = ['disiplinId','medisId','makanId','publicSearchId','internalSearchId'];
    ids.forEach(id=>{
        const el = document.getElementById(id);
        if(!el) return;
        el.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (id==='makanId') submitMakan();
                else if (id==='publicSearchId') searchStudentHistory('public');
                else if (id==='internalSearchId') searchStudentHistory('internal');
                else searchForInput(el.value, id.replace('Id',''));
            }
        });
    });
}

window.onload = async () => {
    if(localStorage.getItem('theme')==='dark') toggleDarkMode();
    const sess = localStorage.getItem('siakad_user');
    if(sess) {
        try {
            currentUser = JSON.parse(sess);
            updateUIForUser();
        } catch(e) {
            document.getElementById('loginSection').classList.remove('hidden');
        }
    } else {
        document.getElementById('loginSection').classList.remove('hidden');
    }
    loadPromise = initData();
    bindKeyListeners();
};

async function initData() {
    try {
        const sRes = await fetch(SCRIPT_URL + '?action=getStudents');
        const sJson = await sRes.json();
        if(sJson.result === 'success') {
            studentsDataRaw = sJson.data;
            studentsDataRaw.forEach(r => {
                if(r[3]) listKelas.add(r[3]);
                if(r[4]) listKamar.add(r[4]);
            });
            const statEl = document.getElementById('statTotalSantri');
            if(statEl) statEl.innerText = studentsDataRaw.length;
            dataReady = true;
        }
        const csvRes = await fetch(URL_USER_CSV);
        const csvText = await csvRes.text();
        usersData = parseCSVUser(csvText);
        if(currentUser) loadDashboardStats();
    } catch(e) {
        console.log("Offline mode/Error", e);
    }
}

function parseCSVUser(text) {
    const lines = text.trim().split('\n'), res = [];
    for(let i=1; i<lines.length; i++) {
        const r = lines[i].split(',').map(c => c.trim().replace(/"/g,''));
        if(r.length >= 3) res.push({username:r[0], password:r[1], role:r[2], photo:r[3]||""});
    }
    return res;
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
    const icon = document.getElementById('darkModeIcon');
    const isDark = document.documentElement.classList.contains('dark');
    if (icon) {
        icon.classList.replace(isDark ? 'fa-moon':'fa-sun', isDark ? 'fa-sun' : 'fa-moon');
    }
    localStorage.setItem('theme', isDark?'dark':'light');
}

function toggleSubmenu(id, btn) {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = btn.querySelector('.rotate-icon');
    el.classList.toggle('open');
    if(el.classList.contains('open')) {
        el.style.maxHeight = el.scrollHeight + "px";
        if (icon) icon.classList.add('rotate-180');
    } else {
        el.style.maxHeight = null;
        if (icon) icon.classList.remove('rotate-180');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if(sidebar) sidebar.classList.toggle('-translate-x-full');
    if(overlay) overlay.classList.toggle('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const uInput = document.getElementById('username').value.trim();
    const pInput = document.getElementById('password').value.trim();
    const loader = document.getElementById('loginLoader');
    const err = document.getElementById('loginError');

    loader.classList.remove('hidden');
    err.classList.add('hidden');

    if(!dataReady && usersData.length === 0 && loadPromise) await loadPromise;

    setTimeout(() => {
        const user = usersData.find(
            x => String(x.username).toLowerCase() === uInput.toLowerCase() && String(x.password) === pInput
        );
        if(user) {
            currentUser = user;
            localStorage.setItem('siakad_user', JSON.stringify(currentUser));
            updateUIForUser();
        } else {
            err.innerText = "Username atau Password Salah!";
            err.classList.remove('hidden');
        }
        loader.classList.add('hidden');
    }, 800);
}

function updateUIForUser() {
    document.getElementById('loginSection').classList.add('hidden');
    showPage('home');
    if(document.getElementById('sidebarUsername')) document.getElementById('sidebarUsername').innerText = currentUser.username;
    if(document.getElementById('sidebarRole')) document.getElementById('sidebarRole').innerText = currentUser.role;
    if(document.getElementById('welcomeName')) document.getElementById('welcomeName').innerText = currentUser.username;
    if(currentUser.photo && currentUser.photo.startsWith('http')) {
        const avatar = document.getElementById('sidebarAvatar');
        if (avatar) {
            avatar.innerHTML = '';
            avatar.style.backgroundImage = `url('${currentUser.photo}')`;
        }
    }
    generateMenu(currentUser.role);
    loadDashboardStats();
}

function showPage(p) {
    const pages = ['pageHome', 'pageInput', 'pageRekap', 'pagePortal', 'pageAgenda', 'pageInputSurat', 'pageRiwayatSurat', 'pageDisiplin', 'pageMedis', 'pageMakan'];
    pages.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(btn => {
        btn.classList.remove('bg-green-50', 'text-green-700', 'dark:bg-gray-800');
        btn.classList.add('text-gray-600', 'dark:text-gray-400');
        if(btn.firstElementChild) {
            btn.firstElementChild.classList.remove('text-green-600');
        }
    });

    const activeNavId = 'nav' + p.charAt(0).toUpperCase() + p.slice(1);
    const activeBtn = document.getElementById(activeNavId);
    if(activeBtn) {
        activeBtn.classList.add('bg-green-50', 'text-green-700', 'dark:bg-gray-800');
        activeBtn.classList.remove('text-gray-600', 'dark:text-gray-400');
    }

    const activePageId = 'page' + p.charAt(0).toUpperCase() + p.slice(1);
    const activePage = document.getElementById(activePageId);
    if(activePage) activePage.classList.remove('hidden');

    if(p === 'rekap') loadRecapData(1);
    if(p === 'riwayatSurat') loadSuratHistory();
    if(p === 'agenda') setTimeout(loadCalendar, 200);

    if(currentUser) {
        if(p === 'disiplin' && document.getElementById('disiplinBagian'))
            document.getElementById('disiplinBagian').value = currentUser.role;
        if(p === 'inputSurat' && document.getElementById('suratJabatan'))
            document.getElementById('suratJabatan').value = currentUser.role;
    }

    const titleEl = document.getElementById('pageTitle');
    if(titleEl)
        titleEl.innerText = p.replace(/([A-Z])/g, ' $1').toUpperCase();

    if(window.innerWidth < 768) {
        const sb = document.getElementById('sidebar');
        const ov = document.getElementById('sidebarOverlay');
        if(sb) sb.classList.add('-translate-x-full');
        if(ov) ov.classList.add('hidden');
    }
}

function generateMenu(role) {
    const categoryConfig = {
        keamanan: ['Harian'],
        bahasa: ['Muhadhoroh'],
        peribadatan: ['Halaqoh Qur\'an'],
        olahraga: ['Olahraga'],
        kesenian: ['Kesenian'],
        kordinator: ['Harian', 'Muhadhoroh', 'Halaqoh Qur\'an', 'Olahraga', 'Kesenian', 'Pramuka']
    };

    const categories = categoryConfig[role] || [];
    const grid = document.getElementById('categoryGrid');
    if(!grid) return;

    grid.innerHTML = '';
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'menu-card p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md';
        btn.innerHTML = `<div class="text-2xl mb-2">${getCategoryIcon(cat)}</div><p class="font-bold text-sm">${cat}</p>`;
        btn.onclick = () => selectCategory(cat, btn);
        grid.appendChild(btn);
    });
}

function getCategoryIcon(cat) {
    const icons = {
        'Harian': '📅',
        'Muhadhoroh': '🎤',
        'Halaqoh Qur\'an': '📖',
        'Olahraga': '⚽',
        'Kesenian': '🎨',
        'Pramuka': '⛺'
    };
    return icons[cat] || '📋';
}

function selectCategory(cat, btn) {
    if(selectedCategoryButton) {
        selectedCategoryButton.classList.remove('active');
    }
    btn.classList.add('active');
    selectedCategoryButton = btn;

    document.getElementById('absensiType').value = cat;
    document.getElementById('selectPrompt').classList.add('hidden');
    document.getElementById('formContainer').classList.remove('hidden');

    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = '<option value="">-- Pilih --</option>';

    if(cat === 'Harian') {
        document.getElementById('groupLabel').innerText = 'Kamar';
        listKamar.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            groupSelect.appendChild(opt);
        });
    } else {
        document.getElementById('groupLabel').innerText = 'Kelas';
        listKelas.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            groupSelect.appendChild(opt);
        });
    }
}

function loadGroupStudents() {
    const type = document.getElementById('absensiType').value;
    const group = document.getElementById('groupSelect').value;
    if(!group) return;

    const isKamar = type === 'Harian';
    const filtered = studentsDataRaw.filter(r => {
        return isKamar ? r[4] === group : r[3] === group;
    });

    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';

    filtered.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-3 text-center">${i+1}</td>
            <td class="py-3">${s[1]}</td>
            <td class="py-3">
                <div class="flex justify-center gap-2">
                    <label class="status-card cursor-pointer">
                        <input type="radio" name="status-${s[0]}" value="H" class="hidden" checked>
                        <div class="px-4 py-2 rounded-lg border-2 border-green-300 text-green-600 font-bold text-sm">H</div>
                    </label>
                    <label class="status-card cursor-pointer">
                        <input type="radio" name="status-${s[0]}" value="S" class="hidden">
                        <div class="px-4 py-2 rounded-lg border-2 border-yellow-300 text-yellow-600 font-bold text-sm">S</div>
                    </label>
                    <label class="status-card cursor-pointer">
                        <input type="radio" name="status-${s[0]}" value="I" class="hidden">
                        <div class="px-4 py-2 rounded-lg border-2 border-blue-300 text-blue-600 font-bold text-sm">I</div>
                    </label>
                    <label class="status-card cursor-pointer">
                        <input type="radio" name="status-${s[0]}" value="A" class="hidden">
                        <div class="px-4 py-2 rounded-lg border-2 border-red-300 text-red-600 font-bold text-sm">A</div>
                    </label>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('studentListContainer').classList.remove('hidden');
}

async function submitBulkAttendance() {
    const type = document.getElementById('absensiType').value;
    const agenda = document.getElementById('agendaInput').value;
    const group = document.getElementById('groupSelect').value;

    if(!type || !group) {
        showModal('error', 'Error', 'Pilih kategori dan grup terlebih dahulu');
        return;
    }

    const tbody = document.getElementById('studentTableBody');
    const rows = tbody.querySelectorAll('tr');
    const records = [];

    rows.forEach(row => {
        const name = row.cells[1].innerText;
        const checked = row.querySelector('input[type="radio"]:checked');
        if(checked) {
            records.push({
                name: name,
                status: checked.value,
                type: type,
                agenda: agenda,
                reporter: currentUser.username
            });
        }
    });

    const btn = document.getElementById('btnKirim');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader"></div>';

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'bulkAttendance',
                records: records
            })
        });
        showModal('success', 'Berhasil', 'Data kehadiran tersimpan');
        document.getElementById('agendaInput').value = '';
        tbody.innerHTML = '';
        document.getElementById('studentListContainer').classList.add('hidden');
    } catch(e) {
        showModal('error', 'Error', 'Gagal menyimpan data');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Kirim';
    }
}

function searchForInput(id, type) {
    const student = studentsDataRaw.find(s => s[0] === id);
    if(!student) {
        showModal('error', 'Tidak Ditemukan', 'ID Santri tidak valid');
        return;
    }

    if(type === 'disiplin') {
        document.getElementById('disiplinNama').innerText = student[1];
        document.getElementById('disiplinInfo').innerText = `${student[3]} - ${student[4]}`;
    } else if(type === 'medis') {
        document.getElementById('medisNama').innerText = student[1];
        document.getElementById('medisInfo').innerText = `${student[3]} - ${student[4]}`;
    }
}

async function submitDisiplin() {
    const id = document.getElementById('disiplinId').value;
    const jenis = document.getElementById('disiplinJenis').value;
    const hukuman = document.getElementById('disiplinHukuman').value;

    if(!id || !jenis) {
        showModal('error', 'Error', 'Lengkapi data');
        return;
    }

    const btn = document.getElementById('btnDisiplin');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'submitDisiplin',
                studentId: id,
                jenis: jenis,
                hukuman: hukuman,
                reporter: currentUser.username
            })
        });
        showModal('success', 'Tersimpan', 'Data pelanggaran berhasil disimpan');
        document.getElementById('disiplinId').value = '';
        document.getElementById('disiplinJenis').value = '';
        document.getElementById('disiplinHukuman').value = '';
        document.getElementById('disiplinNama').innerText = '-';
        document.getElementById('disiplinInfo').innerText = '-';
    } catch(e) {
        showModal('error', 'Error', 'Gagal menyimpan');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Simpan Pelanggaran';
    }
}

async function submitMedis() {
    const id = document.getElementById('medisId').value;
    const ket = document.getElementById('medisKet').value;

    if(!id || !ket) {
        showModal('error', 'Error', 'Lengkapi data');
        return;
    }

    const btn = document.getElementById('btnMedis');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'submitMedis',
                studentId: id,
                keterangan: ket,
                reporter: currentUser.username
            })
        });
        showModal('success', 'Tersimpan', 'Data medis berhasil disimpan');
        document.getElementById('medisId').value = '';
        document.getElementById('medisKet').value = '';
        document.getElementById('medisNama').innerText = '-';
        document.getElementById('medisInfo').innerText = '-';
    } catch(e) {
        showModal('error', 'Error', 'Gagal menyimpan');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Simpan Data Medis';
    }
}

function checkMealTime() {
    const now = new Date();
    const hour = now.getHours();
    let sesi = '';

    if(hour >= 6 && hour < 10) sesi = 'Sarapan';
    else if(hour >= 11 && hour < 14) sesi = 'Makan Siang';
    else if(hour >= 17 && hour < 20) sesi = 'Makan Malam';

    const sesiInfo = document.getElementById('makanSesiInfo');
    if(sesiInfo) sesiInfo.innerText = sesi ? `Sesi: ${sesi}` : 'Diluar Jam Makan';
}

async function submitMakan() {
    const id = document.getElementById('makanId').value.trim();
    if(!id) return;

    const student = studentsDataRaw.find(s => s[0] === id);
    if(!student) {
        showModal('error', 'Error', 'ID tidak valid');
        document.getElementById('makanId').value = '';
        return;
    }

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'submitMakan',
                studentId: id,
                studentName: student[1],
                reporter: currentUser.username
            })
        });

        const result = document.getElementById('makanResult');
        document.getElementById('makanNama').innerText = student[1];
        result.classList.remove('hidden');

        setTimeout(() => {
            result.classList.add('hidden');
        }, 2000);

        document.getElementById('makanId').value = '';
    } catch(e) {
        showModal('error', 'Error', 'Gagal menyimpan');
    }
}

async function submitSurat() {
    const kategori = document.querySelector('input[name="suratKategori"]:checked').value;
    const kode = document.getElementById('suratKode').value;
    const jenis = document.getElementById('suratJenis').value;
    const tujuan = document.getElementById('suratTujuan').value;
    const status = document.getElementById('suratStatus').value;
    const link = document.getElementById('suratLink').value;

    if(!kode || !jenis) {
        showModal('error', 'Error', 'Lengkapi data');
        return;
    }

    const btn = document.getElementById('btnKirimSurat');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader mx-auto"></div>';

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'submitSurat',
                kategori: kategori,
                kode: kode,
                jenis: jenis,
                tujuan: tujuan,
                status: status,
                link: link,
                reporter: currentUser.username
            })
        });
        showModal('success', 'Tersimpan', 'Surat berhasil diarsipkan');
        document.getElementById('suratKode').value = '';
        document.getElementById('suratJenis').value = '';
        document.getElementById('suratTujuan').value = '';
        document.getElementById('suratLink').value = '';
    } catch(e) {
        showModal('error', 'Error', 'Gagal menyimpan');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Simpan';
    }
}

async function loadSuratHistory() {
    try {
        const res = await fetch(SCRIPT_URL + '?action=getSurat');
        const json = await res.json();
        if(json.result === 'success') {
            suratData = json.data;
            renderSuratTable('all');
            renderSuratChart();
        }
    } catch(e) {
        console.log('Error loading surat', e);
    }
}

function renderSuratTable(filter) {
    const tbody = document.getElementById('suratTableBody');
    tbody.innerHTML = '';

    const filtered = filter === 'all' ? suratData : suratData.filter(s => s[1] === filter);
    const statEl = document.getElementById('statSurat');
    if(statEl) statEl.innerText = suratData.length;

    filtered.forEach(s => {
        const tr = document.createElement('tr');
        const color = s[1] === 'Masuk' ? 'green' : 'blue';
        tr.innerHTML = `
            <td class="p-3 text-xs">${s[0]}</td>
            <td class="p-3"><span class="px-2 py-1 bg-${color}-100 text-${color}-700 text-xs rounded">${s[1]}</span></td>
            <td class="p-3 font-mono text-xs">${s[2]}</td>
            <td class="p-3 text-xs">${s[3]}</td>
            <td class="p-3"><a href="${s[6]}" target="_blank" class="text-blue-600 text-xs"><i class="fas fa-external-link-alt"></i></a></td>
        `;
        tbody.appendChild(tr);
    });
}

function filterSurat(type) {
    renderSuratTable(type);
}

function renderSuratChart() {
    const ctx = document.getElementById('suratChart');
    if(!ctx) return;

    const masuk = suratData.filter(s => s[1] === 'Masuk').length;
    const keluar = suratData.filter(s => s[1] === 'Keluar').length;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Masuk', 'Keluar'],
            datasets: [{
                data: [masuk, keluar],
                backgroundColor: ['#10b981', '#3b82f6']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

async function searchStudentHistory(mode) {
    const inputId = mode === 'public' ? 'publicSearchId' : 'internalSearchId';
    const id = document.getElementById(inputId).value.trim();

    if(!id) {
        showModal('error', 'Error', 'Masukkan ID Santri');
        return;
    }

    const student = studentsDataRaw.find(s => s[0] === id);
    if(!student) {
        showModal('error', 'Tidak Ditemukan', 'ID tidak valid');
        return;
    }

    try {
        const res = await fetch(SCRIPT_URL + `?action=getHistory&studentId=${id}`);
        const json = await res.json();

        if(json.result === 'success') {
            const prefix = mode === 'public' ? 'public' : 'internal';
            document.getElementById(`${prefix}Name`).innerText = student[1];
            document.getElementById(`${prefix}Class`).innerText = student[3] || '-';
            document.getElementById(`${prefix}Room`).innerText = student[4] || '-';

            const tbody = document.getElementById(`${prefix}HistoryBody`);
            tbody.innerHTML = '';

            json.data.forEach(h => {
                const tr = document.createElement('tr');
                const statusColor = h[2] === 'H' ? 'green' : h[2] === 'S' ? 'yellow' : h[2] === 'I' ? 'blue' : 'red';
                tr.innerHTML = `
                    <td class="p-3 text-xs">${h[0]}</td>
                    <td class="p-3 text-xs">${h[1]}</td>
                    <td class="p-3"><span class="px-2 py-1 bg-${statusColor}-100 text-${statusColor}-700 text-xs rounded font-bold">${h[2]}</span></td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById(`${prefix}Result`).classList.remove('hidden');
        }
    } catch(e) {
        showModal('error', 'Error', 'Gagal memuat riwayat');
    }
}

function openPublicPortal() {
    document.getElementById('publicPortal').classList.remove('hidden');
}

function closePublicPortal() {
    document.getElementById('publicPortal').classList.add('hidden');
}

async function loadRecapData(page) {
    const source = document.getElementById('rekapSourceSelect').value;
    const tbody = document.getElementById('rekapTableBody');
    const loader = document.getElementById('rekapLoader');

    loader.classList.remove('hidden');
    tbody.innerHTML = '';

    try {
        const res = await fetch(SCRIPT_URL + `?action=getRecap&source=${source}&page=${page}`);
        const json = await res.json();

        if(json.result === 'success') {
            json.data.forEach((r, i) => {
                const tr = document.createElement('tr');
                const statusColor = r[4] === 'H' ? 'green' : r[4] === 'S' ? 'yellow' : r[4] === 'I' ? 'blue' : 'red';
                tr.innerHTML = `
                    <td class="px-6 py-4">${i+1}</td>
                    <td class="px-6 py-4 text-xs">${r[0]}</td>
                    <td class="px-6 py-4">${r[1]}</td>
                    <td class="px-6 py-4 text-xs">${r[2]}</td>
                    <td class="px-6 py-4 text-center"><span class="px-3 py-1 bg-${statusColor}-100 text-${statusColor}-700 text-xs rounded-full font-bold">${r[4]}</span></td>
                    <td class="px-6 py-4 text-xs">${r[5]}</td>
                `;
                tbody.appendChild(tr);
            });

            updateRecapChart(json.stats);
        }
    } catch(e) {
        console.log('Error loading recap', e);
    } finally {
        loader.classList.add('hidden');
    }
}

function updateRecapChart(stats) {
    const ctx = document.getElementById('attendanceChart');
    if(!ctx) return;

    if(chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Hadir', 'Sakit', 'Izin', 'Alpha'],
            datasets: [{
                label: 'Jumlah',
                data: [stats.H || 0, stats.S || 0, stats.I || 0, stats.A || 0],
                backgroundColor: ['#10b981', '#eab308', '#3b82f6', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function loadCalendar() {
    const calendarEl = document.getElementById('calendar');
    if(!calendarEl) return;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        }
    });
    calendar.render();
}

function loadDashboardStats() {
    const statEl = document.getElementById('statTotalSantri');
    if(statEl && studentsDataRaw.length > 0) {
        statEl.innerText = studentsDataRaw.length;
    }
}

function openDrive() {
    window.open('https://drive.google.com', '_blank');
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showModal(type, title, message) {
    const modal = document.getElementById('statusModal');
    const icon = document.getElementById('modalIcon');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');

    if(type === 'success') {
        icon.className = 'mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 bg-green-100';
        icon.innerHTML = '<i class="fas fa-check text-green-600 text-2xl"></i>';
    } else {
        icon.className = 'mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 bg-red-100';
        icon.innerHTML = '<i class="fas fa-times text-red-600 text-2xl"></i>';
    }

    titleEl.innerText = title;
    msgEl.innerText = message;
    modal.classList.remove('hidden');
}

function openProfileModal() {
    if(!currentUser) return;
    document.getElementById('modalUsername').innerText = currentUser.username;
    document.getElementById('modalRole').innerText = currentUser.role;
    if(currentUser.photo && currentUser.photo.startsWith('http')) {
        document.getElementById('modalAvatar').style.backgroundImage = `url('${currentUser.photo}')`;
    }
    openModal('profileModal');
}

function confirmLogout() {
    closeModal('profileModal');
    openModal('logoutConfirmModal');
}

function performLogout() {
    localStorage.removeItem('siakad_user');
    currentUser = null;
    closeModal('logoutConfirmModal');
    document.getElementById('loginSection').classList.remove('hidden');
    showPage('home');
}

async function doSignup() {
    const u = document.getElementById('newUsername').value;
    const p = document.getElementById('newPassword').value;
    const r = document.getElementById('newRole').value;
    const btn = document.getElementById('btnSignup');

    if(!u || !p) {
        showModal('error', 'Error', 'Lengkapi data');
        return;
    }

    btn.innerText = "Loading...";
    btn.disabled = true;

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'signup',
                username: u,
                password: p,
                role: r
            })
        });
        closeModal('signupModal');
        showModal('success', 'Sukses', 'Akun berhasil dibuat');
        initData();
    } catch(e) {
        showModal('error', 'Gagal', 'Terjadi kesalahan');
    } finally {
        btn.innerText = "Daftar";
        btn.disabled = false;
    }
}
