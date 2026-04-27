const eventsList = document.getElementById("events-list");
const eventsStatus = document.getElementById("events-status");
const refreshButton = document.getElementById("refresh-button");
const selectedEventBox = document.getElementById("selected-event");
const sectionSummary = document.getElementById("section-summary");
const purchaseForm = document.getElementById("purchase-form");
const purchaseButton = document.getElementById("purchase-button");
const purchaseResult = document.getElementById("purchase-result");
const userNameInput = document.getElementById("user-name");
const sectionSelect = document.getElementById("section-select");
const quantityInput = document.getElementById("quantity");
const cardTokenInput = document.getElementById("card-token");

const EVENTS_API_URL = "/api/events";
const PURCHASES_API_URL = "/api/purchases";

let selectedEvent = null;
let sectionsById = new Map();

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Date TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatPrice(price) {
  const numericPrice = Number(price);
  if (Number.isNaN(numericPrice)) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(numericPrice);
}

function seatLabel(seat) {
  return `${seat.row}-${seat.seat_number}`;
}

function resetSectionState(message = "Select an event to start your purchase.") {
  sectionSelect.innerHTML = '<option value="">Select a section</option>';
  sectionSelect.disabled = true;
  sectionSummary.textContent = message;
  sectionSummary.classList.add("hidden");
  sectionsById = new Map();
  purchaseButton.disabled = true;
}

function setSelectedEvent(event) {
  selectedEvent = event;
  selectedEventBox.classList.remove("empty-state");
  selectedEventBox.innerHTML = `
    <strong>${event.name}</strong><br>
    Venue: ${event.venue || "TBD"}<br>
    ${formatDate(event.date_time)}<br>
    Starting at ${formatPrice(event.base_price)}
  `;

  sectionSummary.textContent = "Loading sections and available seats...";
  sectionSummary.classList.remove("hidden");
  sectionSummary.classList.remove("empty-state");
  purchaseResult.classList.add("hidden");

  loadSectionsForEvent(event.id);
}

function showResult(kind, html) {
  purchaseResult.className = `result-card ${kind}`;
  purchaseResult.innerHTML = html;
  purchaseResult.classList.remove("hidden");
}

function renderEvents(events) {
  if (!Array.isArray(events) || events.length === 0) {
    eventsList.innerHTML = "";
    eventsStatus.textContent = "No events available right now.";
    return;
  }

  eventsStatus.textContent = `${events.length} event${events.length === 1 ? "" : "s"} available`;
  eventsList.innerHTML = "";

  for (const event of events) {
    const card = document.createElement("article");
    card.className = "event-card";
    card.innerHTML = `
      <h3>${event.name}</h3>
      <div class="event-meta">
        <span>${formatDate(event.date_time)}</span>
        <span>${event.venue || "Venue TBD"}</span>
        <span>${event.category || "General"}</span>
      </div>
      <p>${event.description || "No description available."}</p>
      <div class="card-footer">
        <span class="price">${formatPrice(event.base_price)}</span>
        <button class="card-button" type="button">Book Tickets</button>
      </div>
    `;

    card.querySelector("button").addEventListener("click", () => {
      setSelectedEvent(event);
      selectedEventBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    eventsList.appendChild(card);
  }
}

async function loadEvents() {
  eventsStatus.textContent = "Loading events...";
  eventsList.innerHTML = "";
  resetSectionState();

  try {
    const response = await fetch(EVENTS_API_URL);
    if (!response.ok) {
      throw new Error(`Events request failed with status ${response.status}`);
    }

    const events = await response.json();
    renderEvents(events);
  } catch (error) {
    eventsStatus.textContent = "Could not load events. Make sure Docker Compose is running.";
    eventsList.innerHTML = "";
  }
}

async function loadSectionsForEvent(eventId) {
  resetSectionState("Loading sections and available seats...");
  sectionSummary.classList.remove("hidden");

  try {
    const sectionsResponse = await fetch(`${EVENTS_API_URL}/${eventId}/sections`);
    if (!sectionsResponse.ok) {
      throw new Error(`Sections request failed with status ${sectionsResponse.status}`);
    }

    const sections = await sectionsResponse.json();
    if (!Array.isArray(sections) || sections.length === 0) {
      sectionSummary.textContent = "This event has no sections yet, so tickets cannot be purchased from the UI.";
      return;
    }

    const sectionsWithSeats = await Promise.all(
      sections.map(async (section) => {
        const seatsResponse = await fetch(`${EVENTS_API_URL}/${eventId}/sections/${section.id}/seats`);
        if (!seatsResponse.ok) {
          throw new Error(`Seats request failed with status ${seatsResponse.status}`);
        }

        const seats = await seatsResponse.json();
        const availableSeats = seats.filter((seat) => seat.status === "available");
        return {
          ...section,
          seats,
          availableSeats
        };
      })
    );

    const purchasableSections = sectionsWithSeats.filter((section) => section.availableSeats.length > 0);
    if (purchasableSections.length === 0) {
      sectionSummary.textContent = "No available seats were found for this event.";
      return;
    }

    sectionsById = new Map(purchasableSections.map((section) => [section.id, section]));
    sectionSelect.innerHTML = '<option value="">Select a section</option>';

    for (const section of purchasableSections) {
      const option = document.createElement("option");
      option.value = section.id;
      option.textContent = `${section.section_name} - ${section.availableSeats.length} available - ${formatPrice(section.price)}`;
      sectionSelect.appendChild(option);
    }

    sectionSelect.disabled = false;
    purchaseButton.disabled = false;
    sectionSummary.textContent = "Choose a section. The UI will reserve the first available seats from that section when you submit.";
  } catch (error) {
    sectionSummary.textContent = "Could not load section or seat data for this event.";
  }
}

function getSelectedSeats(section, quantity) {
  return section.availableSeats.slice(0, quantity).map(seatLabel);
}

sectionSelect.addEventListener("change", () => {
  const section = sectionsById.get(sectionSelect.value);
  if (!section) {
    sectionSummary.textContent = "Choose a section. The UI will reserve the first available seats from that section when you submit.";
    return;
  }

  sectionSummary.textContent = `${section.section_name} has ${section.availableSeats.length} available seats. Price for this section is ${formatPrice(section.price)} per seat.`;
});

purchaseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedEvent) {
    showResult("error", "Pick an event before purchasing.");
    return;
  }

  const selectedSection = sectionsById.get(sectionSelect.value);
  if (!selectedSection) {
    showResult("error", "Choose a section before purchasing.");
    return;
  }

  const quantity = Number(quantityInput.value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    showResult("error", "Enter a valid ticket quantity.");
    return;
  }

  if (quantity > selectedSection.availableSeats.length) {
    showResult("error", `Only ${selectedSection.availableSeats.length} seat(s) are currently available in ${selectedSection.section_name}.`);
    return;
  }

  const cardToken = cardTokenInput.value.trim();
  const customerName = userNameInput.value.trim() || "Guest";
  const seats = getSelectedSeats(selectedSection, quantity);

  purchaseButton.disabled = true;
  purchaseButton.textContent = "Submitting...";

  try {
    const response = await fetch(PURCHASES_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        userId: crypto.randomUUID(),
        eventId: selectedEvent.id,
        seats,
        cardToken
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      showResult(
        "error",
        `<strong>Purchase failed.</strong><br>${payload.error || payload.status || "The service rejected the request."}`
      );
      return;
    }

    showResult(
      "success",
      `<strong>Purchase confirmed.</strong><br>
       Customer: ${customerName}<br>
       Event: ${selectedEvent.name}<br>
       Section: ${selectedSection.section_name}<br>
       Seats: ${payload.seats.join(", ")}<br>
       Total: ${formatPrice(payload.totalUsd)}`
    );

    await loadSectionsForEvent(selectedEvent.id);
  } catch (error) {
    showResult("error", "Could not reach the purchase service. Check that the containers are running.");
  } finally {
    purchaseButton.disabled = false;
    purchaseButton.textContent = "Purchase Tickets";
  }
});

refreshButton.addEventListener("click", loadEvents);

loadEvents();
