const eventsList = document.getElementById("events-list");
const eventsStatus = document.getElementById("events-status");
const refreshButton = document.getElementById("refresh-button");
const selectedEventBox = document.getElementById("selected-event");
const purchaseForm = document.getElementById("purchase-form");
const purchaseButton = document.getElementById("purchase-button");
const purchaseResult = document.getElementById("purchase-result");
const userNameInput = document.getElementById("user-name");
const quantityInput = document.getElementById("quantity");
const cardTokenInput = document.getElementById("card-token");
const EVENTS_API_URL = "/api/events";
const PURCHASES_API_URL = "/api/purchases";

let selectedEvent = null;

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(price);
}

function setSelectedEvent(event) {
  selectedEvent = event;
  purchaseButton.disabled = false;
  selectedEventBox.classList.remove("empty-state");
  selectedEventBox.innerHTML = `
    <strong>${event.name}</strong><br>
    ${formatDate(event.dateTime)}<br>
    ${formatPrice(event.price)} per ticket
  `;
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
        <span>${formatDate(event.dateTime)}</span>
        <span>${event.category}</span>
      </div>
      <p>${event.description}</p>
      <div class="card-footer">
        <span class="price">${formatPrice(event.price)}</span>
        <button class="card-button" type="button">Book Tickets</button>
      </div>
    `;

    card.querySelector("button").addEventListener("click", () => {
      setSelectedEvent(event);
      purchaseResult.classList.add("hidden");
      selectedEventBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    eventsList.appendChild(card);
  }
}

async function loadEvents() {
  eventsStatus.textContent = "Loading events...";
  eventsList.innerHTML = "";

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

purchaseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedEvent) {
    showResult("error", "Pick an event before purchasing.");
    return;
  }

  const quantity = Number(quantityInput.value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    showResult("error", "Enter a valid ticket quantity.");
    return;
  }

  const userName = userNameInput.value.trim();
  const cardToken = cardTokenInput.value.trim();

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
        quantity,
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
       Purchase ID: ${payload.purchaseId}<br>
       Event: ${selectedEvent.name}<br>
       Quantity: ${payload.quantity}<br>
       Total: ${formatPrice(payload.totalUsd || selectedEvent.price * quantity)}`
    );
  } catch (error) {
    showResult("error", "Could not reach the purchase service. Check that the containers are running.");
  } finally {
    purchaseButton.disabled = false;
    purchaseButton.textContent = "Purchase Tickets";
  }
});

refreshButton.addEventListener("click", loadEvents);

loadEvents();
