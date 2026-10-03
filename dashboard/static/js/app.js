/* =========================================================
   LOAD BALANCER MONITOR
   Dashboard JavaScript
   ========================================================= */

const STATS_URL = "http://127.0.0.1:8080/stats";

let lastStats = null;


/* =========================================================
   HELPER FUNCTIONS
   ========================================================= */

function formatNumber(value) {
    if (value === undefined || value === null) {
        return "0";
    }

    return Number(value).toLocaleString();
}


function formatLatency(value) {
    if (value === undefined || value === null) {
        return "0.000s";
    }

    return `${Number(value).toFixed(3)}s`;
}


function getBackend(port) {
    if (!lastStats || !lastStats.backends) {
        return null;
    }

    return lastStats.backends.find(
        backend => Number(backend.port) === Number(port)
    );
}


/* =========================================================
   UPDATE KPI CARDS
   ========================================================= */

function updateKPIs(stats) {

    const backends = stats.backends || [];

    let totalRequests = 0;
    let activeConnections = 0;
    let totalErrors = 0;
    let healthyCount = 0;

    let totalResponseTime = 0;
    let responseTimeRequests = 0;

    backends.forEach(backend => {

        totalRequests += Number(
            backend.total_requests || 0
        );

        activeConnections += Number(
            backend.active_connections || 0
        );

        totalErrors += Number(
            backend.errors || 0
        );

        if (backend.status === "UP") {
            healthyCount++;
        }

        const requests = Number(
            backend.total_requests || 0
        );

        const avgTime = Number(
            backend.avg_response_time || 0
        );

        totalResponseTime += avgTime * requests;
        responseTimeRequests += requests;
    });


    const averageLatency =
        responseTimeRequests > 0
            ? totalResponseTime / responseTimeRequests
            : 0;


    document.getElementById(
        "total-requests"
    ).textContent = formatNumber(totalRequests);


    document.getElementById(
        "active-connections"
    ).textContent = formatNumber(activeConnections);


    document.getElementById(
        "total-errors"
    ).textContent = formatNumber(totalErrors);


    document.getElementById(
        "avg-latency"
    ).textContent = formatLatency(averageLatency);


    document.getElementById(
        "healthy-count"
    ).textContent =
        `${healthyCount}/${backends.length}`;
}


/* =========================================================
   UPDATE VERDICT
   ========================================================= */

function updateVerdict(stats) {

    const backends = stats.backends || [];

    const healthy = backends.filter(
        backend => backend.status === "UP"
    );

    const unhealthy = backends.filter(
        backend => backend.status !== "UP"
    );


    const verdict = document.getElementById("verdict");
    const title = document.getElementById("verdict-title");
    const subtitle = document.getElementById("verdict-subtitle");
    const icon = document.querySelector(".verdict-icon");


    if (backends.length === 0) {

        title.textContent = "No backend data";

        subtitle.textContent =
            "The load balancer returned no backend information.";

        return;
    }


    /* -----------------------------------------------------
       ALL HEALTHY
       ----------------------------------------------------- */

    if (unhealthy.length === 0) {

        verdict.style.borderColor =
            "rgba(61, 214, 140, 0.16)";

        verdict.style.background =
            "linear-gradient(90deg, rgba(61, 214, 140, 0.08), rgba(61, 214, 140, 0.025))";


        title.textContent =
            "All systems operational";


        subtitle.textContent =
            `${healthy.length} of ${backends.length} backends healthy`;


        icon.style.background =
            "rgba(61, 214, 140, 0.12)";

        icon.style.color =
            "#3DD68C";

        return;
    }


    /* -----------------------------------------------------
       SOME BACKENDS DOWN
       ----------------------------------------------------- */

    if (healthy.length > 0) {

        verdict.style.borderColor =
            "rgba(245, 181, 68, 0.20)";

        verdict.style.background =
            "linear-gradient(90deg, rgba(245, 181, 68, 0.08), rgba(245, 181, 68, 0.025))";


        title.textContent =
            "Degraded service";


        subtitle.textContent =
            `${healthy.length} of ${backends.length} backends healthy · ${unhealthy.length} unavailable`;


        icon.style.background =
            "rgba(245, 181, 68, 0.12)";

        icon.style.color =
            "#F5B544";

        return;
    }


    /* -----------------------------------------------------
       ALL BACKENDS DOWN
       ----------------------------------------------------- */

    verdict.style.borderColor =
        "rgba(242, 85, 90, 0.22)";

    verdict.style.background =
        "linear-gradient(90deg, rgba(242, 85, 90, 0.09), rgba(242, 85, 90, 0.025))";


    title.textContent =
        "No healthy backends";


    subtitle.textContent =
        "Traffic cannot currently be forwarded.";


    icon.style.background =
        "rgba(242, 85, 90, 0.12)";

    icon.style.color =
        "#F2555A";
}


/* =========================================================
   UPDATE GLOBAL STATUS
   ========================================================= */

function updateGlobalStatus(stats) {

    const backends = stats.backends || [];

    const healthy = backends.filter(
        backend => backend.status === "UP"
    ).length;


    const statusText =
        document.querySelector(
            ".global-status span"
        );


    const statusDot =
        document.querySelector(
            ".global-status .status-dot"
        );


    if (!statusText) {
        return;
    }


    if (healthy === backends.length && backends.length > 0) {

        statusText.textContent = "Operational";

        statusText.parentElement.style.background =
            "rgba(61, 214, 140, 0.12)";

        statusText.parentElement.style.color =
            "#3DD68C";

        statusDot.style.background =
            "#3DD68C";

        return;
    }


    if (healthy > 0) {

        statusText.textContent = "Degraded";

        statusText.parentElement.style.background =
            "rgba(245, 181, 68, 0.12)";

        statusText.parentElement.style.color =
            "#F5B544";

        statusDot.style.background =
            "#F5B544";

        return;
    }


    statusText.textContent = "Critical";

    statusText.parentElement.style.background =
        "rgba(242, 85, 90, 0.12)";

    statusText.parentElement.style.color =
        "#F2555A";

    statusDot.style.background =
        "#F2555A";
}


/* =========================================================
   UPDATE ROUTING ALGORITHM
   ========================================================= */

function updateRoutingAlgorithm(stats) {

    const algorithm =
        stats.algorithm || "Unknown";


    const routingElement =
        document.getElementById("routing-algorithm");


    if (routingElement) {
        routingElement.textContent = algorithm;
    }


    const routingChip =
        document.querySelector(".routing-chip strong");


    if (routingChip) {
        routingChip.textContent = algorithm;
    }
}


/* =========================================================
   UPDATE LAST UPDATED TIME
   ========================================================= */

function updateTimestamp() {

    const element =
        document.getElementById("last-updated");


    if (!element) {
        return;
    }


    const now = new Date();


    element.textContent =
        `Updated ${now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        })}`;
}


/* =========================================================
   UPDATE TOPOLOGY NODE
   ========================================================= */

function updateTopologyNode(port) {

    const backend = getBackend(port);

    if (!backend) {
        return;
    }


    const node =
        document.getElementById(
            `node-${port}`
        );


    if (!node) {
        return;
    }


    const status =
        backend.status === "UP";


    /* -----------------------------------------------------
       Status
       ----------------------------------------------------- */

    const statusElement =
        node.querySelector(".node-status");


    const statusDot =
        node.querySelector(".node-status-dot");


    if (statusElement) {

        statusElement.textContent =
            status ? "UP" : "DOWN";

        if (!status) {
            statusElement.style.color =
                "#F2555A";
        } else {
            statusElement.style.color =
                "#3DD68C";
        }
    }


    if (statusDot) {

        statusDot.style.background =
            status ? "#3DD68C" : "#F2555A";
    }


    /* -----------------------------------------------------
       Requests
       ----------------------------------------------------- */

    const requests =
        document.getElementById(
            `node-requests-${port}`
        );


    if (requests) {

        requests.textContent =
            formatNumber(
                backend.total_requests
            );
    }


    /* -----------------------------------------------------
       Active Connections
       ----------------------------------------------------- */

    const active =
        document.getElementById(
            `node-active-${port}`
        );


    if (active) {

        active.textContent =
            formatNumber(
                backend.active_connections
            );
    }


    /* -----------------------------------------------------
       Node Appearance
       ----------------------------------------------------- */

    const card =
        node.querySelector(".node-card");


    if (card) {

        if (status) {

            card.style.opacity = "1";

            card.style.borderColor =
                "var(--border)";

        } else {

            card.style.opacity = "0.72";

            card.style.borderColor =
                "rgba(242, 85, 90, 0.35)";
        }
    }
}


/* =========================================================
   UPDATE ALL TOPOLOGY NODES
   ========================================================= */

function updateTopology(stats) {

    updateTopologyNode(9001);
    updateTopologyNode(9002);
    updateTopologyNode(9003);


    const backends = stats.backends || [];

    const totalRequests =
        backends.reduce(
            (sum, backend) =>
                sum + Number(
                    backend.total_requests || 0
                ),
            0
        );


    backends.forEach(backend => {

        const routing =
            document.getElementById(
                `routing-${backend.port}`
            );


        if (!routing) {
            return;
        }


        routing.textContent =
            formatNumber(
                backend.total_requests || 0
            );
    });


    /* -----------------------------------------------------
       Update traffic lines
       ----------------------------------------------------- */

    const connections =
        document.querySelectorAll(
            ".connection"
        );


    connections.forEach(
        connection => {

            connection.classList.remove(
                "inactive"
            );
        }
    );


    if (totalRequests === 0) {

        connections.forEach(
            connection => {
                connection.classList.add(
                    "inactive"
                );
            }
        );
    }
}


/* =========================================================
   CREATE BACKEND TABLE ROW
   ========================================================= */

function createBackendRow(backend) {

    const row =
        document.createElement("tr");


    const isUp =
        backend.status === "UP";


    const totalRequests =
        Number(
            backend.total_requests || 0
        );


    const totalErrors =
        Number(
            backend.errors || 0
        );


    const avgLatency =
        Number(
            backend.avg_response_time || 0
        );


    let errorRate = 0;


    if (totalRequests > 0) {

        errorRate =
            (totalErrors / totalRequests) * 100;
    }


    row.innerHTML = `

        <td>

            <div class="backend-name">

                <span
                    class="backend-indicator ${isUp ? "" : "down"}">
                </span>

                <div class="backend-name-text">

                    <span class="backend-name-primary">
                        Backend-${backend.port}
                    </span>

                    <span class="backend-name-secondary">
                        127.0.0.1:${backend.port}
                    </span>

                </div>

            </div>

        </td>


        <td>

            <span
                class="status-badge ${isUp ? "up" : "down"}">

                <span class="status-badge-dot"></span>

                ${isUp ? "UP" : "DOWN"}

            </span>

        </td>


        <td class="mono">
            ${formatNumber(totalRequests)}
        </td>


        <td class="mono">
            ${formatNumber(
                backend.active_connections || 0
            )}
        </td>


        <td class="mono">
            ${formatNumber(totalErrors)}
        </td>


        <td class="mono">
            ${formatLatency(avgLatency)}
        </td>


        <td>

            <div class="traffic-share">

                <div class="traffic-bar">

                    <div
                        class="traffic-bar-fill"
                        style="width: ${Math.min(errorRate * 10, 100)}%">
                    </div>

                </div>

                <span class="mono">
                    ${errorRate.toFixed(1)}%
                </span>

            </div>

        </td>


        <td>

            <div class="pulse-strip">

                ${createPulseBars(
                    backend,
                    isUp
                )}

            </div>

        </td>

    `;


    return row;
}


/* =========================================================
   CREATE PULSE BARS
   ========================================================= */

function createPulseBars(backend, isUp) {

    const bars = [];

    const errorCount =
        Number(
            backend.errors || 0
        );


    for (let i = 0; i < 12; i++) {

        let className = "pulse-bar";


        if (!isUp) {

            className += " error";

        } else if (
            errorCount > 0 &&
            i >= 10
        ) {

            className += " warning";
        }


        bars.push(
            `<span class="${className}"></span>`
        );
    }


    return bars.join("");
}


/* =========================================================
   UPDATE BACKEND TABLE
   ========================================================= */

function updateBackendTable(stats) {

    const table =
        document.getElementById(
            "backend-table"
        );


    if (!table) {
        return;
    }


    table.innerHTML = "";


    const backends =
        stats.backends || [];


    backends.forEach(
        backend => {

            table.appendChild(
                createBackendRow(backend)
            );
        }
    );
}


/* =========================================================
   UPDATE FOOTER
   ========================================================= */

function updateFooter(stats) {

    const backends =
        stats.backends || [];


    const healthy =
        backends.filter(
            backend =>
                backend.status === "UP"
        ).length;


    const footerStatus =
        document.getElementById(
            "footer-status"
        );


    if (!footerStatus) {
        return;
    }


    footerStatus.textContent =
        `${healthy}/${backends.length} backends healthy`;
}


/* =========================================================
   MAIN UPDATE FUNCTION
   ========================================================= */

function updateDashboard(stats) {

    lastStats = stats;


    updateKPIs(stats);

    updateVerdict(stats);

    updateGlobalStatus(stats);

    updateRoutingAlgorithm(stats);

    updateTopology(stats);

    updateBackendTable(stats);

    updateFooter(stats);

    updateTimestamp();
}


/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function showConnectionError() {

    const title =
        document.getElementById(
            "verdict-title"
        );


    const subtitle =
        document.getElementById(
            "verdict-subtitle"
        );


    const verdict =
        document.getElementById(
            "verdict"
        );


    const icon =
        document.querySelector(
            ".verdict-icon"
        );


    if (title) {

        title.textContent =
            "Load balancer unavailable";
    }


    if (subtitle) {

        subtitle.textContent =
            "Unable to retrieve statistics from 127.0.0.1:8080.";
    }


    if (verdict) {

        verdict.style.borderColor =
            "rgba(242, 85, 90, 0.22)";

        verdict.style.background =
            "linear-gradient(90deg, rgba(242, 85, 90, 0.09), rgba(242, 85, 90, 0.025))";
    }


    if (icon) {

        icon.style.background =
            "rgba(242, 85, 90, 0.12)";

        icon.style.color =
            "#F2555A";
    }


    const statusText =
        document.querySelector(
            ".global-status span"
        );


    if (statusText) {

        statusText.textContent =
            "Offline";
    }


    const statusContainer =
        document.querySelector(
            ".global-status"
        );


    if (statusContainer) {

        statusContainer.style.background =
            "rgba(242, 85, 90, 0.12)";

        statusContainer.style.color =
            "#F2555A";
    }
}


/* =========================================================
   FETCH STATS
   ========================================================= */

async function fetchStats() {

    try {

        const response =
            await fetch(
                STATS_URL,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );
        }


        const stats =
            await response.json();


        updateDashboard(stats);

    } catch (error) {

        console.error(
            "Unable to fetch load balancer stats:",
            error
        );

        showConnectionError();
    }
}


/* =========================================================
   START LIVE MONITORING
   ========================================================= */

function startMonitoring() {

    fetchStats();


    setInterval(
        fetchStats,
        2000
    );
}


/* =========================================================
   PAGE INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Load Balancer Dashboard initialized."
        );


        startMonitoring();
    }
);