// Variables globals
const gameGrid = document.getElementById('gameGrid');
let locations = [];
let selectedCards = [];
let lives = 3;
let score = 0;
let discoveredLocations = []; // Array per emmagatzemar les ubicacions descobertes

// Bounding box de Catalunya (coordenades mínimes i màximes)
const catalunyaBoundingBox = {
    latMin: 40.5,
    latMax: 42.5,
    lonMin: 0.0,
    lonMax: 3.3
};

// Funció per generar coordenades aleatòries dins del bounding box
function getRandomCoordinates() {
    let lat = Math.random() * (catalunyaBoundingBox.latMax - catalunyaBoundingBox.latMin) + catalunyaBoundingBox.latMin;
    lat = lat.toFixed(6); // Arrodonir a 6 decimals
    let lon = Math.random() * (catalunyaBoundingBox.lonMax - catalunyaBoundingBox.lonMin) + catalunyaBoundingBox.lonMin;
    lon = lon.toFixed(6); // Arrodonir a 6 decimals
    return { lat, lon };
}

// Connexió amb l'API
async function fetchLocationData(lat, lon) {
    try {
        const response = await fetch(`https://api.icgc.cat/territori/municipis/geo/${lon}/${lat}`);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        const data = await response.json();
        return data.responses; // Retornar directament les dades vàlides
    } catch (error) {
        console.error('Error al carregar les dades:', error);
        return null;
    }
}

// Funció per generar 4 llocs vàlids
async function generateLocations() {
    locations = [];

    let tries = 0;
    const maxTries = 100;

    while (locations.length < 4 && tries < maxTries) {
        const { lat, lon } = getRandomCoordinates();

        const locationData = await fetchLocationData(lat, lon);

        if (
            locationData &&
            locationData.features &&
            locationData.features.length > 0
        ) {
            const props = locationData.features[0].properties;
            if (props.CAPMUNI && props.CAPCOMAR && props.AREAM5000 && props.CAPPROV) {
                locations.push({
                    name: props.CAPMUNI || 'Desconegut',
                    comarca: props.CAPCOMAR || 'N/A',
                    superficie: props.AREAM5000 || 'N/A',
                    provincia: props.CAPPROV || 'N/A',
                    lat: lat, // Afegir latitud
                    lon: lon  // Afegir longitud
                });
            }
        }

        tries++;
    }

    if (locations.length < 4) {
        alert('No s’han pogut trobar 4 llocs vàlids. Torna-ho a provar.');
        resetGame(); // Reiniciar el joc si no es troben ubicacions vàlides
    }

    console.log('Ubicacions generades:', locations); // Depuració
}

// Funció per barrejar un array (algoritme de Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Funció per generar les cartes (4 llocs x 4 informacions = 16 cartes)
function generateCards() {
    gameGrid.innerHTML = '';

    // Crear totes les cartes
    const cards = [];

    locations.forEach((location, index) => {
        const infoTypes = [
            { type: 'Nom', value: location.name },
            { type: 'Capital de Comarca', value: location.comarca },
            { type: 'Superfície', value: location.superficie },
            { type: 'Provincia', value: location.provincia }
        ];

        infoTypes.forEach(info => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.dataset.locationIndex = index;
            card.dataset.infoType = info.type;
            card.textContent = `${info.type}: ${info.value}`;
            card.addEventListener('click', () => selectCard(card));
            cards.push(card); // Afegir la carta a l'array temporal
        });
    });

    // Barrejar les cartes
    const shuffledCards = shuffleArray(cards);

    // Afegir les cartes barrejades al DOM
    shuffledCards.forEach(card => gameGrid.appendChild(card));
}

// Funció per seleccionar una carta
function selectCard(card) {
    if (!selectedCards.includes(card)) {
        selectedCards.push(card);
        card.classList.add('selected');
    }

    if (selectedCards.length === 4) {
        checkMatch();
    }
}

// Funció per desseleccionar totes les cartes
function deselectAllCards() {
    selectedCards.forEach(card => {
        card.classList.remove('selected');
    });
    selectedCards = [];
}

// Funció per comprovar si hi ha coincidència
function checkMatch() {
    const selectedIndices = selectedCards.map(card => card.dataset.locationIndex);
    const selectedInfoTypes = selectedCards.map(card => card.dataset.infoType);

    // Obtenir les ubicacions corresponents a les cartes seleccionades
    const selectedLocations = selectedIndices.map(index => locations[index]);

    // Comprovar si totes les cartes comparteixen alguna propietat comuna:
    // - Mateixa ubicació (totes les cartes pertanyen al mateix lloc)
    // - Mateixa provincia
    // - Mateixa capital de comarca
    const allSameLocation = selectedIndices.every(index => index === selectedIndices[0]);
    const allSameProvince = selectedLocations.every(loc => loc.provincia === selectedLocations[0].provincia);
    const allSameComarca = selectedLocations.every(loc => loc.comarca === selectedLocations[0].comarca);

    if (allSameLocation || allSameProvince || allSameComarca) {
        alert('Coincidència trobada!');
        score += 10;
        updateScore();

        // Obtenir l'ubicació encertada
        const matchedLocationIndex = selectedIndices[0];
        const matchedLocation = locations[matchedLocationIndex];

        // Afegir l'ubicació a les ubicacions descobertes (si no hi és ja)
        if (!discoveredLocations.some(loc => loc.name === matchedLocation.name)) {
            discoveredLocations.push(matchedLocation);
            addMarkerToMap(matchedLocation); // Afegir el marcador al mapa
        }

        // Desactivar les cartes correctes
        selectedCards.forEach(card => {
            card.style.backgroundColor = '#4caf50';
            card.style.color = 'white';
            card.removeEventListener('click', selectCard);
        });

        // Comprovar si s'han descobert totes les ubicacions
        if (discoveredLocations.length === 4) {
            alert('Enhorabona! Has completat el joc!');
            resetGame(); // Reiniciar el joc automàticament
        }
    } else {
        alert('No coincideixen!');
        lives--;
        updateLives();
    }

    deselectAllCards();

    if (lives === 0) {
        alert('Has perdut! Juga de nou.');
        resetGame(); // Reiniciar el joc quan es perdi
    }
}

// Funció per actualitzar les vides
function updateLives() {
    const livesElement = document.getElementById('lives');
    livesElement.textContent = '❤️ '.repeat(lives);
}

// Funció per actualitzar la puntuació
function updateScore() {
    const scoreElement = document.getElementById('score');
    scoreElement.textContent = score;
}

// Funció per reiniciar el joc
function resetGame() {
    lives = 3;
    score = 0;
    discoveredLocations = []; // Buidar les ubicacions descobertes
    updateLives();
    updateScore();

    // Esborrar tots els marcadors del mapa
    if (map) {
        map.eachLayer(layer => {
            if (layer instanceof maplibregl.Marker) {
                layer.remove(); // Eliminar el marcador
            }
        });
    }

    // Generar noves ubicacions i cartes
    generateLocations().then(() => generateCards());
}

// Variables globals per al mapa
let map;

// Funció per inicialitzar el mapa
function initializeMap() {
    // Crear el mapa centrat a Catalunya
    map = new maplibregl.Map({
        container: 'map', // ID del contenidor del mapa
        style: 'https://geoserveis.icgc.cat/contextmaps/icgc_mapa_estandard_general.json', // Estil bàsic de MapLibre
        center: [1.7, 41.6], // Coordenades centrals de Catalunya
        zoom: 7, // Nivell de zoom inicial
        attributionControl: false // Desactivar el control de crèdits
    });

    // Afegir controls al mapa (zoom i rotació)
    map.addControl(new maplibregl.NavigationControl());
}

// Funció per afegir un marcador al mapa
function addMarkerToMap(location) {
    // Convertir les coordenades de string a números
    const lon = parseFloat(location.lon);
    const lat = parseFloat(location.lat);

    // Crear un marcador per a l'ubicació
    new maplibregl.Marker()
        .setLngLat([lon, lat])
        .setPopup(new maplibregl.Popup().setText(location.name)) // Mostrar el nom al fer clic
        .addTo(map);
}

// Inicialització del mapa quan es carrega la pàgina
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    resetGame();
});

// Inicialització del joc
document.getElementById('shuffleButton').addEventListener('click', resetGame);
document.getElementById('deselectButton').addEventListener('click', deselectAllCards);
document.getElementById('submitButton').addEventListener('click', checkMatch);

resetGame();