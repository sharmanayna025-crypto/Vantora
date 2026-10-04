/* =========================================================
   VANTORA LOAD BALANCER DASHBOARD
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const STATS_URL =
    "http://127.0.0.1:8080/stats";


// =====================================================
// EVENT HISTORY
// =====================================================

const eventHistory = [];

const MAX_EVENTS = 20;

let previousBackendStatus = {};

let previousAlgorithm = null;


// =====================================================
// LIVE CHART DATA
// =====================================================

let trafficChart = null;

let latencyChart = null;


const chartHistory = {

    labels: [],

    traffic: {
        9001: [],
        9002: [],
        9003: []
    },

    latency: {
        9001: [],
        9002: [],
        9003: []
    }
};


let previousChartRequests = {

    9001: 0,
    9002: 0,
    9003: 0

};


let previousChartTime = null;

const MAX_CHART_POINTS = 20;


let lastStats = null;

let previousRequestCounts = {};


// =========================================================
// HELPER FUNCTIONS
// =========================================================

function formatNumber(value) {

    return Number(
        value || 0
    ).toLocaleString();
}


function formatLatency(value) {

    const latency =
        Number(value || 0);

    return `${latency.toFixed(3)}s`;
}


function getBackend(stats, port) {

    if (
        !stats ||
        !stats.backends
    ) {
        return null;
    }

    return stats.backends.find(
        backend =>
            Number(backend.port) ===
            Number(port)
    );
}


// =========================================================
// EVENT HISTORY
// =========================================================

function addEvent(
    type,
    message
) {

    const now =
        new Date();


    eventHistory.unshift({

        type: type,

        message: message,

        time:
            now.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            )
    });


    if (
        eventHistory.length >
        MAX_EVENTS
    ) {

        eventHistory.pop();
    }


    renderEvents();
}


// =========================================================
// EVENT DETECTION
// =========================================================

function detectEvents(stats) {

    if (
        !stats ||
        !stats.backends
    ) {
        return;
    }


    /*
       First dashboard update.

       Store the current state without
       generating false events.
    */

    if (
        Object.keys(
            previousBackendStatus
        ).length === 0
    ) {

        stats.backends.forEach(
            backend => {

                previousBackendStatus[
                    backend.port
                ] =
                    backend.status;

            }
        );


        previousAlgorithm =
            stats.algorithm;


        return;
    }


    /*
       ---------------------------------------------
       Backend status changes
       ---------------------------------------------
    */

    stats.backends.forEach(
        backend => {

            const port =
                backend.port;


            const currentStatus =
                backend.status;


            const oldStatus =
                previousBackendStatus[
                    port
                ];


            /*
               Backend went DOWN
            */

            if (
                oldStatus === "UP" &&
                currentStatus === "DOWN"
            ) {

                addEvent(
                    "critical",
                    `Backend-${port} went DOWN`
                );
            }


            /*
               Backend recovered
            */

            if (
                oldStatus === "DOWN" &&
                currentStatus === "UP"
            ) {

                addEvent(
                    "success",
                    `Backend-${port} recovered`
                );
            }


            previousBackendStatus[
                port
            ] =
                currentStatus;

        }
    );


    /*
       ---------------------------------------------
       Routing algorithm change
       ---------------------------------------------
    */

    if (
        previousAlgorithm !== null &&
        stats.algorithm !==
            previousAlgorithm
    ) {

        addEvent(
            "info",
            `Routing algorithm changed to ${stats.algorithm}`
        );
    }


    previousAlgorithm =
        stats.algorithm;
}


// =========================================================
// RENDER EVENTS
// =========================================================

function renderEvents() {

    const eventsList =
        document.getElementById(
            "events-list"
        );


    const eventsCount =
        document.getElementById(
            "events-count"
        );


    if (!eventsList) {
        return;
    }


    /*
       No events
    */

    if (
        eventHistory.length === 0
    ) {

        eventsList.innerHTML = `

            <div class="event-empty">

                <div class="event-empty-icon">
                    ✓
                </div>

                <div>
                    No events recorded
                </div>

            </div>

        `;


        if (eventsCount) {

            eventsCount.textContent =
                "0 events";
        }


        return;
    }


    /*
       Render event history
    */

    eventsList.innerHTML =
        eventHistory.map(
            event => {

                return `

                    <div class="event-item">

                        <div
                            class="event-icon ${event.type}"
                        >
                            <span></span>
                        </div>


                        <div class="event-content">

                            <div class="event-message">
                                ${event.message}
                            </div>


                            <div class="event-time">
                                ${event.time}
                            </div>

                        </div>

                    </div>

                `;

            }
        ).join("");


    /*
       Event counter
    */

    if (eventsCount) {

        eventsCount.textContent =
            `${eventHistory.length} ${
                eventHistory.length === 1
                    ? "event"
                    : "events"
            }`;
    }
}


// =========================================================
// KPI SECTION
// =========================================================

function updateKPIs(stats) {

    const backends =
        stats.backends || [];


    let totalRequests = 0;

    let totalActive = 0;

    let totalErrors = 0;

    let healthyBackends = 0;

    let totalResponseTime = 0;


    backends.forEach(
        backend => {

            const requests =
                Number(
                    backend.total_requests || 0
                );


            const active =
                Number(
                    backend.active_connections || 0
                );


            const errors =
                Number(
                    backend.errors || 0
                );


            const responseTime =
                Number(
                    backend.avg_response_time || 0
                );


            totalRequests +=
                requests;


            totalActive +=
                active;


            totalErrors +=
                errors;


            if (
                backend.status === "UP"
            ) {

                healthyBackends++;
            }


            totalResponseTime +=
                responseTime * requests;

        }
    );


    let averageLatency = 0;


    if (
        totalRequests > 0
    ) {

        averageLatency =
            totalResponseTime /
            totalRequests;
    }


    const totalBackends =
        backends.length;


    const requestsElement =
        document.getElementById(
            "total-requests"
        );


    if (requestsElement) {

        requestsElement.textContent =
            formatNumber(
                totalRequests
            );
    }


    const activeElement =
        document.getElementById(
            "active-connections"
        );


    if (activeElement) {

        activeElement.textContent =
            formatNumber(
                totalActive
            );
    }


    const errorsElement =
        document.getElementById(
            "total-errors"
        );


    if (errorsElement) {

        errorsElement.textContent =
            formatNumber(
                totalErrors
            );
    }


    const latencyElement =
        document.getElementById(
            "avg-latency"
        );


    if (latencyElement) {

        latencyElement.textContent =
            formatLatency(
                averageLatency
            );
    }


    const healthyElement =
        document.getElementById(
            "healthy-count"
        );


    if (healthyElement) {

        healthyElement.textContent =
            `${healthyBackends}/${totalBackends}`;
    }
}


// =========================================================
// SYSTEM VERDICT
// =========================================================

function updateVerdict(stats) {

    const verdict =
        document.getElementById(
            "verdict"
        );


    const title =
        document.getElementById(
            "verdict-title"
        );


    const subtitle =
        document.getElementById(
            "verdict-subtitle"
        );


    if (
        !verdict ||
        !title ||
        !subtitle
    ) {

        return;
    }


    const backends =
        stats.backends || [];


    const healthy =
        backends.filter(
            backend =>
                backend.status === "UP"
        ).length;


    const total =
        backends.length;


    if (
        total === 0
    ) {

        title.textContent =
            "No backend data";


        subtitle.textContent =
            "Waiting for load balancer statistics";


        verdict.classList.remove(
            "healthy",
            "warning",
            "critical"
        );


        verdict.classList.add(
            "critical"
        );


        return;
    }


    if (
        healthy === total
    ) {

        title.textContent =
            "All systems operational";


        subtitle.textContent =
            `${healthy} of ${total} backends healthy`;


        verdict.classList.remove(
            "warning",
            "critical"
        );


        verdict.classList.add(
            "healthy"
        );


        return;
    }


    if (
        healthy > 0
    ) {

        title.textContent =
            "Degraded service";


        subtitle.textContent =
            `${healthy} of ${total} backends healthy`;


        verdict.classList.remove(
            "healthy",
            "critical"
        );


        verdict.classList.add(
            "warning"
        );


        return;
    }


    title.textContent =
        "No healthy backends";


    subtitle.textContent =
        "All backend servers are unavailable";


    verdict.classList.remove(
        "healthy",
        "warning"
    );


    verdict.classList.add(
        "critical"
    );
}


// =========================================================
// GLOBAL LIVE STATUS
// =========================================================

function updateGlobalStatus(stats) {

    const statusContainer =
        document.querySelector(
            ".global-status"
        ) ||
        document.querySelector(
            ".live-status"
        );


    if (!statusContainer) {

        return;
    }


    const statusText =
        statusContainer.querySelector(
            "span:last-child"
        );


    const statusDot =
        statusContainer.querySelector(
            ".status-dot"
        ) ||
        statusContainer.querySelector(
            ".live-dot"
        );


    const backends =
        stats.backends || [];


    const healthy =
        backends.filter(
            backend =>
                backend.status === "UP"
        ).length;


    const total =
        backends.length;


    if (
        total === 0
    ) {

        if (statusText) {

            statusText.textContent =
                "OFFLINE";
        }


        return;
    }


    if (
        healthy === total
    ) {

        if (statusText) {

            statusText.textContent =
                "LIVE";
        }


        if (statusDot) {

            statusDot.classList.remove(
                "warning",
                "critical"
            );


            statusDot.classList.add(
                "healthy"
            );
        }


        return;
    }


    if (
        healthy > 0
    ) {

        if (statusText) {

            statusText.textContent =
                "DEGRADED";
        }


        if (statusDot) {

            statusDot.classList.remove(
                "healthy",
                "critical"
            );


            statusDot.classList.add(
                "warning"
            );
        }


        return;
    }


    if (statusText) {

        statusText.textContent =
            "OFFLINE";
    }


    if (statusDot) {

        statusDot.classList.remove(
            "healthy",
            "warning"
        );


        statusDot.classList.add(
            "critical"
        );
    }
}


// =========================================================
// ROUTING ALGORITHM
// =========================================================

function updateRoutingAlgorithm(stats) {

    const algorithm =
        stats.algorithm ||
        "Unknown";


    const routingAlgorithm =
        document.getElementById(
            "routing-algorithm"
        );


    if (routingAlgorithm) {

        routingAlgorithm.textContent =
            algorithm;
    }


    const topologyAlgorithm =
        document.getElementById(
            "topology-algorithm"
        );


    if (topologyAlgorithm) {

        topologyAlgorithm.textContent =
            algorithm;
    }


    const topAlgorithm =
        document.getElementById(
            "algorithm"
        );


    if (topAlgorithm) {

        topAlgorithm.textContent =
            algorithm;
    }
}


// =========================================================
// TIMESTAMP
// =========================================================

function updateTimestamp() {

    const timestamp =
        document.getElementById(
            "last-updated"
        );


    if (!timestamp) {

        return;
    }


    const now =
        new Date();


    timestamp.textContent =
        now.toLocaleTimeString(
            [],
            {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit"
            }
        );
}


// =========================================================
// TOPOLOGY NODE
// =========================================================

function updateTopologyNode(
    stats,
    port
) {

    const backend =
        getBackend(
            stats,
            port
        );


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


    const statusText =
        node.querySelector(
            ".status-text"
        );


    const statusDot =
        node.querySelector(
            ".status-dot"
        );


    const requests =
        Number(
            backend.total_requests || 0
        );


    const active =
        Number(
            backend.active_connections || 0
        );


    const isHealthy =
        backend.status === "UP";


    if (statusText) {

        statusText.textContent =
            isHealthy
                ? "UP"
                : "DOWN";
    }


    if (statusDot) {

        statusDot.classList.remove(
            "healthy",
            "warning",
            "critical",
            "up",
            "down"
        );


        if (isHealthy) {

            statusDot.classList.add(
                "healthy"
            );

        } else {

            statusDot.classList.add(
                "critical"
            );
        }
    }


    node.classList.remove(
        "healthy",
        "warning",
        "critical",
        "up",
        "down"
    );


    if (isHealthy) {

        node.classList.add(
            "healthy"
        );

    } else {

        node.classList.add(
            "critical"
        );
    }


    const requestElement =
        document.getElementById(
            `node-requests-${port}`
        );


    if (requestElement) {

        requestElement.textContent =
            formatNumber(
                requests
            );
    }


    const activeElement =
        document.getElementById(
            `node-active-${port}`
        );


    if (activeElement) {

        activeElement.textContent =
            formatNumber(
                active
            );
    }
}


// =========================================================
// TOPOLOGY
// =========================================================

function updateTopology(stats) {

    const backends =
        stats.backends || [];


    updateTopologyNode(
        stats,
        9001
    );


    updateTopologyNode(
        stats,
        9002
    );


    updateTopologyNode(
        stats,
        9003
    );


    const totalRequests =
        backends.reduce(
            (
                sum,
                backend
            ) =>
                sum +
                Number(
                    backend.total_requests || 0
                ),
            0
        );


    const ingress =
        document.getElementById(
            "ingress-value"
        );


    if (ingress) {

        ingress.textContent =
            formatNumber(
                totalRequests
            );
    }


    backends.forEach(
        backend => {

            const port =
                Number(
                    backend.port
                );


            const routingElement =
                document.getElementById(
                    `routing-${port}`
                );


            if (routingElement) {

                routingElement.textContent =
                    formatNumber(
                        Number(
                            backend.total_requests || 0
                        )
                    );
            }

        }
    );
}


// =========================================================
// LIVE TRAFFIC ANIMATION
// =========================================================

function updateTrafficAnimation(stats) {

    const backends =
        stats.backends || [];


    const flowLines =
        document.querySelectorAll(
            ".backend-flow .flow-line"
        );


    if (
        flowLines.length === 0
    ) {

        return;
    }


    backends.forEach(
        (
            backend,
            index
        ) => {

            const port =
                Number(
                    backend.port
                );


            const currentRequests =
                Number(
                    backend.total_requests || 0
                );


            const previousRequests =
                Number(
                    previousRequestCounts[
                        port
                    ] || 0
                );


            if (
                currentRequests >
                    previousRequests &&
                flowLines[index]
            ) {

                const line =
                    flowLines[index];


                line.classList.remove(
                    "traffic-active"
                );


                void line.offsetWidth;


                line.classList.add(
                    "traffic-active"
                );


                setTimeout(
                    () => {

                        line.classList.remove(
                            "traffic-active"
                        );

                    },
                    1000
                );
            }


            previousRequestCounts[
                port
            ] =
                currentRequests;

        }
    );
}


// =========================================================
// PULSE BARS
// =========================================================

function createPulseBars(
    backend,
    isUp
) {

    const heights = [

        7,
        11,
        15,
        9,
        13,
        8,
        16,
        10,
        14,
        7,
        12,
        15

    ];


    let html = "";


    for (
        let i = 0;
        i < heights.length;
        i++
    ) {

        let barColor =
            "#6C7CFF";


        /*
           Backend DOWN
        */

        if (!isUp) {

            barColor =
                "#F2555A";
        }


        /*
           Backend has errors
        */

        else if (
            Number(
                backend.errors || 0
            ) > 0 &&
            i >=
                heights.length - 2
        ) {

            barColor =
                "#F5B544";
        }


        html += `

            <span
                class="pulse-bar"
                style="
                    display: block;
                    width: 5px;
                    min-width: 5px;
                    height: ${heights[i]}px;
                    min-height: ${heights[i]}px;
                    flex: 0 0 5px;
                    background-color: ${barColor};
                    border-radius: 2px;
                    opacity: 1;
                "
            ></span>

        `;
    }


    return html;
}


// =========================================================
// BACKEND TABLE ROW
// =========================================================

function createBackendRow(
    backend,
    totalRequests
) {

    const row =
        document.createElement(
            "tr"
        );


    const backendPort =
        Number(
            backend.port
        );


    const backendRequests =
        Number(
            backend.total_requests || 0
        );


    const activeConnections =
        Number(
            backend.active_connections || 0
        );


    const errors =
        Number(
            backend.errors || 0
        );


    const avgResponseTime =
        Number(
            backend.avg_response_time || 0
        );


    const isUp =
        backend.status === "UP";


    let trafficShare = 0;


    if (
        totalRequests > 0
    ) {

        trafficShare =
            (
                backendRequests /
                totalRequests
            ) * 100;
    }


    /*
       BACKEND
    */

    const backendCell =
        document.createElement(
            "td"
        );


    backendCell.innerHTML = `

        <div class="backend-info">

            <strong>
                Backend-${backendPort}
            </strong>

            <span>
                127.0.0.1:${backendPort}
            </span>

        </div>

    `;


    /*
       STATUS
    */

    const statusCell =
        document.createElement(
            "td"
        );


    statusCell.innerHTML = `

        <div class="table-status ${
            isUp
                ? "up"
                : "down"
        }">

            <span class="status-dot"></span>

            <span>
                ${
                    isUp
                        ? "UP"
                        : "DOWN"
                }
            </span>

        </div>

    `;


    /*
       PORT
    */

    const portCell =
        document.createElement(
            "td"
        );


    portCell.innerHTML = `

        <span class="mono">
            :${backendPort}
        </span>

    `;


    /*
       REQUESTS
    */

    const requestsCell =
        document.createElement(
            "td"
        );


    requestsCell.textContent =
        formatNumber(
            backendRequests
        );


    /*
       ACTIVE
    */

    const activeCell =
        document.createElement(
            "td"
        );


    activeCell.textContent =
        formatNumber(
            activeConnections
        );


    /*
       ERRORS
    */

    const errorsCell =
        document.createElement(
            "td"
        );


    errorsCell.textContent =
        formatNumber(
            errors
        );


    /*
       AVERAGE RESPONSE
    */

    const responseCell =
        document.createElement(
            "td"
        );


    responseCell.textContent =
        formatLatency(
            avgResponseTime
        );


    /*
       TRAFFIC
    */

    const trafficCell =
        document.createElement(
            "td"
        );


    trafficCell.innerHTML = `

        <div class="traffic-cell">

            <div class="traffic-value">
                ${trafficShare.toFixed(1)}%
            </div>


            <div class="pulse-strip">

                ${createPulseBars(
                    backend,
                    isUp
                )}

            </div>

        </div>

    `;


    /*
       ADD CELLS
    */

    row.appendChild(
        backendCell
    );


    row.appendChild(
        statusCell
    );


    row.appendChild(
        portCell
    );


    row.appendChild(
        requestsCell
    );


    row.appendChild(
        activeCell
    );


    row.appendChild(
        errorsCell
    );


    row.appendChild(
        responseCell
    );


    row.appendChild(
        trafficCell
    );


    return row;
}


// =========================================================
// BACKEND TABLE
// =========================================================

function updateBackendTable(stats) {

    const table =
        document.getElementById(
            "backend-table"
        );


    const backendCount =
        document.getElementById(
            "backend-count"
        );


    const backends =
        stats.backends || [];


    if (backendCount) {

        const count =
            backends.length;


        backendCount.textContent =
            `${count} ${
                count === 1
                    ? "server"
                    : "servers"
            }`;
    }


    if (!table) {

        return;
    }


    table.innerHTML = "";


    const totalRequests =
        backends.reduce(
            (
                sum,
                backend
            ) =>
                sum +
                Number(
                    backend.total_requests || 0
                ),
            0
        );


    backends.forEach(
        backend => {

            table.appendChild(
                createBackendRow(
                    backend,
                    totalRequests
                )
            );

        }
    );
}


// =========================================================
// FOOTER
// =========================================================

function updateFooter(stats) {

    const footerStatus =
        document.getElementById(
            "poll-status"
        );


    if (!footerStatus) {

        return;
    }


    footerStatus.textContent =
        "Polling";
}


// =========================================================
// UPDATE COMPLETE DASHBOARD
// =========================================================

function updateDashboard(stats) {

    lastStats =
        stats;


    /*
       Detect events before updating
       the rest of the dashboard.
    */

    detectEvents(
        stats
    );


    updateCharts(
        stats.backends
    );


    updateKPIs(
        stats
    );


    updateVerdict(
        stats
    );


    updateGlobalStatus(
        stats
    );


    updateRoutingAlgorithm(
        stats
    );


    updateTopology(
        stats
    );


    updateTrafficAnimation(
        stats
    );


    updateBackendTable(
        stats
    );


    updateFooter(
        stats
    );


    updateTimestamp();
}


// =========================================================
// CONNECTION ERROR
// =========================================================

function showConnectionError() {

    const verdict =
        document.getElementById(
            "verdict"
        );


    const title =
        document.getElementById(
            "verdict-title"
        );


    const subtitle =
        document.getElementById(
            "verdict-subtitle"
        );


    if (title) {

        title.textContent =
            "Load balancer unavailable";
    }


    if (subtitle) {

        subtitle.textContent =
            "Unable to retrieve statistics";
    }


    if (verdict) {

        verdict.classList.remove(
            "healthy",
            "warning"
        );


        verdict.classList.add(
            "critical"
        );
    }


    const footerStatus =
        document.getElementById(
            "poll-status"
        );


    if (footerStatus) {

        footerStatus.textContent =
            "Connection error";
    }


    const liveStatus =
        document.querySelector(
            ".live-status"
        ) ||
        document.querySelector(
            ".global-status"
        );


    if (liveStatus) {

        const liveText =
            liveStatus.querySelector(
                "span:last-child"
            );


        if (liveText) {

            liveText.textContent =
                "OFFLINE";
        }
    }
}


// =========================================================
// FETCH STATISTICS
// =========================================================

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


        updateDashboard(
            stats
        );

    } catch (error) {

        console.error(
            "Failed to fetch load balancer stats:",
            error
        );


        showConnectionError();
    }
}


// =========================================================
// MONITORING LOOP
// =========================================================

function startMonitoring() {

    fetchStats();


    setInterval(
        fetchStats,
        2000
    );
}


// =========================================================
// CHART INITIALIZATION
// =========================================================

function initializeCharts() {

    const trafficCanvas =
        document.getElementById(
            "trafficChart"
        );


    const latencyCanvas =
        document.getElementById(
            "latencyChart"
        );


    if (
        !trafficCanvas ||
        !latencyCanvas
    ) {

        console.warn(
            "Chart canvas elements not found."
        );


        return;
    }


    /*
       -----------------------------------------------
       Traffic Chart
       -----------------------------------------------
    */

    trafficChart =
        new Chart(
            trafficCanvas,
            {

                type: "line",


                data: {

                    labels: [],


                    datasets: [

                        {
                            label:
                                "Backend 9001",

                            data: [],

                            borderColor:
                                "#6C7CFF",

                            backgroundColor:
                                "rgba(108, 124, 255, 0.08)",

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false,

                            pointRadius: 2,

                            pointHoverRadius: 4
                        },


                        {
                            label:
                                "Backend 9002",

                            data: [],

                            borderColor:
                                "#4CC9E0",

                            backgroundColor:
                                "rgba(76, 201, 224, 0.08)",

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false,

                            pointRadius: 2,

                            pointHoverRadius: 4
                        },


                        {
                            label:
                                "Backend 9003",

                            data: [],

                            borderColor:
                                "#B58CFF",

                            backgroundColor:
                                "rgba(181, 140, 255, 0.08)",

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false,

                            pointRadius: 2,

                            pointHoverRadius: 4
                        }

                    ]
                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    animation: false,


                    interaction: {

                        intersect: false,

                        mode: "index"
                    },


                    plugins: {

                        legend: {

                            position: "bottom",


                            labels: {

                                color:
                                    "#9AA6BC",

                                usePointStyle:
                                    true,

                                pointStyle:
                                    "circle",

                                padding: 20
                            }
                        }
                    },


                    scales: {

                        x: {

                            ticks: {

                                color:
                                    "#66738C",

                                maxTicksLimit: 8
                            },


                            grid: {

                                color:
                                    "rgba(35, 44, 61, 0.6)"
                            }
                        },


                        y: {

                            beginAtZero:
                                true,


                            ticks: {

                                color:
                                    "#66738C"
                            },


                            grid: {

                                color:
                                    "rgba(35, 44, 61, 0.6)"
                            }
                        }
                    }
                }
            }
        );


    /*
       -----------------------------------------------
       Latency Chart
       -----------------------------------------------
    */

    latencyChart =
        new Chart(
            latencyCanvas,
            {

                type: "line",


                data: {

                    labels: [],


                    datasets: [

                        {
                            label:
                                "Backend 9001",

                            data: [],

                            borderColor:
                                "#6C7CFF",

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false,

                            pointRadius: 2,

                            pointHoverRadius: 4
                        },


                        {
                            label:
                                "Backend 9002",

                            data: [],

                            borderColor:
                                "#4CC9E0",

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false,

                            pointRadius: 2,

                            pointHoverRadius: 4
                        },


                        {
                            label:
                                "Backend 9003",

                            data: [],

                            borderColor:
                                "#B58CFF",

                            borderWidth: 2,

                            tension: 0.35,

                            fill: false,

                            pointRadius: 2,

                            pointHoverRadius: 4
                        }

                    ]
                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    animation: false,


                    interaction: {

                        intersect: false,

                        mode: "index"
                    },


                    plugins: {

                        legend: {

                            position: "bottom",


                            labels: {

                                color:
                                    "#9AA6BC",

                                usePointStyle:
                                    true,

                                pointStyle:
                                    "circle",

                                padding: 20
                            }
                        }
                    },


                    scales: {

                        x: {

                            ticks: {

                                color:
                                    "#66738C",

                                maxTicksLimit: 8
                            },


                            grid: {

                                color:
                                    "rgba(35, 44, 61, 0.6)"
                            }
                        },


                        y: {

                            beginAtZero:
                                true,


                            ticks: {

                                color:
                                    "#66738C"
                            },


                            grid: {

                                color:
                                    "rgba(35, 44, 61, 0.6)"
                            }
                        }
                    }
                }
            }
        );
}


// =========================================================
// UPDATE CHART DATA
// =========================================================

function updateCharts(backends) {

    if (
        !trafficChart ||
        !latencyChart
    ) {

        return;
    }


    const now =
        new Date();


    const currentTime =
        now.getTime();


    const timeLabel =
        now.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );


    let elapsedSeconds = 2;


    if (
        previousChartTime !== null
    ) {

        elapsedSeconds =
            (
                currentTime -
                previousChartTime
            ) / 1000;


        if (
            elapsedSeconds <= 0
        ) {

            elapsedSeconds = 2;
        }
    }


    previousChartTime =
        currentTime;


    chartHistory.labels.push(
        timeLabel
    );


    backends.forEach(
        backend => {

            const port =
                backend.port;


            if (
                !chartHistory.traffic[
                    port
                ]
            ) {

                chartHistory.traffic[
                    port
                ] = [];
            }


            if (
                !chartHistory.latency[
                    port
                ]
            ) {

                chartHistory.latency[
                    port
                ] = [];
            }


            const currentRequests =
                Number(
                    backend.total_requests || 0
                );


            const previousRequests =
                Number(
                    previousChartRequests[
                        port
                    ] || 0
                );


            const requestDifference =
                Math.max(
                    0,
                    currentRequests -
                    previousRequests
                );


            const requestsPerSecond =
                requestDifference /
                elapsedSeconds;


            chartHistory.traffic[
                port
            ].push(
                Number(
                    requestsPerSecond.toFixed(2)
                )
            );


            chartHistory.latency[
                port
            ].push(
                Number(
                    backend.avg_response_time ||
                    0
                )
            );


            previousChartRequests[
                port
            ] =
                currentRequests;

        }
    );


    if (
        chartHistory.labels.length >
        MAX_CHART_POINTS
    ) {

        chartHistory.labels.shift();


        [
            9001,
            9002,
            9003
        ].forEach(
            port => {

                chartHistory.traffic[
                    port
                ].shift();


                chartHistory.latency[
                    port
                ].shift();

            }
        );
    }


    trafficChart.data.labels =
        chartHistory.labels;


    trafficChart.data.datasets[
        0
    ].data =
        chartHistory.traffic[
            9001
        ];


    trafficChart.data.datasets[
        1
    ].data =
        chartHistory.traffic[
            9002
        ];


    trafficChart.data.datasets[
        2
    ].data =
        chartHistory.traffic[
            9003
        ];


    latencyChart.data.labels =
        chartHistory.labels;


    latencyChart.data.datasets[
        0
    ].data =
        chartHistory.latency[
            9001
        ];


    latencyChart.data.datasets[
        1
    ].data =
        chartHistory.latency[
            9002
        ];


    latencyChart.data.datasets[
        2
    ].data =
        chartHistory.latency[
            9003
        ];


    trafficChart.update(
        "none"
    );


    latencyChart.update(
        "none"
    );
}


// =========================================================
// PAGE INITIALIZATION
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Vantora dashboard initialized"
        );


        console.log(
            `Stats endpoint: ${STATS_URL}`
        );


        /*
           Initialize Chart.js first.
        */

        initializeCharts();


        /*
           Start load balancer monitoring.
        */

        startMonitoring();

    }
);