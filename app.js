let isSignaling = false;
let audioCtx = null;
let customPresets = [];
let presetToDeleteIndex = -1;

const PRESETS =["SOS", "HELP", "INJURED", "NEED DOCTOR", "NEED MEDS", "NEED WATER", "NEED FOOD", "TRAPPED", "SEND RESCUE", "COME HERE", "SAFE HERE", "FIRE", "GAS LEAK", "CLEAR", "STAY BACK", "FOLLOW ME", "WAIT", "NO", "YES", "DANGER", "COLD", "EVACUATE", "HEARING IMPAIRED", "NORTH", "SOUTH", "EAST", "WEST", "RECEIVED", "NOT RECEIVED"];
const MORSE_DICT = {'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----', ' ': '/'};
const REVERSE_DICT = Object.fromEntries(Object.entries(MORSE_DICT).map(([k, v]) => [v, k]));

document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    renderPresets();
    initDecoder();
    initModalEvents();
    setTimeout(() => { emitToAI2("REQ_ALL_DATA"); }, 300);
});

function initNavigation() {
    const tabs = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-target');
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
}

function emitToAI2(command) {
    if (window.AppInventor) { window.AppInventor.setWebViewString(command); }
}

function addCustomPreset() {
    const input = document.getElementById('customInput');
    let rawText = input.value.trim().toUpperCase();
    let cleanText = rawText.replace(/[^A-Z0-9 ]/g, '').substring(0, 48);

    if(cleanText === "") { return; }
    if(customPresets.includes(cleanText) || PRESETS.includes(cleanText)) {
        input.value = ""; return;
    }
    customPresets.unshift(cleanText);
    input.value = "";
    saveCustomPresets();
    renderPresets();
}

function promptDelete(index) {
    presetToDeleteIndex = index;
    document.getElementById('deleteModal').classList.add('show');
}

function initModalEvents() {
    document.getElementById('confirmDeleteBtn').onclick = () => {
        if(presetToDeleteIndex > -1) {
            customPresets.splice(presetToDeleteIndex, 1);
            saveCustomPresets();
            renderPresets();
        }
        document.getElementById('deleteModal').classList.remove('show');
    };

    document.getElementById('cancelDeleteBtn').onclick = () => {
        presetToDeleteIndex = -1;
        document.getElementById('deleteModal').classList.remove('show');
    };
}

function saveCustomPresets() {
    const safeString = encodeURIComponent(customPresets.join('|'));
    emitToAI2("SAVE_CUSTOM:" + safeString);
}


function renderPresets() {
    const container = document.getElementById('preset-list');
    let html = '';
    customPresets.forEach((preset, index) => {
        html += `
            <div class="preset-item custom-preset-item">
                <span class="preset-text">
                    <svg class="star-icon" viewBox="0 0 24 24" width="22" height="22"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                    ${preset}
                </span>
                <div class="preset-actions">
                    <button onclick="playMorse('${preset}', 'light')">LIGHT</button>
                    <button onclick="playMorse('${preset}', 'audio')">AUDIO</button>
                    <button class="delete-btn" onclick="promptDelete(${index})">
                        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </div>`;
    });

    PRESETS.forEach(preset => {
        html += `
            <div class="preset-item">
                <span class="preset-text">${preset}</span>
                <div class="preset-actions">
                    <button onclick="playMorse('${preset}', 'light')">LIGHT</button>
                    <button onclick="playMorse('${preset}', 'audio')">AUDIO</button>
                </div>
            </div>`;
    });

    container.innerHTML = html;
}

window.saveMedicalData = function() {
    const dataArr =[
        document.getElementById('medName').value, document.getElementById('medBlood').value,
        document.getElementById('medAllergies').value, document.getElementById('medMeds').value,
        document.getElementById('medContact').value
    ];
    const safeString = encodeURIComponent(dataArr.join('|'));

    emitToAI2("SAVE_MED:" + safeString);
    const toast = document.getElementById('med-save-toast');
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
};

window.receiveAllData = function(encodedMedString, encodedCustomString) {
    if(encodedMedString && encodedMedString !== "null" && encodedMedString !== "") {
        try {
            const parts = decodeURIComponent(encodedMedString).split('|');
            document.getElementById('medName').value = parts[0] || "";
            document.getElementById('medBlood').value = parts[1] || "";
            document.getElementById('medAllergies').value = parts[2] || "";
            document.getElementById('medMeds').value = parts[3] || "";
            document.getElementById('medContact').value = parts[4] || "";
        } catch(e) {}
    }

    if(encodedCustomString && encodedCustomString !== "null" && encodedCustomString !== "") {
        try {
            const decodedPresets = decodeURIComponent(encodedCustomString);
            if(decodedPresets.length > 0) {
                customPresets = decodedPresets.split('|');
                renderPresets();
            }
        } catch(e) {}
    }
};

// MORSE ENGINE
function getAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if(AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

async function playMorse(text, type) {
    if(isSignaling) return;
    isSignaling = true;
    const morseStr = text.toUpperCase().split('').map(char => MORSE_DICT[char] || '').join(' ');
    const unitDelay = 120;
    for(let i=0; i<morseStr.length; i++) {
        const char = morseStr[i];
        if(!isSignaling) break;
        if(char === '.') await emitSignal(unitDelay, type);
        else if(char === '-') await emitSignal(unitDelay * 3, type);
        else if(char === ' ') await sleep(unitDelay * 3);
        else if(char === '/') await sleep(unitDelay * 7);
        await sleep(unitDelay);
    }
    isSignaling = false;
    emitToAI2("FLASH_OFF");
}

async function emitSignal(duration, type) {
    if(type === 'light') {
        emitToAI2("FLASH_ON");
        await sleep(duration);
        emitToAI2("FLASH_OFF");
    } else {
        const ctx = getAudioContext();
        if(!ctx) return;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 1000;
        osc.connect(gainNode); gainNode.connect(ctx.destination);
        osc.start(); await sleep(duration); osc.stop();
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function initDecoder() {
    const btn = document.getElementById('tap-sensor');
    const morseTape = document.getElementById('morse-tape');
    const textTape = document.getElementById('text-tape');
    const clearBtn = document.getElementById('clear-tape');
    let pressTime = 0, sequence = "", spaceTimeout;

    const downEvent = (e) => { e.preventDefault(); pressTime = Date.now(); btn.style.backgroundColor = "var(--text-primary)"; clearTimeout(spaceTimeout); };
    const upEvent = (e) => {
        e.preventDefault(); btn.style.backgroundColor = "var(--accent)";
        let duration = Date.now() - pressTime;
        let symbol = duration < 250 ? "." : "-";
        sequence += symbol; morseTape.innerText = sequence;

        spaceTimeout = setTimeout(() => {
            if(sequence) { textTape.innerText += REVERSE_DICT[sequence] || '?'; sequence = ""; morseTape.innerText = "Waiting..."; }
        }, 600);
    };

    btn.addEventListener('touchstart', downEvent, {passive: false});
    btn.addEventListener('touchend', upEvent, {passive: false});
    clearBtn.addEventListener('click', () => { sequence = ""; morseTape.innerText = "Waiting..."; textTape.innerText = ""; });
}

window.triggerImpactScreen = function() {
    const modal = document.getElementById('impactModal');
    modal.classList.add('show');
    document.getElementById('broadcastSosBtn').onclick = () => { modal.classList.remove('show'); playMorse('SOS', 'audio'); playMorse('SOS', 'light'); };
    document.getElementById('dismissModalBtn').onclick = () => { modal.classList.remove('show'); };
};
