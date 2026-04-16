# GIG-I: Parametric Insurance for the Gig Economy
**AI-Powered Income Protection with Adversarial Fraud Defense**

---

## 1. Problem Statement
India’s gig delivery workforce operates on a **per-task income model**, making them highly vulnerable to external disruptions such as heavy rainfall, flooding, extreme heat, and urban shutdowns. 

**The Impact of Disruptions:**
*   **Reduced Hours:** Working hours typically drop by 20–30% during events.
*   **Instant Loss:** Immediate hit to daily and weekly earnings with no safety net.
*   **Systemic Gap:** Traditional insurance is too slow, claim-heavy, and not designed for short-term income protection.

## 2. Solution Overview
GigShield AI is a **Zero-Touch Parametric Insurance Platform** that:
*   **Detects:** Monitors real-world disruptions via high-fidelity APIs.
*   **Predicts:** Uses AI to estimate specific income loss per worker.
*   **Triggers:** Automatically initiates payouts without manual filing.
*   **Defends:** Prevents pool depletion via multi-layer adversarial fraud defense.

## 3. Core Architectural Principles
> *“We minimize **basis risk** by aligning parametric triggers with real, observable income disruption events and minimize **fraud risk** through multi-signal validation instead of single-point verification.”*

## 4. Parametric Triggers: Region-Specific Calibration
We use only high-confidence, income-correlated triggers aligned with **IMD (India Meteorological Department)** standards:

| Disruption Type | Trigger Condition | Justification |
| :--- | :--- | :--- |
| **Heavy Rain** | > 60 mm/hour OR IMD Heavy Rain Alert | Direct drop in delivery volume/safety. |
| **Flooding** | Road closure / Waterlogging signals | Physical blockage of delivery routes. |
| **Extreme Heat** | > 42°C + IMD Heatwave Advisory | Significant drop in worker activity/health risk. |
| **Urban Shutdown** | Curfew / Official Zone Closure | Access to commercial hubs blocked. |

### Environmental Data Scope Management (AQI)
*   **AQI is NOT a payout trigger.** High pollution is persistent and would cause basis risk/pool drain.
*   **Usage:** Only used as a **Risk Scoring feature** and **Premium adjustment signal**. This reduces false payouts and ensures long-term sustainability.

## 5. Weekly Premium Pricing Model
Aligned with the gig worker’s payout cycle:
`Weekly Premium = (Base Rate * Risk Score) + (Coverage Factor * Coverage Amount)`

**AI Adjustments:**
*   **Location Risk:** Historical disruption frequency in specific clusters.
*   **Weather Patterns:** 7-day predictive forecasting.
*   **Worker Activity:** Historical consistency and delivery patterns.

## 6. End-to-End Workflow
1.  **Onboarding** → 2. **AI Risk Profiling** → 3. **Weekly Policy Creation** → 4. **Real-Time Monitoring** → 5. **Parametric Trigger Activation** → 6. **Multi-Layer Fraud Validation** → 7. **Instant Payout**

## 7. AI System Design
### 7.1 Risk Prediction Model
*   **Model:** XGBoost
*   **Output:** Risk Score (0–1) based on location, seasonality, and vehicle type.
### 7.2 Income Loss Estimation
*   **Model:** Gradient Boosting Regression
*   **Output:** Precise ₹ loss estimate during the disruption window.

## 8. Adversarial Defense & Anti-Spoofing Strategy
### The Problem Scenario
*“500 fake GPS claims attempt to drain the payout pool during a legitimate rain event.”* Simple GPS validation is insufficient against sophisticated attackers.

### 9. Multi-Layer Fraud Defense Architecture
| Layer | Signal | What It Detects |
| :--- | :--- | :--- |
| **Event Validation** | Weather/Traffic APIs | Fake/Simulated disruption events. |
| **Location Validation** | GPS Trajectory | "Teleportation" or perfectly linear movement. |
| **Device Integrity** | OS/Root Detection | Use of Magisk, Emulators, or Spoofing tools. |
| **Behavioral Model** | Activity Patterns | "Ghost workers" active only during claims. |
| **Network Analysis** | IP/Device Graph | Coordinated fraud rings and sybil attacks. |

## 10. Signal Redundancy & Validation Logic
**No single signal can reject a claim.** Our system follows **Multi-Signal Independent Validation** to prevent penalizing genuine workers with poor GPS signals.

## 11. Fraud Risk Scoring System (FRS)
We compute a multi-dimensional normalized score (0–1):
`FRS = w1(Event) + w2(Location) + w3(Device) + w4(Behavior) + w5(Network)`

## 12. Decision Policy (Research-Calibrated)
*   **FRS < 0.25:** **Auto-Approve** (Instant Payout).
*   **0.25 ≤ FRS < 0.55:** **Approve** + Silent Monitoring.
*   **0.55 ≤ FRS < 0.75:** **Delayed Payout** + Secondary Validation.
*   **FRS ≥ 0.75:** **HOLD** (Pending manual audit, NOT instant rejection).

## 13. Hard Rejection Rule
A claim is rejected **ONLY IF**:
1.  **FRS > 0.85**
2.  **AND** At least **2 independent signals** are strongly anomalous (e.g., Fake GPS + Rooted Device).

## 14. Coordinated Attack Mitigation (Graph Analytics)
We use **Graph-Based Analysis** to identify coordinated attacks:
*   **Nodes:** Workers, Devices, IP Addresses, UPI Accounts.
*   **Fraud Ring Signal:** Multiple workers + Same IP/Device + Synchronized Claims + Same Zone = **Cluster Flagged**.

## 15. Zero-Trust Validation Pipeline
```mermaid
flowchart TD
    A[Worker Claim Trigger] --> B{Step 1: Event Check}
    B -->|Verified| C{Step 2: Presence Check}
    C -->|Verified| D{Step 3: Device Check}
    D -->|Verified| E{Step 4: Behavior Check}
    E -->|Verified| F{Step 5: Network Check}
    
    F --> G[Fraud Risk Scoring Engine]
    G --> H{Risk Score}
    
    H -->|FRS < 0.25| I[Auto-Approve Claim]
    H -->|0.25 - 0.75| J[Delay & Manual Review]
    H -->|FRS > 0.75| K[Block & Flag Account]
    
    K --> L[Fraud Cluster Detection]
    L --> M[Admin Alert System]
```

## 16. False Positive Protection (Fairness First)
*   **GPS Drift Tolerance:** ±100m allowed for urban "canyon" interference.
*   **Review > Reject:** We prioritize investigation over immediate denial.
*   **Transparency:** Workers are notified of delays, not just silent blocks.

## 17. Attack Response Strategy
*   **Zone Payout Cap:** Automated ceiling if claim volume exceeds predicted density by >200%.
*   **Cluster Isolation:** Instantly disconnects all accounts sharing high-risk graph edges.
*   **Manual Override:** Global switch to shift affected zones to manual verification.

## 18. Cybersecurity & Data Integrity Architecture
To ensure the **integrity** and **security** of the platform, GigShield AI implements robust cybersecurity components:
*   **Data Integrity (Hashing):** All sensor data and GPS logs are hashed using **SHA-256** before being stored, preventing any post-event tampering of location history.
*   **Secure Communication (TLS 1.3):** All API interactions between the mobile client and backend services are encrypted via **TLS 1.3**, protecting against Man-in-the-Middle (MITM) attacks.
*   **Identity & Access Management (IAM):** We use **JWT (JSON Web Tokens)** with short-lived access and refresh tokens for worker authentication. Administrative actions require **MFA (Multi-Factor Authentication)**.
*   **Audit Logging:** An immutable audit trail is maintained for every claim trigger, manual review decision, and payout authorization, ensuring full accountability.
*   **End-to-End Encryption (E2EE):** Worker PII (Personally Identifiable Information) and UPI details are encrypted at rest using **AES-256-GCM**.
*   **Rate Limiting & DDoS Protection:** Advanced rate limiting at the API Gateway prevents brute-force attacks on the payout trigger engine.

## 19. Architecture Overview

### High-Level System Architecture
```mermaid
graph TD
    subgraph Edge
        IoT[IoT / Mobile App]
        Ext[3rd Party APIs]
    end
    
    subgraph Cloud Infrastructure
        API[FastAPI Backend]
        DB[(Ledger DB)]
        
        subgraph Multi-Pass Fraud Engine
            T1[Tier 1: Deterministic]
            T2[Tier 2: Velocity]
            T3[Tier 3: LLM Reasoning]
        end
    end
    
    subgraph Blockchain
        SC[Smart Contract]
    end
    
    subgraph Web
        Dash[Worker Wallet UI]
        Admin[Admin Dashboard]
    end

    IoT -->|Trigger Event| API
    Ext -->|Context Data| API
    API <--> T1
    API <--> T2
    API <--> T3
    API <--> DB
    API -->|Mint Token| SC
    Dash <--> DB
    Admin <--> DB
    Dash -.-> SC
```

GIG-I’s system architecture follows a modern event-driven design. Edge IoT devices (or mobile apps) continuously report local conditions to the cloud, alongside data from third-party APIs (weather, traffic, curfew alerts). Incoming events are funneled into our FastAPI backend running on cloud infrastructure (configurable to AWS, GCP, or Azure). Geofencing logic ensures we only process events relevant to the driver’s zone (e.g. Zone A).

Within the backend, each incoming event triggers our Multi-Pass Fraud Engine. This is implemented as an asynchronous pipeline: Tier-1 deterministic checks and Tier-2 historical checks run in parallel with Tier-3 AI validation. FastAPI’s async features (async/await) let our `/simulate-event` endpoint handle high throughput with minimal latency. Once all checks pass, the engine calls a blockchain smart contract to mint a payout token into the driver’s on-chain wallet. Token minting and ledger updates are immediately logged. The driver-facing dashboard reads their wallet balance and transaction history from our database (or directly from the blockchain), providing real-time UI updates. An admin interface overlays logs and metrics for monitoring.

### Data Flows and Pipelines
GIG-I’s 3-tier validation pipeline:

```mermaid
flowchart TD
  A[Event Received at /simulate-event] --> B[Tier-1: Deterministic Checks]
  B --> C[Tier-2: Velocity Checks]
  C --> D[Tier-3: LLM Reasoning]
  D --> E{Fraud Risk Scores OK?}
  E -->|Yes| F[Mint Token on Blockchain]
  E -->|No| G[Reject Claim]
  F --> H[Log Payout & Update Wallet]
  G --> I[Log Rejection]
```

### End-to-End Sequence Diagram
```mermaid
sequenceDiagram
    participant IoT as IoT/Device
    participant API as Third-Party API
    participant Backend as Backend
    participant T1 as Tier-1 Engine
    participant T2 as Tier-2 Engine
    participant LLM as LLM Agent
    participant Chain as Blockchain
    participant UI as Frontend/UI

    IoT->>Backend: POST /simulate-event (payload)
    API-->>Backend: Push event data (e.g. weather)
    
    Backend->>T1: Perform deterministic check
    T1-->>Backend: pass/fail
    
    alt pass
        Backend->>T2: Perform velocity check
        T2-->>Backend: pass/fail
        
        alt pass
            Backend->>LLM: Ask for contextual validation
            LLM-->>Backend: pass/fail
            
            alt pass
                Backend->>Chain: mintToken(driverId, amount)
                Chain-->>Backend: txReceipt
                Backend-->>IoT: {"status": "approved", "tokenId":1234}
            else fail
                Backend-->>IoT: {"status": "rejected"}
            end
        else fail
            Backend-->>IoT: {"status": "rejected"}
        end
    else fail
        Backend-->>IoT: {"status": "rejected"}
    end
```

### Component Descriptions
*   **FastAPI Backend (`/simulate-event`):** We use FastAPI – a modern, high-performance Python web framework – to receive and validate events. All API endpoints use Python type hints and Pydantic models for data validation.
*   **Multi-Pass Fraud Engine:** This core logic is invoked by the backend for each event.
    *   **Tier-1: Deterministic Checks.** Fast, rule-based logic verifies basic conditions.
    *   **Tier-2: Velocity Checks.** Analyzes the driver’s recent claim history to prevent rapid-fire exploits.
    *   **Tier-3: LLM Reasoning Agent.** The final arbiter is a Large Language Model-based analysis. We formulate a structured prompt incorporating event details and external context. We apply strict safety measures and red-teaming to avoid hallucinations.
*   **Smart Contract & Token Minting:** We represent payouts as tokens on a configurable blockchain (e.g. ERC-20/721 on Ethereum/Polygon). Following best practices, the contract’s mint authority is tightly controlled (e.g. by multisig).
*   **Data Storage & Ledger:** We maintain an immutable log of all events and payouts. 
*   **Dashboards/UI:** The gig worker and admins use web dashboards to view status.

### API Contracts
We provide RESTful endpoints with JSON schemas.

**POST `/simulate-event`** – Trigger an event.
```json
{
  "driverId": 42,
  "eventType": "HeavyRain",
  "timestamp": "2026-04-04T18:30:00Z",
  "location": {"lat": 19.0760, "lon": 72.8777},
  "zone": "A"
}
```

**Response JSON Example (approved claim):**
```json
{
  "status": "approved",
  "fraudRiskScore": 0.07,
  "tokenId": 1234,
  "message": "Payout minted successfully"
}
```

**GET `/wallet/{driverId}`** – Get driver’s wallet balance and recent transactions.
```json
{
  "driverId": 42,
  "balanceTokens": 1500,
  "transactions": [
    {"tokenId": 1231, "type":"payout", "event":"LocalCurfew", "amount":300, "timestamp":"2026-04-04T08:15Z"},
    {"tokenId": 1234, "type":"payout", "event":"HeavyRain", "amount":200, "timestamp":"2026-04-04T18:31Z"}
  ]
}
```

**GET `/ledger`** – Fetch the full immutable claims ledger (admin only).
```json
{
  "entries": [
    {"event":"Flood", "driverId":42, "time":"2026-04-04T18:31Z", "tokenId":1234, "FRS":0.07},
    {"event":"Curfew", "driverId":42, "time":"2026-04-04T08:15Z", "tokenId":1231, "FRS":0.03}
  ]
}
```

### Deployment & Infrastructure
The system is cloud-agnostic. In production, each component can run in containers (e.g. Docker, Kubernetes) on AWS/GCP/Azure.
*   **Edge Devices:** IoT sensors or driver smartphones send data via MQTT/WebSockets or HTTP POST.
*   **Geofencing:** Geospatial service enforces that events trigger claims only if the driver is in the affected area.
*   **Async Pipelines:** FastAPI handles concurrency with Python `asyncio`.
*   **Cloud Services:** Managed Kubernetes or serverless containers. Data is stored in Region-local PostgreSQL/Redis.
*   **Blockchain:** EVM-compatible chain hosts the token contract. Oracles can supply truth if shifted entirely on-chain.

### Security, Testing & Auditability
*   **Authentication & Authorization:** All API endpoints are protected using OAuth2 or API keys. 
*   **Immutability & Data Encryption:** Data in transit uses HTTPS/TLS. The use of blockchain ensures every payout is permanently recorded.
*   **LLM Safety:** The Tier-3 agent is the only AI making subjective judgments, so we use sanitized inputs, limit outputs to structured yes/no, and perform adversarial testing.
*   **Testing Strategy:** Unit tests via FastAPI `TestClient`, Integration tests via Mock Events, and Simulation testing via our 4-button Dev Panel.

### Tables: Components & Data Schemas

**Major Components:**

| Component | Role/Description |
| :--- | :--- |
| **FastAPI Backend** | Receives events and orchestrates the payout process (async, Pydantic). |
| **Fraud Engine (Tier 1)** | Applies deterministic business rules and threshold checks. |
| **Fraud Engine (Tier 2)** | Velocity/historical checks against database records (e.g. recent claims count). |
| **Fraud Engine (Tier 3)** | LLM-based contextual check; uses a secure AI service and vetted data. |
| **Smart Contract** | Blockchain code handling token minting. Enforces authorization. |
| **Database/Cache** | Stores policies, claim logs, and event data (e.g. PostgreSQL, Redis). |
| **Web Dashboard** | UI for drivers/admins, showing policy, balance, and logs. |

**Data Schema (example for `/simulate-event` request):**

| Field | Type | Description |
| :--- | :--- | :--- |
| `driverId` | `integer` | Unique ID of the driver |
| `eventType` | `string` | Trigger name (e.g. "HeavyRain") |
| `timestamp` | `datetime` | ISO timestamp of the event |
| `location` | `object` | `{lat: float, lon: float}` of event |
| `zone` | `string` | Geofence label (e.g. "A") |

## 20. Tech Stack
*   **Frontend:** Next.js (Responsive Mobile-Web)
*   **Backend:** Node.js + FastAPI (Python)
*   **ML:** Scikit-learn, XGBoost, Prophet
*   **DB:** PostgreSQL (Prisma ORM)
*   **Security:** JWT, SHA-256, TLS 1.3, AES-256
*   **APIs:** OpenWeatherMap, WAQI, TomTom Traffic
*   **Payments:** Razorpay (Sandbox Simulation)

## 21. System Advantages & Value Proposition
*   **Reduces Basis Risk:** Triggers are strictly correlated to income loss.
*   **India-Optimized:** Uses IMD standards and UPI-first design.
*   **Network-Level Defense:** Detects organized fraud rings, not just individuals.
*   **Robust Integrity:** Cybersecurity components ensure a tamper-proof claim pipeline.
*   **Zero Friction:** Autonomous workflow from trigger to payout.

## 22. Mission Statement
> *“GIG-I transforms insurance from a reactive claims process into a real-time, AI-driven income protection system—secure against coordinated fraud and optimized for India’s gig workforce.”*
