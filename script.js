const STORAGE_KEY = "mc";
const SERVICE_STORAGE_KEY = "mc-service";
const FUEL_STORAGE_KEY = "mc-fuel";
const OCR_SETTINGS_KEY = "mc-ocr-settings";
let trips = [];
let serviceLogs = [];
let fuelLogs = [];
let ocrSettings = {
  odoFormat: "5-tenths",
  hasTripCounter: true,
};
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let cloudSaveTimer = null;
let isLoadingCloudData = false;

try {
  trips = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
} catch (error) {
  trips = [];
}
try {
  serviceLogs = JSON.parse(localStorage.getItem(SERVICE_STORAGE_KEY) || "[]");
} catch (error) {
  serviceLogs = [];
}
try {
  fuelLogs = JSON.parse(localStorage.getItem(FUEL_STORAGE_KEY) || "[]");
} catch (error) {
  fuelLogs = [];
}
try {
  ocrSettings = {
    ...ocrSettings,
    ...JSON.parse(localStorage.getItem(OCR_SETTINGS_KEY) || "{}"),
  };
} catch (error) {
  ocrSettings = {
    odoFormat: "5-tenths",
    hasTripCounter: true,
  };
}

const dateInput = document.getElementById("date");
const odoInput = document.getElementById("odo");
const noteInput = document.getElementById("note");
const tripPhotosInput = document.getElementById("tripPhotos");
const saveMessage = document.getElementById("saveMessage");
const serviceDateInput = document.getElementById("serviceDate");
const serviceOdoInput = document.getElementById("serviceOdo");
const serviceTypeInput = document.getElementById("serviceType");
const serviceFilterInput = document.getElementById("serviceFilter");
const serviceNoteInput = document.getElementById("serviceNote");
const serviceMessage = document.getElementById("serviceMessage");
const fuelDateInput = document.getElementById("fuelDate");
const fuelOdoInput = document.getElementById("fuelOdo");
const fuelLitersInput = document.getElementById("fuelLiters");
const fuelPriceInput = document.getElementById("fuelPrice");
const fuelMessage = document.getElementById("fuelMessage");

const today = new Date().toISOString().split("T")[0];
dateInput.value = today;
serviceDateInput.value = today;
fuelDateInput.value = today;

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", function () {
    showTab(Number(button.dataset.tab));
  });
});
document.getElementById("openSettings").addEventListener("click", function () {
  showTab(4);
});
document.getElementById("saveTripBtn").addEventListener("click", addTrip);
document.getElementById("undoTripBtn").addEventListener("click", undoLastTrip);
document.getElementById("undoFuelBtn").addEventListener("click", undoLastFuel);
document.getElementById("yearSelect").addEventListener("change", render);
document.getElementById("saveFuelBtn").addEventListener("click", addFuelLog);
document
  .getElementById("saveServiceBtn")
  .addEventListener("click", addServiceLog);
serviceFilterInput.addEventListener("change", renderServiceLogs);
document.getElementById("exportBtn").addEventListener("click", exportCSV);
setupCloudBackupButtons();
document.getElementById("importBtn").addEventListener("click", importCSV);
document.getElementById("clearBtn").addEventListener("click", clearAll);
document.querySelectorAll(".kmPhotoInput").forEach((input) => {
  input.addEventListener("change", readKmFromPhoto);
});

const settingsMenu = document.getElementById("settingsMenu");
const speedometerPage = document.getElementById("speedometerPage");
const backupDataPage = document.getElementById("backupDataPage");
const versionPage = document.getElementById("versionPage");
const privacyPanel = document.getElementById("privacyPanel");
const odoFormatInput = document.getElementById("odoFormat");
const hasTripCounterInput = document.getElementById("hasTripCounter");

odoFormatInput.value = ocrSettings.odoFormat;
hasTripCounterInput.checked = Boolean(ocrSettings.hasTripCounter);
odoFormatInput.addEventListener("change", saveOcrSettings);
hasTripCounterInput.addEventListener("change", saveOcrSettings);

document
  .getElementById("openSpeedometer")
  .addEventListener("click", function () {
    showSettingsPage(speedometerPage);
  });

document
  .getElementById("openBackupData")
  .addEventListener("click", function () {
    showSettingsPage(backupDataPage);
  });

document.getElementById("openVersion").addEventListener("click", function () {
  showSettingsPage(versionPage);
});
document.getElementById("privacyBtn").addEventListener("click", function () {
  privacyPanel.hidden = !privacyPanel.hidden;
});

document.querySelectorAll("[data-settings-back]").forEach((button) => {
  button.addEventListener("click", showSettingsMenu);
});

function showSettingsMenu() {
  settingsMenu.classList.remove("hidden");
  speedometerPage.classList.add("hidden");
  backupDataPage.classList.add("hidden");
  versionPage.classList.add("hidden");
}

function showSettingsPage(page) {
  settingsMenu.classList.add("hidden");
  speedometerPage.classList.add("hidden");
  backupDataPage.classList.add("hidden");
  versionPage.classList.add("hidden");
  page.classList.remove("hidden");
}

function saveOcrSettings() {
  ocrSettings = {
    odoFormat: odoFormatInput.value,
    hasTripCounter: hasTripCounterInput.checked,
  };
  localStorage.setItem(OCR_SETTINGS_KEY, JSON.stringify(ocrSettings));
  scheduleCloudSave();
}
function showTab(index) {
  document
    .querySelectorAll(".tab")
    .forEach((tab, i) => tab.classList.toggle("active", i === index));
  document
    .querySelectorAll(".section")
    .forEach((section, i) => section.classList.toggle("active", i === index));

  if (index === 4) {
    showSettingsMenu();
  }
}

function createId() {
  return String(Date.now()) + "-" + String(Math.random()).slice(2);
}
function saveTrips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
  scheduleCloudSave();
}
function saveServiceLogs() {
  localStorage.setItem(SERVICE_STORAGE_KEY, JSON.stringify(serviceLogs));
  scheduleCloudSave();
}
function saveFuelLogs() {
  localStorage.setItem(FUEL_STORAGE_KEY, JSON.stringify(fuelLogs));
  scheduleCloudSave();
}

function getFirebaseConfig() {
  return window.LAMARIDE_FIREBASE_CONFIG || { enabled: false };
}

function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return Boolean(
    config.enabled &&
      config.apiKey &&
      config.projectId &&
      !String(config.apiKey).includes("INDSÆT_") &&
      !String(config.projectId).includes("INDSÆT_"),
  );
}

function setupCloudBackupButtons() {
  const signInBtn = document.getElementById("signInBtn");
  const signUpBtn = document.getElementById("signUpBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const syncNowBtn = document.getElementById("syncNowBtn");

  if (signInBtn) signInBtn.addEventListener("click", signInWithEmail);
  if (signUpBtn) signUpBtn.addEventListener("click", signUpWithEmail);
  if (signOutBtn) signOutBtn.addEventListener("click", signOutCloud);
  if (syncNowBtn) syncNowBtn.addEventListener("click", saveCloudDataNow);

  initFirebaseCloudBackup();
}

function initFirebaseCloudBackup() {
  if (!isFirebaseConfigured()) {
    setCloudStatus("Cloud backup er klar i koden, men Firebase config mangler.", true);
    return;
  }

  if (!window.firebase) {
    setCloudStatus("Firebase kunne ikke indlæses. Tjek internetforbindelsen.", true);
    return;
  }

  try {
    firebaseApp = firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(getFirebaseConfig());
    firebaseAuth = firebase.auth();
    firebaseDb = firebase.firestore();

    firebaseAuth.onAuthStateChanged(async (user) => {
      currentUser = user;
      updateAuthUi(user);

      if (user) {
        setCloudStatus("Logger ind og henter cloud backup...", false);
        await loadCloudData();
      } else {
        setCloudStatus("Log ind for at gemme historikken i skyen.", false);
      }
    });
  } catch (error) {
    setCloudStatus("Firebase kunne ikke starte: " + error.message, true);
  }
}

function getAuthCredentials() {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  if (!email || !password) {
    setCloudStatus("Skriv både email og adgangskode.", true);
    return null;
  }

  if (password.length < 6) {
    setCloudStatus("Adgangskoden skal være mindst 6 tegn.", true);
    return null;
  }

  return { email, password };
}

async function signInWithEmail() {
  if (!firebaseAuth) return;
  const credentials = getAuthCredentials();
  if (!credentials) return;

  try {
    await firebaseAuth.signInWithEmailAndPassword(
      credentials.email,
      credentials.password,
    );
  } catch (error) {
    setCloudStatus("Login fejlede: " + getFriendlyAuthError(error), true);
  }
}

async function signUpWithEmail() {
  if (!firebaseAuth) return;
  const credentials = getAuthCredentials();
  if (!credentials) return;

  try {
    await firebaseAuth.createUserWithEmailAndPassword(
      credentials.email,
      credentials.password,
    );
    await saveCloudDataNow();
  } catch (error) {
    setCloudStatus("Konto kunne ikke oprettes: " + getFriendlyAuthError(error), true);
  }
}

async function signOutCloud() {
  if (!firebaseAuth) return;
  await firebaseAuth.signOut();
}

function getCloudDocRef() {
  if (!firebaseDb || !currentUser) return null;
  return firebaseDb.collection("users").doc(currentUser.uid).collection("backup").doc("lamaride");
}

function getLocalBackupData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    trips,
    serviceLogs,
    fuelLogs,
    ocrSettings,
  };
}

async function loadCloudData() {
  const docRef = getCloudDocRef();
  if (!docRef) return;

  isLoadingCloudData = true;
  try {
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      await docRef.set(getLocalBackupData());
      setCloudStatus("Cloud backup er slået til. Dine lokale data er uploadet.", false);
      return;
    }

    const data = snapshot.data() || {};
    trips = Array.isArray(data.trips) ? data.trips : [];
    serviceLogs = Array.isArray(data.serviceLogs) ? data.serviceLogs : [];
    fuelLogs = Array.isArray(data.fuelLogs) ? data.fuelLogs : [];
    ocrSettings = { ...ocrSettings, ...(data.ocrSettings || {}) };

    normalizeTrips();
    normalizeServiceLogs();
    normalizeFuelLogs();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    localStorage.setItem(SERVICE_STORAGE_KEY, JSON.stringify(serviceLogs));
    localStorage.setItem(FUEL_STORAGE_KEY, JSON.stringify(fuelLogs));
    localStorage.setItem(OCR_SETTINGS_KEY, JSON.stringify(ocrSettings));

    if (odoFormatInput) odoFormatInput.value = ocrSettings.odoFormat;
    if (hasTripCounterInput) hasTripCounterInput.checked = Boolean(ocrSettings.hasTripCounter);

    updateYearOptions();
    render();
    setCloudStatus("Cloud backup er aktiv. Data er hentet fra skyen.", false);
  } catch (error) {
    setCloudStatus("Cloud backup kunne ikke hentes: " + error.message, true);
  } finally {
    isLoadingCloudData = false;
  }
}

function scheduleCloudSave() {
  if (isLoadingCloudData || !currentUser || !firebaseDb) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(saveCloudDataNow, 700);
}

async function saveCloudDataNow() {
  const docRef = getCloudDocRef();
  if (!docRef) return;

  try {
    await docRef.set(getLocalBackupData());
    setCloudStatus("Cloud backup opdateret.", false);
  } catch (error) {
    setCloudStatus("Cloud backup fejlede: " + error.message, true);
  }
}

function updateAuthUi(user) {
  const loggedOut = document.getElementById("authLoggedOut");
  const loggedIn = document.getElementById("authLoggedIn");
  const userEmail = document.getElementById("authUserEmail");

  if (!loggedOut || !loggedIn) return;
  loggedOut.hidden = Boolean(user);
  loggedIn.hidden = !user;
  if (userEmail) userEmail.textContent = user ? user.email : "";
}

function setCloudStatus(text, isError) {
  const element = document.getElementById("cloudStatus");
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#b91c1c" : "#166534";
}

function getFriendlyAuthError(error) {
  const code = error && error.code ? error.code : "";
  if (code.includes("auth/invalid-email")) return "Emailadressen ser forkert ud.";
  if (code.includes("auth/user-not-found")) return "Der findes ingen konto med den email.";
  if (code.includes("auth/wrong-password") || code.includes("auth/invalid-credential")) return "Forkert email eller adgangskode.";
  if (code.includes("auth/email-already-in-use")) return "Der findes allerede en konto med den email.";
  if (code.includes("auth/weak-password")) return "Adgangskoden er for svag.";
  return error.message || "Ukendt fejl.";
}

function normalizeTrips() {
  trips = trips
    .map((trip) => ({
      id: trip.id || createId(),
      date: trip.date,
      odo: Number(trip.odo),
      d: Number(trip.d || 0),
      note: trip.note || "",
      photos: Array.isArray(trip.photos) ? trip.photos : [],
    }))
    .filter((trip) => trip.date && !Number.isNaN(trip.odo));
  trips.sort((a, b) => Number(a.odo) - Number(b.odo));
  recalculateDistances();
}

function recalculateDistances() {
  trips.sort((a, b) => Number(a.odo) - Number(b.odo));
  trips = trips.map((trip, index) => {
    const previous = trips[index - 1];
    return {
      ...trip,
      d: previous ? Number(trip.odo) - Number(previous.odo) : 0,
    };
  });
}

function getLatestTrip() {
  if (trips.length === 0) return null;
  return trips.reduce(
    (highest, trip) =>
      Number(trip.odo) > Number(highest.odo) ? trip : highest,
    trips[0],
  );
}

function normalizeServiceLogs() {
  serviceLogs = serviceLogs
    .map((item) => ({
      id: item.id || createId(),
      date: item.date,
      odo: Number(item.odo),
      type: item.type || "Diverse",
      note: item.note || "",
    }))
    .filter((item) => item.date && !Number.isNaN(item.odo));
  serviceLogs.sort((a, b) => Number(a.odo) - Number(b.odo));
}

function normalizeFuelLogs() {
  fuelLogs = fuelLogs
    .map((item) => ({
      id: item.id || createId(),
      date: item.date,
      odo: Number(item.odo),
      l: Number(item.l),
      p: Number(item.p),
    }))
    .filter(
      (item) =>
        item.date &&
        !Number.isNaN(item.odo) &&
        !Number.isNaN(item.l) &&
        !Number.isNaN(item.p),
    );
  fuelLogs.sort((a, b) => Number(a.odo) - Number(b.odo));
}

function undoLastTrip() {
  if (trips.length === 0) {
    alert("Ingen ture at fortryde");
    return;
  }
  const newestTrip = trips
    .slice()
    .sort((a, b) => Number(b.odo) - Number(a.odo))[0];
  const newestNumber = trips.length;
  if (!confirm("Er du sikker på, at du vil slette tur #" + newestNumber + "?"))
    return;
  trips = trips.filter((trip) => String(trip.id) !== String(newestTrip.id));
  recalculateDistances();
  saveTrips();
  updateYearOptions();
  render();
  showMessage(saveMessage, "Tur #" + newestNumber + " er slettet.", false);
}
function undoLastFuel() {
  if (fuelLogs.length === 0) {
    alert("Ingen tankninger at fortryde");
    return;
  }

  const newestFuel = fuelLogs
    .slice()
    .sort((a, b) => Number(b.odo) - Number(a.odo))[0];

  const newestNumber = fuelLogs.length;

  if (
    !confirm(
      "Er du sikker på, at du vil slette tankning #" + newestNumber + "?",
    )
  )
    return;

  fuelLogs = fuelLogs.filter(
    (item) => String(item.id) !== String(newestFuel.id),
  );

  saveFuelLogs();
  render();

  showMessage(fuelMessage, "Tankning #" + newestNumber + " er slettet.", false);
}
async function addTrip() {
  const date = dateInput.value;
  const odo = Number(odoInput.value.replace(",", "."));
  saveMessage.textContent = "";
  if (!date) {
    showMessage(saveMessage, "Vælg en dato først.", true);
    return;
  }
  if (!odo || Number.isNaN(odo) || odo <= 0) {
    showMessage(saveMessage, "Skriv km-tællerstand som et tal, fx 33.", true);
    return;
  }
  const last = getLatestTrip();
  if (last && odo <= Number(last.odo)) {
    showMessage(
      saveMessage,
      "Km-tællerstanden skal være højere end sidste registrering: " +
        formatNumber(last.odo) +
        " km.",
      true,
    );
    return;
  }
  let photos = [];
  try {
    photos = await readTripPhotoFiles(tripPhotosInput.files);
  } catch (error) {
    showMessage(saveMessage, "Et eller flere fotos kunne ikke gemmes.", true);
    return;
  }

  trips.push({
    id: createId(),
    date,
    odo,
    d: 0,
    note: noteInput.value,
    photos,
  });
  recalculateDistances();
  saveTrips();
  odoInput.value = "";
  noteInput.value = "";
  tripPhotosInput.value = "";
  updateYearOptions();
  render();
  showMessage(saveMessage, "Turen er gemt.", false);
}

function addFuelLog() {
  const date = fuelDateInput.value;
  const odo = Number(fuelOdoInput.value.replace(",", "."));
  const liters = Number(fuelLitersInput.value.replace(",", "."));
  const price = Number(fuelPriceInput.value.replace(",", "."));
  fuelMessage.textContent = "";
  if (!date) {
    showMessage(fuelMessage, "Vælg en dato først.", true);
    return;
  }
  if (!odo || Number.isNaN(odo) || odo <= 0) {
    showMessage(fuelMessage, "Skriv km-stand.", true);
    return;
  }
  if (!liters || Number.isNaN(liters) || liters <= 0) {
    showMessage(fuelMessage, "Skriv liter tanket.", true);
    return;
  }
  if (!price || Number.isNaN(price) || price <= 0) {
    showMessage(fuelMessage, "Skriv total pris.", true);
    return;
  }
  fuelLogs.push({ id: createId(), date, odo, l: liters, p: price });
  normalizeFuelLogs();
  saveFuelLogs();
  fuelOdoInput.value = "";
  fuelLitersInput.value = "";
  fuelPriceInput.value = "";
  render();
  showMessage(fuelMessage, "Optankning er gemt.", false);
}

function addServiceLog() {
  const date = serviceDateInput.value;
  const odo = Number(serviceOdoInput.value.replace(",", "."));
  const type = serviceTypeInput.value;
  const note = serviceNoteInput.value.trim();
  serviceMessage.textContent = "";
  if (!date) {
    showMessage(serviceMessage, "Vælg en dato først.", true);
    return;
  }
  if (!odo || Number.isNaN(odo) || odo <= 0) {
    showMessage(serviceMessage, "Skriv km-stand som et tal.", true);
    return;
  }
  serviceLogs.push({ id: createId(), date, odo, type, note });
  normalizeServiceLogs();
  saveServiceLogs();
  serviceOdoInput.value = "";
  serviceNoteInput.value = "";
  render();
  showMessage(serviceMessage, "Service er gemt.", false);
}

function showMessage(element, text, isError) {
  element.textContent = text;
  element.style.color = isError ? "#b91c1c" : "#166534";
}

async function readTripPhotoFiles(fileList) {
  const files = Array.from(fileList || []);
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  const photos = [];

  for (const file of imageFiles) {
    photos.push(await resizeTripPhoto(file));
  }

  return photos;
}

async function resizeTripPhoto(file) {
  const image = await loadImageFromFile(file);
  const maxSize = 1200;
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return {
    id: createId(),
    src: canvas.toDataURL("image/jpeg", 0.72),
  };
}

async function addPhotosToTrip(event) {
  const input = event.target;
  const tripId = input.dataset.tripId;
  const trip = trips.find((item) => String(item.id) === String(tripId));

  if (!trip) return;

  try {
    const photos = await readTripPhotoFiles(input.files);
    trip.photos = (trip.photos || []).concat(photos);
    saveTrips();
    render();
    showMessage(saveMessage, "Fotos er gemt på turen.", false);
  } catch (error) {
    showMessage(saveMessage, "Fotos kunne ikke gemmes på turen.", true);
  } finally {
    input.value = "";
  }
}

async function readKmFromPhoto(event) {
  const photoInput = event.target;
  const file = photoInput.files && photoInput.files[0];
  const targetInput = document.getElementById(photoInput.dataset.kmTarget);
  const messageElement = document.getElementById(photoInput.dataset.messageTarget);

  if (!file || !targetInput || !messageElement) return;
  clearKmChoices(messageElement);

  if (!window.Tesseract) {
    showMessage(
      messageElement,
      "Billedlæsning kunne ikke indlæses. Tjek internetforbindelsen og prøv igen.",
      true,
    );
    photoInput.value = "";
    return;
  }

  showMessage(messageElement, "Læser km fra billedet...", false);

  try {
    const image = await loadImageFromFile(file);
    const canvases = prepareOcrCanvases(image);
    let candidates = [];

    for (let i = 0; i < canvases.length; i++) {
      if (i > 0) {
        showMessage(
          messageElement,
          "Prøver en anden billedbehandling...",
          false,
        );
      }

      const result = await Tesseract.recognize(canvases[i], "eng", {
        tessedit_char_whitelist: "0123456789., kmKModoODO ",
        tessedit_pageseg_mode: "6",
      });
      candidates = candidates.concat(
        extractOdometerCandidates(result.data.text, result.data.words),
      );
    }

    candidates = rankOdometerCandidates(candidates);

    if (candidates.length === 0) {
      showMessage(
        messageElement,
        "Jeg kunne ikke finde et tydeligt kilometertal. Prøv et skarpere foto tættere på displayet.",
        true,
      );
      return;
    }

    if (candidates.length > 1) {
      showKmChoices(messageElement, targetInput, candidates);
      return;
    }

    const km = candidates[0].value;
    targetInput.value = km;
    targetInput.dispatchEvent(new Event("input", { bubbles: true }));
    showMessage(messageElement, "Km-stand fundet: " + formatNumber(km) + " km.", false);
  } catch (error) {
    showMessage(
      messageElement,
      "Billedet kunne ikke læses. Prøv igen med bedre lys og fokus på km-tælleren.",
      true,
    );
  } finally {
    photoInput.value = "";
  }
}

function clearKmChoices(messageElement) {
  const existing = messageElement.parentElement.querySelector(".kmChoices");
  if (existing) existing.remove();
}

function showKmChoices(messageElement, targetInput, candidates) {
  clearKmChoices(messageElement);
  showMessage(
    messageElement,
    "Jeg fandt flere mulige tal. Vælg km-standen:",
    false,
  );

  const choices = document.createElement("div");
  choices.className = "kmChoices";

  candidates.slice(0, 5).forEach((candidate) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kmChoiceBtn";
    button.textContent = formatNumber(candidate.value) + " km";
    button.addEventListener("click", () => {
      targetInput.value = candidate.value;
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
      clearKmChoices(messageElement);
      showMessage(
        messageElement,
        "Km-stand valgt: " + formatNumber(candidate.value) + " km.",
        false,
      );
    });
    choices.appendChild(button);
  });

  messageElement.insertAdjacentElement("afterend", choices);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      resolve(image);
    };
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function prepareOcrCanvases(image) {
  return [
    createOcrCanvas(image, "original"),
    createOcrCanvas(image, "contrast"),
    createOcrCanvas(image, "inverted"),
  ];
}

function createOcrCanvas(image, mode) {
  const maxWidth = 1800;
  const scale = Math.min(maxWidth / image.width, 1);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  if (mode === "original") return canvas;

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const boosted = Math.max(0, Math.min(255, (gray - 120) * 1.9 + 128));
    const value = mode === "inverted" ? 255 - boosted : boosted;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function extractOdometerCandidates(text, words) {
  const sourceText = [
    String(text || ""),
    Array.isArray(words) ? words.map((word) => word.text).join(" ") : "",
  ]
    .join(" ")
    .replaceAll("O", "0")
    .replaceAll("o", "0");

  const groupedCandidates = sourceText.match(/\d[\d\s.,]{2,}\d/g) || [];
  const looseDigitGroups = sourceText.match(/(?:\d\s*){4,8}/g) || [];
  const candidates = groupedCandidates.concat(looseDigitGroups);

  return candidates.flatMap(createOdometerCandidatesFromText);
}

function createOdometerCandidatesFromText(text) {
  const digits = String(text || "").replace(/[^\d]/g, "");
  if (!digits) return [];

  const values = [];
  const preferredDigits = getPreferredOdoDigits();
  const sourceValue = Number(digits);
  addCandidateValue(values, digits, false, preferredDigits, sourceValue);

  // Mange km-tællere viser sidste ciffer som 1/10 km. Prøv derfor også
  // samme aflæsning uden sidste ciffer, især når OCR læser hele displayet.
  if (digits.length >= 6) {
    addCandidateValue(
      values,
      digits.slice(0, -1),
      true,
      preferredDigits,
      sourceValue,
    );
  }

  return values.map((candidate) => ({
    text,
    value: candidate.value,
    digits: candidate.digits,
    sourceValue: candidate.sourceValue,
    removedTenths: candidate.removedTenths,
    formatMatch: candidate.formatMatch,
  }));
}

function addCandidateValue(
  values,
  digits,
  removedTenths,
  preferredDigits,
  sourceValue,
) {
  const value = Number(digits);
  if (value < 10000 || value > 999999) return;
  values.push({
    value,
    digits: digits.length,
    sourceValue,
    removedTenths,
    formatMatch:
      preferredDigits.length === 0 || preferredDigits.includes(digits.length),
  });
}

function rankOdometerCandidates(candidates) {
  candidates = filterCandidatesByOdoFormat(candidates);

  if (ocrSettings.hasTripCounter) {
    candidates = removeSmallestVisibleNumber(candidates);
  }

  const seen = new Set();
  let ranked = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreOdometerCandidate(candidate.value, candidate),
    }))
    .sort((a, b) => b.score - a.score)
    .filter((candidate) => {
      if (seen.has(candidate.value)) return false;
      seen.add(candidate.value);
      return true;
    });

  return ranked;
}

function filterCandidatesByOdoFormat(candidates) {
  const preferredDigits = getPreferredOdoDigits();
  if (preferredDigits.length === 0) return candidates;

  return candidates.filter((candidate) =>
    preferredDigits.includes(candidate.digits),
  );
}

function removeSmallestVisibleNumber(candidates) {
  const visibleNumbers = [...new Set(candidates.map((candidate) => candidate.sourceValue))]
    .filter((value) => value >= 10000)
    .sort((a, b) => a - b);

  if (visibleNumbers.length <= 1) return candidates;

  const smallestVisibleNumber = visibleNumbers[0];
  return candidates.filter(
    (candidate) => candidate.sourceValue !== smallestVisibleNumber,
  );
}

function scoreOdometerCandidate(value, candidate) {
  const digits = String(Math.round(value)).length;
  const expectedFormat = candidate && candidate.formatMatch ? 300000000 : 0;
  const tenthsBonus = candidate && candidate.removedTenths ? 150000000 : 0;
  const preferredLength = digits === 5 || digits === 6 ? 100000000 : 0;
  return expectedFormat + tenthsBonus + preferredLength + value;
}

function getPreferredOdoDigits() {
  if (ocrSettings.odoFormat === "5-tenths") return [5];
  if (ocrSettings.odoFormat === "6-tenths") return [6];
  return [5, 6];
}

function getSelectedYear() {
  return document.getElementById("yearSelect").value;
}

function updateYearOptions() {
  const select = document.getElementById("yearSelect");
  const current = select.value;
  const years = [...new Set(trips.map((trip) => trip.date.substring(0, 4)))]
    .sort()
    .reverse();
  select.innerHTML =
    '<option value="all">Alle</option>' +
    years
      .map((year) => '<option value="' + year + '">' + year + "</option>")
      .join("");
  if (
    current &&
    Array.from(select.options).some((option) => option.value === current)
  )
    select.value = current;
}

function render() {
  const selectedYear = getSelectedYear();
  const filtered =
    selectedYear && selectedYear !== "all"
      ? trips.filter((trip) => trip.date.startsWith(selectedYear))
      : trips;
  const total = filtered.reduce((sum, trip) => sum + Number(trip.d), 0);
  document.getElementById("totalKm").textContent = formatNumber(total);
  document.getElementById("totalTrips").textContent = filtered.length;
  document.getElementById("list").innerHTML = filtered.length
    ? filtered
        .map(
          (trip, index) =>
            '<div class="tripRow"><div>#' +
            (index + 1) +
            "</div><div>" +
            formatNumber(trip.d) +
            " km</div><div>" +
            formatDate(trip.date) +
            "</div><div>" +
            formatNumber(trip.odo) +
            "</div></div>",
        )
        .join("")
    : '<div class="empty">Ingen ture endnu</div>';
  renderMonthOverview(filtered);
  renderMonthChart(filtered);

  const currentYear = String(new Date().getFullYear());
  const yearTrips = trips.filter((trip) => trip.date.startsWith(currentYear));
  const yearTotal = yearTrips.reduce((sum, trip) => sum + Number(trip.d), 0);

  document.getElementById("yearTripsLog").textContent = yearTrips.length;
  document.getElementById("yearKmLog").textContent = formatNumber(yearTotal);

  const reversed = trips.slice().reverse();
  document.getElementById("logTripList").innerHTML = reversed.length
    ? reversed
        .map((trip, index) => {
          const number = trips.length - index;
          return (
            '<div class="tripLogItem"><div class="tripRow"><div>#' +
            number +
            "</div><div>" +
            formatNumber(trip.d) +
            " km</div><div>" +
            formatDate(trip.date) +
            "</div><div>" +
            formatNumber(trip.odo) +
            "</div></div>" +
            renderTripPhotos(trip) +
            renderTripPhotoControls(trip) +
            "</div>"
          );
        })
        .join("")
    : '<div class="empty">Ingen ture endnu</div>';
  document.querySelectorAll(".tripPhotoInput").forEach((input) => {
    input.addEventListener("change", addPhotosToTrip);
  });
  renderFuelLogs();
  renderServiceLogs();
}

function renderTripPhotos(trip) {
  const photos = Array.isArray(trip.photos) ? trip.photos : [];
  if (photos.length === 0) return "";

  return (
    '<div class="tripPhotos">' +
    photos
      .map(
        (photo) =>
          '<a href="' +
          photo.src +
          '" target="_blank" rel="noopener"><img src="' +
          photo.src +
          '" alt="Turfoto" /></a>',
      )
      .join("") +
    "</div>"
  );
}

function renderTripPhotoControls(trip) {
  const inputId = "tripPhotos-" + String(trip.id).replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    '<div class="tripPhotoActions"><input class="tripPhotoInput" type="file" id="' +
    inputId +
    '" accept="image/*" multiple data-trip-id="' +
    escapeHtml(trip.id) +
    '" /><label class="addTripPhotoBtn" for="' +
    inputId +
    '">Tilføj fotos</label></div>'
  );
}

function renderFuelLogs() {
  const currentYear = String(new Date().getFullYear());
  const fuelThisYear = fuelLogs.filter((item) =>
    item.date.startsWith(currentYear),
  );

  const totalFuelCost = fuelThisYear.reduce(
    (sum, item) => sum + Number(item.p),
    0,
  );

  let km = 0,
    l = 0,
    c = 0;

  for (let i = 1; i < fuelLogs.length; i++) {
    km += Number(fuelLogs[i].odo) - Number(fuelLogs[i - 1].odo);
    l += Number(fuelLogs[i].l);
    c += Number(fuelLogs[i].p);
  }

  document.getElementById("avgKml").textContent = l ? (km / l).toFixed(1) : "0";

  document.getElementById("costPerKm").textContent = km
    ? (c / km).toFixed(2)
    : "0";

  document.getElementById("totalFuelCost").textContent =
    formatNumber(totalFuelCost) + " kr";

  const reversed = fuelLogs.slice().reverse();

  document.getElementById("fuelList").innerHTML = reversed.length
    ? reversed
        .map((item, index) => {
          const number = fuelLogs.length - index;
          return (
            '<div class="tripRow"><div>#' +
            number +
            "</div><div>" +
            formatNumber(item.l) +
            " L</div><div>" +
            formatNumber(item.p) +
            " kr</div><div>" +
            formatNumber(item.odo) +
            "</div></div>"
          );
        })
        .join("")
    : '<div class="empty">Ingen tankninger endnu</div>';
}

function renderServiceLogs() {
  const selectedType = serviceFilterInput.value;
  const filtered =
    selectedType === "all"
      ? serviceLogs
      : serviceLogs.filter((item) => item.type === selectedType);
  const reversed = filtered.slice().reverse();
  document.getElementById("serviceList").innerHTML = reversed.length
    ? reversed
        .map((item, index) => {
          const number = serviceLogs.findIndex(
            (serviceItem) => String(serviceItem.id) === String(item.id),
          ) + 1;
          const note = item.note
            ? '<div class="hint" style="grid-column:2 / 5;margin:0">' +
              escapeHtml(item.note) +
              "</div>"
            : "";
          return (
            '<div class="tripRow"><div>#' +
            number +
            "</div><div>" +
            escapeHtml(item.type) +
            "</div><div>" +
            formatDate(item.date) +
            "</div><div>" +
            formatNumber(item.odo) +
            "</div>" +
            note +
            "</div>"
          );
        })
        .join("")
    : '<div class="empty">Ingen serviceposter endnu</div>';
}

function renderMonthChart(filteredTrips) {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Maj",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dec",
  ];
  const groups = {};
  filteredTrips.forEach((trip) => {
    const key = trip.date.substring(0, 7);
    if (!groups[key]) groups[key] = 0;
    groups[key] += Number(trip.d);
  });
  const keys = Object.keys(groups).sort();
  const max = Math.max(...keys.map((key) => groups[key]), 0);
  document.getElementById("monthChart").innerHTML = keys.length
    ? keys
        .map((key) => {
          const monthIndex = Number(key.substring(5, 7)) - 1;
          const height = max > 0 ? Math.max(4, (groups[key] / max) * 120) : 4;
          return (
            '<div class="chartBarWrap"><div class="chartValue">' +
            formatNumber(groups[key]) +
            '</div><div class="chartBar" style="height:' +
            height +
            'px"></div><div class="chartLabel">' +
            monthNames[monthIndex] +
            "</div></div>"
          );
        })
        .join("")
    : '<div class="empty">Ingen data til graf endnu</div>';
}

function renderMonthOverview(filteredTrips) {
  const monthNames = [
    "Januar",
    "Februar",
    "Marts",
    "April",
    "Maj",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "December",
  ];
  const groups = {};
  filteredTrips.forEach((trip) => {
    const key = trip.date.substring(0, 7);
    if (!groups[key]) groups[key] = { km: 0, count: 0 };
    groups[key].km += Number(trip.d);
    groups[key].count += 1;
  });
  const keys = Object.keys(groups).sort().reverse();
  document.getElementById("monthOverview").innerHTML = keys.length
    ? keys
        .map((key) => {
          const year = key.substring(0, 4);
          const monthIndex = Number(key.substring(5, 7)) - 1;
          const item = groups[key];
          return (
            '<div class="monthRow"><div><div class="monthName">' +
            monthNames[monthIndex] +
            " " +
            year +
            '</div><div class="monthMeta">' +
            item.count +
            " " +
            (item.count === 1 ? "tur" : "ture") +
            '</div></div><div class="monthKm">' +
            formatNumber(item.km) +
            " km</div></div>"
          );
        })
        .join("")
    : '<div class="empty">Ingen måneder at vise endnu</div>';
}

function formatDate(date) {
  return new Date(date + "T00:00:00").toLocaleDateString("da-DK");
}
function formatNumber(value) {
  return Number(value).toLocaleString("da-DK", { maximumFractionDigits: 1 });
}
function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function csvEscape(value) {
  const text = String(value || "");
  return '"' + text.replaceAll('"', '""') + '"';
}

function exportCSV() {
  const rows = [
    [
      "type",
      "dato",
      "odo",
      "distance",
      "note",
      "liter",
      "pris",
      "service_type",
    ],
    ...trips.map((trip) => [
      "log",
      trip.date,
      trip.odo,
      trip.d,
      trip.note || "",
      "",
      "",
      "",
    ]),
    ...fuelLogs.map((item) => [
      "brændstof",
      item.date,
      item.odo,
      "",
      "",
      "" + item.l,
      item.p,
      "",
    ]),
    ...serviceLogs.map((item) => [
      "service",
      item.date,
      item.odo,
      "",
      item.note || "",
      "",
      "",
      item.type,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const file = new File([blob], "LamaRide_backup.csv", {
    type: "text/csv",
  });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator
      .share({
        title: "LamaRide backup",
        text: "Backup af dine LamaRide data",
        files: [file],
      })
      .catch(() => {
        alert("Backup blev ikke gemt. Prøv igen og vælg fx 'Gem i Filer'.");
      });
  } else {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "LamaRide_backup.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

function importCSV() {
  const file = document.getElementById("importFile").files[0];
  if (!file) {
    alert("Vælg en CSV fil");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const text = String(event.target.result || "");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const importedTrips = [];
    const importedFuel = [];
    const importedService = [];

    lines.slice(1).forEach((line) => {
      const columns = parseCsvLine(line);

      const type = (columns[0] || "").trim();
      const date = (columns[1] || "").trim();
      const odo = Number((columns[2] || "").trim());
      const note = (columns[4] || "").trim();
      const liters = Number((columns[5] || "").trim());
      const price = Number((columns[6] || "").trim());
      const serviceType = (columns[7] || "").trim();

      if (type === "log" && date && !Number.isNaN(odo)) {
        importedTrips.push({ id: createId(), date, odo, d: 0, note });
      }

      if (
        type === "brændstof" &&
        date &&
        !Number.isNaN(odo) &&
        !Number.isNaN(liters) &&
        !Number.isNaN(price)
      ) {
        importedFuel.push({ id: createId(), date, odo, l: liters, p: price });
      }

      if (type === "service" && date && !Number.isNaN(odo)) {
        importedService.push({
          id: createId(),
          date,
          odo,
          type: serviceType || "Diverse",
          note,
        });
      }
    });

    if (
      importedTrips.length === 0 &&
      importedFuel.length === 0 &&
      importedService.length === 0
    ) {
      alert("Der blev ikke fundet gyldige data i CSV-filen");
      return;
    }

    trips = importedTrips;
    fuelLogs = importedFuel;
    serviceLogs = importedService;

    normalizeTrips();
    normalizeFuelLogs();
    normalizeServiceLogs();

    saveTrips();
    saveFuelLogs();
    saveServiceLogs();

    updateYearOptions();
    render();

    alert("Data importeret");
  };

  reader.readAsText(file);
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function clearAll() {
  if (confirm("Slet alt?")) {
    trips = [];
    serviceLogs = [];
    fuelLogs = [];
    saveTrips();
    saveServiceLogs();
    saveFuelLogs();
    updateYearOptions();
    render();
  }
}

normalizeTrips();
normalizeServiceLogs();
normalizeFuelLogs();
saveTrips();
saveServiceLogs();
saveFuelLogs();
updateYearOptions();
render();
