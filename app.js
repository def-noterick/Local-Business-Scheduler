/* =====================================================================
   BUSINESS SCHEDULE & RECEIPT APP LOGIC
   ===================================================================== */

// --- 1. STATE MANAGEMENT ---
let events = []; 
let currentDate = new Date();
let openedFromSearch = false; 
let editingEventId = null; 

function autoSaveData() {
    localStorage.setItem('myCalendarApp_Data', JSON.stringify(events));
}

// --- 2. DOM ELEMENTS CACHING ---
const calendarGrid = document.getElementById('calendar-grid');
const eventForm = document.getElementById('event-form');
const errorMsg = document.getElementById('error-msg');
const dayModal = document.getElementById('day-modal');
const modalEventsList = document.getElementById('modal-events-list');
const modalDateTitle = document.getElementById('modal-date-title');
const phoneInput = document.getElementById('phone'); 

const todayBtn = document.getElementById('today-btn');
const monthSelect = document.getElementById('month-select');
const yearSelect = document.getElementById('year-select');
const backToSearchBtn = document.getElementById('back-to-search-btn');

const sidebarTitle = document.getElementById('sidebar-title');
const saveBtn = document.getElementById('save-btn');


/* =====================================================================
   UTILITY FUNCTIONS & FORMATTING
   ===================================================================== */

function setupTimeDropdowns() {
    let hourOptions = '';
    for (let i = 1; i <= 12; i++) { hourOptions += `<option value="${i}">${i}</option>`; }
    
    let minuteOptions = '';
    for (let i = 0; i <= 59; i++) {
        let paddedMin = i.toString().padStart(2, '0');
        minuteOptions += `<option value="${paddedMin}">${paddedMin}</option>`;
    }

    document.getElementById('start-hour').innerHTML = hourOptions;
    document.getElementById('end-hour').innerHTML = hourOptions;
    document.getElementById('start-minute').innerHTML = minuteOptions;
    document.getElementById('end-minute').innerHTML = minuteOptions;

    ['start-hour', 'end-hour'].forEach(id => document.getElementById(id).value = "1");
    ['start-minute', 'end-minute'].forEach(id => document.getElementById(id).value = "00");
    ['start-ampm', 'end-ampm'].forEach(id => document.getElementById(id).value = "AM");
}

function getMinutesFromMidnight(hour, min, ampm) {
    let h = parseInt(hour);
    if (ampm === "AM" && h === 12) h = 0;
    if (ampm === "PM" && h !== 12) h += 12;
    return (h * 60) + parseInt(min);
}

function formatPhoneNumberLive(e) {
    const input = e.target.value.replace(/\D/g, ''); 
    const match = input.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
        let result = '';
        if (match[1]) result = match[1];
        if (match[2]) result = `(${match[1]})-${match[2]}`;
        if (match[3]) result = `(${match[1]})-${match[2]}-${match[3]}`;
        e.target.value = result; 
    }
}

phoneInput.addEventListener('input', formatPhoneNumberLive);


/* =====================================================================
   UI RENDERING (CALENDAR & DASHBOARD)
   ===================================================================== */

function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    monthSelect.value = month;
    yearSelect.value = year;
    
    let projectedTotal = 0;
    let actualPaid = 0;
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    events.forEach(e => {
        if (e.date.startsWith(currentMonthPrefix)) {
            const amt = parseFloat(e.amount) || 0;
            projectedTotal += amt;
            if (e.isPaid) actualPaid += amt;
        }
    });
    
    const unpaidBalance = projectedTotal - actualPaid;
    
    document.getElementById('projected-total').innerText = `$${projectedTotal.toFixed(2)}`;
    document.getElementById('actual-paid').innerText = `$${actualPaid.toFixed(2)}`;
    document.getElementById('unpaid-balance').innerText = `-$${unpaidBalance.toFixed(2)}`; 

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonthYear = (today.getMonth() === month && today.getFullYear() === year);
    
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.appendChild(document.createElement('div'));
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayCell = document.createElement('div');
        dayCell.classList.add('day-cell');
        
        if (isCurrentMonthYear && day === today.getDate()) {
            dayCell.classList.add('current-day');
        }
        
        dayCell.innerHTML = `<div class="day-number">${day}</div>`;
        
        const dayEvents = events.filter(e => e.date === dateStr);
        dayEvents.sort((a, b) => a.startMins - b.startMins);
        
        dayEvents.forEach(e => {
            const pill = document.createElement('div');
            pill.classList.add('event-pill');
            if (e.isPaid) pill.classList.add('paid'); 
            
            pill.innerText = `${e.start} - ${e.end}: ${e.person}`;
            dayCell.appendChild(pill);
        });
        
        dayCell.addEventListener('click', () => {
            openedFromSearch = false;
            openDayView(dateStr, dayEvents);
        });
        calendarGrid.appendChild(dayCell);
    }
}


/* =====================================================================
   FORM HANDLING (ADD & EDIT) AND OVERLAP VALIDATION
   ===================================================================== */

eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    errorMsg.classList.add('hidden');
    
    const dateVal = document.getElementById('date').value;
    const sHour = document.getElementById('start-hour').value;
    const sMin = document.getElementById('start-minute').value;
    const sAmPm = document.getElementById('start-ampm').value;
    const eHour = document.getElementById('end-hour').value;
    const eMin = document.getElementById('end-minute').value;
    const eAmPm = document.getElementById('end-ampm').value;

    const startTotalMins = getMinutesFromMidnight(sHour, sMin, sAmPm);
    const endTotalMins = getMinutesFromMidnight(eHour, eMin, eAmPm);

    if (startTotalMins >= endTotalMins) {
        errorMsg.innerText = "Error: End time must be after Start time.";
        errorMsg.classList.remove('hidden');
        return;
    }

    const conflictingEvent = events.find(existingEvent => {
        if (existingEvent.date === dateVal && existingEvent.id !== editingEventId) {
            return (startTotalMins < existingEvent.endMins) && (endTotalMins > existingEvent.startMins);
        }
        return false;
    });
    
    if (conflictingEvent) {
        errorMsg.innerText = `Overlap Detected: ${conflictingEvent.person} is scheduled from ${conflictingEvent.start} to ${conflictingEvent.end}.`;
        errorMsg.classList.remove('hidden');
        return; 
    }
    
    if (editingEventId) {
        const evIndex = events.findIndex(event => event.id === editingEventId);
        if (evIndex !== -1) {
            events[evIndex] = {
                ...events[evIndex],
                person: document.getElementById('person').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                date: dateVal,
                start: `${sHour}:${sMin} ${sAmPm}`,
                end: `${eHour}:${eMin} ${eAmPm}`,
                startMins: startTotalMins,
                endMins: endTotalMins,
                amount: parseFloat(document.getElementById('amount').value) || 0,
                notes: document.getElementById('notes').value
            };
        }
        editingEventId = null;
        sidebarTitle.innerText = "Add New Entry";
        saveBtn.innerText = "Save to Calendar";
        saveBtn.style.background = "#007bff"; 
        saveBtn.style.color = "white";
    } else {
        const newEvent = {
            id: Date.now().toString(), 
            person: document.getElementById('person').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            date: dateVal,
            start: `${sHour}:${sMin} ${sAmPm}`,
            end: `${eHour}:${eMin} ${eAmPm}`,
            startMins: startTotalMins,
            endMins: endTotalMins,
            amount: parseFloat(document.getElementById('amount').value) || 0,
            notes: document.getElementById('notes').value,
            isPaid: false
        };
        events.push(newEvent);
    }
    
    autoSaveData(); 
    
    ['person', 'email', 'phone', 'amount', 'notes'].forEach(id => document.getElementById(id).value = '');
    setupTimeDropdowns(); 
    
    renderCalendar();
});


/* =====================================================================
   DAY VIEW MODAL (EDIT, DELETE, PAY, & RECEIPT ACTIONS)
   ===================================================================== */

function openDayView(dateStr, dayEvents) {
    modalDateTitle.innerText = `Details for ${dateStr}`;
    modalEventsList.innerHTML = '';
    
    if (openedFromSearch) {
        backToSearchBtn.classList.remove('hidden');
    } else {
        backToSearchBtn.classList.add('hidden');
    }
    
    if (dayEvents.length === 0) {
        modalEventsList.innerHTML = '<p>No entries for this day.</p>';
    } else {
        dayEvents.forEach(e => {
            const payAction = e.isPaid 
                ? `<span class="text-green" style="font-weight: bold; margin-right: 15px;">✓ Paid</span>` 
                : `<button class="btn-pay" data-id="${e.id}">Confirm Payment</button>`;

            // NEW: Fallbacks if phone or email are completely empty
            const phoneDisplay = e.phone ? e.phone : 'No Phone';
            const emailDisplay = e.email ? e.email : 'No Email';

            modalEventsList.innerHTML += `
                <div class="event-detail-card">
                    <h3>${e.start} - ${e.end}: ${e.person}</h3>
                    <p><strong>Contact:</strong> ${phoneDisplay} | ${emailDisplay}</p>
                    <p><strong>Receipt Amount:</strong> $${parseFloat(e.amount).toFixed(2)}</p>
                    <p><strong>Notes:</strong> ${e.notes}</p>
                    <div style="margin-top: 10px;">
                        ${payAction}
                        <button class="btn-secondary btn-receipt" data-id="${e.id}" style="width: auto; display: inline-block; margin-right: 10px; background: #007bff; padding: 6px 12px;">Download Receipt</button>
                        <button class="btn-edit" data-id="${e.id}">Edit</button>
                        <button class="btn-delete" data-id="${e.id}">Delete</button>
                    </div>
                </div>
            `;
        });
    }
    dayModal.classList.remove('hidden');
}

function handleReturnToSearch() {
    if (openedFromSearch) {
        searchModal.classList.remove('hidden');
        searchPhoneInput.dispatchEvent(new Event('input')); 
    }
}

modalEventsList.addEventListener('click', (e) => {
    const eventId = e.target.getAttribute('data-id');
    const ev = events.find(event => event.id === eventId);
    if (!ev) return;

    if (e.target.classList.contains('btn-edit')) {
        editingEventId = ev.id;
        
        sidebarTitle.innerText = "Edit Entry";
        saveBtn.innerText = "Update Entry";
        saveBtn.style.background = "#ffc107"; 
        saveBtn.style.color = "#333";
        
        document.getElementById('person').value = ev.person || '';
        document.getElementById('email').value = ev.email || '';
        document.getElementById('phone').value = ev.phone || '';
        document.getElementById('date').value = ev.date;
        document.getElementById('amount').value = ev.amount || '';
        document.getElementById('notes').value = ev.notes || '';
        
        const [sTime, sAmPm] = ev.start.split(' ');
        const [sHr, sMin] = sTime.split(':');
        document.getElementById('start-hour').value = parseInt(sHr);
        document.getElementById('start-minute').value = sMin;
        document.getElementById('start-ampm').value = sAmPm;

        const [eTime, eAmPm] = ev.end.split(' ');
        const [eHr, eMin] = eTime.split(':');
        document.getElementById('end-hour').value = parseInt(eHr);
        document.getElementById('end-minute').value = eMin;
        document.getElementById('end-ampm').value = eAmPm;

        dayModal.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (e.target.classList.contains('btn-delete')) {
        if (confirm("Are you sure you want to delete this event?")) {
            events = events.filter(event => event.id !== eventId);
            autoSaveData();
            dayModal.classList.add('hidden');
            renderCalendar();
            handleReturnToSearch(); 
        }
    }
    
    if (e.target.classList.contains('btn-pay')) {
        if (confirm("Are you sure you want this user to be marked as having paid?")) {
            ev.isPaid = true;
            autoSaveData();
            dayModal.classList.add('hidden');
            renderCalendar();
            handleReturnToSearch(); 
        }
    }

    if (e.target.classList.contains('btn-receipt')) {
        generatePDFReceipt(ev);
    }
});

document.getElementById('close-modal').addEventListener('click', () => {
    dayModal.classList.add('hidden');
    openedFromSearch = false;
});

backToSearchBtn.addEventListener('click', () => {
    dayModal.classList.add('hidden');
    searchModal.classList.remove('hidden');
    searchPhoneInput.dispatchEvent(new Event('input'));
});


/* =====================================================================
   PDF RECEIPT GENERATOR (html2pdf)
   ===================================================================== */

function generatePDFReceipt(ev) {
    const receiptDiv = document.createElement('div');
    const statusColor = ev.isPaid ? '#28a745' : '#dc3545';
    const statusText = ev.isPaid ? 'PAID' : 'PAYMENT PENDING';
    
    const durationHours = parseFloat(((ev.endMins - ev.startMins) / 60).toFixed(2));
    
    // NEW: Fallbacks if phone or email are completely empty
    const phoneDisplay = ev.phone ? ev.phone : 'No Phone';
    const emailDisplay = ev.email ? ev.email : 'No Email';
    
    receiptDiv.innerHTML = `
        <div style="padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333;">
            <div style="border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px;">
                <h1 style="color: #2c3e50; margin: 0;">Service Receipt</h1>
                <p style="color: #777; margin: 5px 0 0 0;">Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
                <p style="margin: 5px 0;"><strong>Client Name:</strong> ${ev.person}</p>
                <p style="margin: 5px 0;"><strong>Contact Info:</strong> ${phoneDisplay} | ${emailDisplay}</p>
                <p style="margin: 5px 0;"><strong>Service Date:</strong> ${ev.date}</p>
                <p style="margin: 5px 0;"><strong>Time & Duration:</strong> ${ev.start} to ${ev.end} (${durationHours} Hours)</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 12px; border: 1px solid #dee2e6; text-align: left;">Service Details & Notes</th>
                    <th style="padding: 12px; border: 1px solid #dee2e6; text-align: right; width: 150px;">Amount</th>
                </tr>
                <tr>
                    <td style="padding: 12px; border: 1px solid #dee2e6;">${ev.notes || 'Standard Service'}</td>
                    <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right;">$${parseFloat(ev.amount).toFixed(2)}</td>
                </tr>
            </table>
            
            <div style="text-align: right;">
                <h2 style="margin: 0; font-size: 1.5rem;">Total: $${parseFloat(ev.amount).toFixed(2)}</h2>
                <h3 style="margin: 10px 0 0 0; color: ${statusColor};">${statusText}</h3>
            </div>
            
            <div style="margin-top: 50px; font-size: 0.85rem; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
                Thank you for your business!
            </div>
        </div>
    `;

    const cleanName = ev.person.replace(/[^a-zA-Z0-9]/g, '_'); 
    const opt = {
        margin:       0.5,
        filename:     `Receipt_${cleanName}_${ev.date}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(receiptDiv).save();
}


/* =====================================================================
   CALENDAR NAVIGATION
   ===================================================================== */

todayBtn.addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });
monthSelect.addEventListener('change', (e) => { currentDate.setMonth(parseInt(e.target.value)); renderCalendar(); });
yearSelect.addEventListener('change', (e) => { currentDate.setFullYear(parseInt(e.target.value)); renderCalendar(); });
document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });


/* =====================================================================
   FILE MANAGEMENT & DATA IMPORT/EXPORT
   ===================================================================== */

document.getElementById('export-btn').addEventListener('click', () => {
    const dataStr = JSON.stringify(events, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const formattedFileName = `CalenderApp-${year}-${month}-${day}-${hours}-${minutes}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = formattedFileName;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            events = JSON.parse(e.target.result);
            autoSaveData();
            renderCalendar();
            alert("Data loaded successfully!");
        } catch (err) { alert("Error reading file."); }
    };
    reader.readAsText(file);
});


/* =====================================================================
   SEARCH CLIENT CRM (By Phone Number)
   ===================================================================== */

const searchModal = document.getElementById('search-modal');
const openSearchBtn = document.getElementById('open-search-btn');
const closeSearchModal = document.getElementById('close-search-modal');
const searchPhoneInput = document.getElementById('search-phone-input');
const searchResultsList = document.getElementById('search-results-list');

openSearchBtn.addEventListener('click', () => {
    searchModal.classList.remove('hidden');
    searchPhoneInput.value = '';
    searchResultsList.innerHTML = '<p style="color:#666;">Type a phone number to see history.</p>';
    searchPhoneInput.focus();
});

closeSearchModal.addEventListener('click', () => { 
    searchModal.classList.add('hidden'); 
    openedFromSearch = false; 
});

searchPhoneInput.addEventListener('input', (e) => {
    formatPhoneNumberLive(e); 
    
    const query = e.target.value.replace(/\D/g, ''); 
    searchResultsList.innerHTML = '';

    if (!query) {
        searchResultsList.innerHTML = '<p style="color:#666;">Type a phone number to see history.</p>';
        return;
    }

    const results = events.filter(ev => {
        const cleanPhone = (ev.phone || '').replace(/\D/g, '');
        return cleanPhone.includes(query);
    });
    
    if (results.length === 0) {
        searchResultsList.innerHTML = '<p class="text-red">No appointments found for this number.</p>';
        return;
    }

    results.sort((a, b) => new Date(a.date) - new Date(b.date));

    results.forEach(ev => {
        const statusText = ev.isPaid ? `<span class="text-green">Paid</span>` : `<span class="text-red">Unpaid</span>`;
        searchResultsList.innerHTML += `
            <div class="event-detail-card">
                <h3>${ev.date}: ${ev.person}</h3>
                <p><strong>Time:</strong> ${ev.start} - ${ev.end}</p>
                <p><strong>Receipt:</strong> $${parseFloat(ev.amount).toFixed(2)} (${statusText})</p>
                <p><strong>Notes:</strong> ${ev.notes}</p>
                
                <button class="btn-secondary btn-jump-to-day" data-date="${ev.date}" style="margin-top: 10px; background: #17a2b8; width: auto; padding: 6px 12px;">Manage Entry</button>
            </div>
        `;
    });
});

searchResultsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-jump-to-day')) {
        const targetDate = e.target.getAttribute('data-date');
        
        const dayEvents = events.filter(ev => ev.date === targetDate);
        dayEvents.sort((a, b) => a.startMins - b.startMins);
        
        searchModal.classList.add('hidden');
        openedFromSearch = true; 
        openDayView(targetDate, dayEvents);
    }
});


/* =====================================================================
   APP INITIALIZATION & SAFETY MEASURES
   ===================================================================== */

window.addEventListener('beforeunload', function (e) {
    if (events.length > 0) { e.preventDefault(); e.returnValue = ''; }
});

setupTimeDropdowns();

const savedData = localStorage.getItem('myCalendarApp_Data');
if (savedData) { events = JSON.parse(savedData); }

renderCalendar();