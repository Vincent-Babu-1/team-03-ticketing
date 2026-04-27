const refreshButton = document.getElementById("refresh-button");
const servicesStatus = document.getElementById("services-status");
const servicesGrid = document.getElementById("services-grid");
const infraGrid = document.getElementById("infra-grid");
const alertList = document.getElementById("alert-list");
const healthyCount = document.getElementById("healthy-count");
const problemCount = document.getElementById("problem-count");
const queueCount = document.getElementById("queue-count");
const lastRefresh = document.getElementById("last-refresh");

const POLL_INTERVAL_MS = 3000;
const REQUEST_TIMEOUT_MS = 2000;

let isRefreshing = false;

const SERVICE_CONFIG = [
  {
    key: "event-catalog",
    name: "Event Catalog",
    subtitle: "Event, section, and seat inventory",
    endpoint: "/api/system/event-catalog/health",
    dependencies: ["database", "redis"]
  },
  {
    key: "purchase",
    name: "Purchase Service",
    subtitle: "Reserves seats and confirms purchases",
    endpoint: "/api/system/purchase/health",
    dependencies: ["db", "redis"]
  },
  {
    key: "payment",
    name: "Payment Service",
    subtitle: "Charges and reverses payments",
    endpoint: "/api/system/payment/health",
    dependencies: ["db", "redis"]
  },
  {
    key: "refund",
    name: "Refund Service",
    subtitle: "Validates and issues refunds",
    endpoint: "/api/system/refund/health",
    dependencies: ["db", "redis"]
  },
  {
    key: "analytics",
    name: "Analytics Worker",
    subtitle: "Consumes analytics queue jobs",
    endpoint: "/api/system/analytics/health",
    dependencies: ["db", "redis"]
  },
  {
    key: "fraud",
    name: "Fraud Worker",
    subtitle: "Screens purchases for suspicious activity",
    endpoint: "/api/system/fraud/health",
    dependencies: ["database", "redis"]
  },
  {
    key: "notification-service",
    name: "Notification Service",
    subtitle: "Publishes notification health and connectivity",
    endpoint: "/api/system/notification-service/health",
    dependencies: ["redis"]
  },
  {
    key: "notification-worker",
    name: "Notification Worker",
    subtitle: "Consumes confirmed purchase events",
    endpoint: "/api/system/notification-worker/health",
    dependencies: ["database", "redis"]
  },
  {
    key: "waitlist",
    name: "Waitlist Worker",
    subtitle: "Promotes queued users after seat release",
    endpoint: "/api/system/waitlist/health",
    dependencies: ["redis"]
  }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(value) {
  if (!value) {
    return "No data yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatRelativeTime(value) {
  if (!value) {
    return "Not reported";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.max(0, Math.round(diffMs / 1000));

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function statusTone(status) {
  if (status === "ok" || status === "healthy") {
    return "ok";
  }

  if (status === "down" || status === "error" || status === "unhealthy") {
    return "error";
  }

  if (status === "degraded" || status === "warn" || status === "warning") {
    return "warn";
  }

  return "unknown";
}

function normalizeDependencyValue(value) {
  if (value && typeof value === "object" && "status" in value) {
    return value.status;
  }

  if (typeof value === "boolean") {
    return value ? "ok" : "error";
  }

  return value ?? "unknown";
}

function humanizeDependencyName(name) {
  if (name === "db") return "DB";
  if (name === "database") return "DB";
  if (name === "redis") return "Redis";
  return name;
}

function normalizeService(config, payload, responseOk) {
  const serviceStatus = payload?.status || payload?.service_status || (responseOk ? "ok" : "down");
  const normalizedChecks = {};

  if (payload?.checks && typeof payload.checks === "object") {
    for (const [name, value] of Object.entries(payload.checks)) {
      normalizedChecks[name] = normalizeDependencyValue(value);
    }
  }

  for (const name of config.dependencies) {
    if (payload && payload[name] != null) {
      normalizedChecks[name] = normalizeDependencyValue(payload[name]);
    }
  }

  const queueDepth = payload?.queueDepth ?? payload?.depth ?? null;
  const dlqDepth = payload?.dlqDepth ?? payload?.dlq_depth ?? null;
  const lastJobAt = payload?.lastJobAt ?? payload?.last_job_at ?? null;

  return {
    key: config.key,
    name: config.name,
    subtitle: config.subtitle,
    endpoint: config.endpoint,
    status: String(serviceStatus),
    statusTone: statusTone(String(serviceStatus)),
    checks: normalizedChecks,
    queueDepth,
    dlqDepth,
    lastJobAt
  };
}

async function fetchService(config) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.endpoint, {
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await response.json();
    window.clearTimeout(timeoutId);
    return normalizeService(config, payload, response.ok);
  } catch (error) {
    window.clearTimeout(timeoutId);
    return {
      key: config.key,
      name: config.name,
      subtitle: config.subtitle,
      endpoint: config.endpoint,
      status: "down",
      statusTone: "error",
      checks: {},
      queueDepth: null,
      dlqDepth: null,
      lastJobAt: null,
      error: error.name === "AbortError" ? "Request timed out" : error.message
    };
  }
}

function renderServiceCard(service) {
  const dependencyRows = Object.entries(service.checks).map(([name, value]) => `
    <div class="metric-row">
      <span class="metric-key">${escapeHtml(humanizeDependencyName(name))}</span>
      <span class="metric-value">${escapeHtml(String(value))}</span>
    </div>
  `).join("");

  const queueRows = [
    service.queueDepth != null ? `
      <div class="metric-row">
        <span class="metric-key">Queue depth</span>
        <span class="metric-value">${escapeHtml(String(service.queueDepth))}</span>
      </div>
    ` : "",
    service.dlqDepth != null ? `
      <div class="metric-row">
        <span class="metric-key">DLQ depth</span>
        <span class="metric-value">${escapeHtml(String(service.dlqDepth))}</span>
      </div>
    ` : "",
    service.lastJobAt ? `
      <div class="metric-row">
        <span class="metric-key">Last job</span>
        <span class="metric-value">${escapeHtml(formatRelativeTime(service.lastJobAt))}</span>
      </div>
    ` : ""
  ].join("");

  return `
    <article class="service-card">
      <div class="service-card-header">
        <div>
          <h3>${escapeHtml(service.name)}</h3>
          <p class="service-subtitle">${escapeHtml(service.subtitle)}</p>
        </div>
        <span class="status-badge status-${service.statusTone}">${escapeHtml(service.status)}</span>
      </div>
      <div class="metric-list">
        ${dependencyRows || `
          <div class="metric-row">
            <span class="metric-key">Checks</span>
            <span class="metric-value">Not reported</span>
          </div>
        `}
        ${queueRows}
      </div>
      <div class="service-footer">
        Endpoint: <span class="mono">${escapeHtml(service.endpoint)}</span>
      </div>
    </article>
  `;
}

function buildInfrastructureRows(services) {
  const sources = [
    { label: "Redis", services: ["event-catalog", "purchase", "payment", "refund", "analytics", "fraud", "notification-service", "notification-worker", "waitlist"], checkNames: ["redis"] },
    { label: "Event Catalog DB", services: ["event-catalog"], checkNames: ["database", "db"] },
    { label: "Purchase DB", services: ["purchase", "payment"], checkNames: ["database", "db"] },
    { label: "Refund DB", services: ["refund"], checkNames: ["database", "db"] },
    { label: "Fraud DB", services: ["fraud"], checkNames: ["database", "db"] },
    { label: "Analytics DB", services: ["analytics"], checkNames: ["database", "db"] }
  ];

  return sources.map((source) => {
    const matchingServices = services.filter((service) => source.services.includes(service.key));
    const statuses = [];

    for (const service of matchingServices) {
      for (const checkName of source.checkNames) {
        if (service.checks[checkName] != null) {
          statuses.push(String(service.checks[checkName]));
        }
      }
    }

    let value = "Unknown";
    let tone = "unknown";

    if (statuses.length > 0) {
      const lowerStatuses = statuses.map((entry) => entry.toLowerCase());
      if (lowerStatuses.some((entry) => entry.includes("unavailable") || entry.includes("error") || entry.includes("down") || entry.includes("unhealthy"))) {
        value = "Unavailable";
        tone = "error";
      } else if (lowerStatuses.every((entry) => entry.includes("ok") || entry.includes("healthy"))) {
        value = "Reachable";
        tone = "ok";
      } else {
        value = "Partial";
        tone = "warn";
      }
    }

    return { label: source.label, value, tone };
  });
}

function renderInfrastructure(rows) {
  infraGrid.innerHTML = rows.map((row) => `
    <article class="infra-card">
      <h3>${escapeHtml(row.label)}</h3>
      <div class="infra-list">
        <div class="infra-row">
          <span class="infra-key">Status</span>
          <span class="status-badge status-${row.tone}">${escapeHtml(row.value)}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderAlerts(services) {
  const alerts = [];

  for (const service of services) {
    if (service.statusTone === "error") {
      alerts.push(`${service.name} is down or unreachable.`);
    } else if (service.statusTone === "warn") {
      alerts.push(`${service.name} is degraded and should be checked.`);
    }

    if (service.queueDepth != null && Number(service.queueDepth) > 0) {
      alerts.push(`${service.name} has queue backlog: ${service.queueDepth}.`);
    }

    if (service.dlqDepth != null && Number(service.dlqDepth) > 0) {
      alerts.push(`${service.name} has DLQ backlog: ${service.dlqDepth}.`);
    }
  }

  if (alerts.length === 0) {
    alertList.innerHTML = '<div class="alert-item ok">No active issues detected from the exposed health endpoints.</div>';
    return;
  }

  alertList.innerHTML = alerts.map((alert) => `
    <div class="alert-item">${escapeHtml(alert)}</div>
  `).join("");
}

function updateSummary(services) {
  const healthy = services.filter((service) => service.statusTone === "ok").length;
  const problems = services.filter((service) => service.statusTone !== "ok").length;
  const backloggedQueues = services.filter((service) => service.queueDepth != null && Number(service.queueDepth) > 0).length;

  healthyCount.textContent = String(healthy);
  problemCount.textContent = String(problems);
  queueCount.textContent = String(backloggedQueues);
  lastRefresh.textContent = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date());
}

async function loadOverview() {
  if (isRefreshing) {
    return;
  }

  isRefreshing = true;
  servicesStatus.textContent = "Refreshing service health...";
  refreshButton.disabled = true;

  const services = await Promise.all(SERVICE_CONFIG.map(fetchService));
  servicesGrid.innerHTML = services.map(renderServiceCard).join("");
  renderInfrastructure(buildInfrastructureRows(services));
  renderAlerts(services);
  updateSummary(services);

  const problemServices = services.filter((service) => service.statusTone !== "ok");
  if (problemServices.length === 0) {
    servicesStatus.textContent = `All ${services.length} services responded successfully.`;
  } else {
    servicesStatus.textContent = `${problemServices.length} service${problemServices.length === 1 ? "" : "s"} need attention.`;
  }

  refreshButton.disabled = false;
  isRefreshing = false;
}

refreshButton.addEventListener("click", loadOverview);

loadOverview();
window.setInterval(loadOverview, POLL_INTERVAL_MS);
