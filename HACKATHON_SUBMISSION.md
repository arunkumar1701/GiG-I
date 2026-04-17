# How We Built Our Project

Our goal was to design a **fully automated parametric insurance platform** for food delivery partners such as Swiggy and Zomato riders. Instead of traditional insurance claims where users must submit proof and wait for manual verification, our system automatically detects disruptions that prevent riders from working and compensates them instantly.

To achieve this, we designed the system as an **agent-driven automation pipeline** that continuously monitors external conditions, validates claims, detects fraud, and processes payouts.

---

## System Architecture

The platform consists of five core layers:

1. **User Layer**
2. **Trigger Monitoring Layer**
3. **Agentic AI Fraud Engine**
4. **Decision Engine**
5. **Payout & Notification Layer**

Delivery partners only interact with the system during **onboarding and policy purchase**. After that, the entire claims process is handled automatically in the background.

---

## Weekly Policy Model

Gig workers operate on a weekly earning cycle. Our platform allows riders to purchase **weekly protection plans** that insure their expected income.

Each rider provides:

- operating city  
- delivery zone  
- estimated weekly earnings  
- working hours  

Based on these parameters, the system generates a **dynamic weekly premium** using risk modeling.

---

## Parametric Trigger Monitoring

The platform continuously monitors **external disruption signals** using public APIs such as weather and civic alerts.

Examples of triggers include:

- heavy rainfall  
- extreme heat  
- flooding alerts  
- local curfews or shutdowns  

When a trigger exceeds predefined thresholds, the system automatically generates claims for riders operating in the affected zone.

For example:

- **Heavy Rain Trigger:** rainfall ≥ 64.5 mm in 24 hours  
- **Heatwave Trigger:** temperature ≥ 40°C  

This **parametric approach removes the need for manual claim filing**, enabling instant claim creation.

---

## Agentic AI System

To automate the entire process, we implemented a **multi-agent orchestration architecture**. Each AI agent performs a specialized task within the workflow.

### Monitoring Agent
Continuously monitors weather APIs and disruption feeds. When a threshold is crossed, it emits a trigger event.

### Claim Generation Agent
Identifies active policies in the affected zone and automatically creates claim records.

### Fraud Analysis Agent
Evaluates claims using multiple signals to detect suspicious activity.

### Decision Agent
Applies risk thresholds and determines whether a claim should be approved, rejected, or analyzed further.

### Payment Agent
Processes the payout through the payment integration once a claim is approved.

These agents communicate through an orchestration layer, enabling **fully automated claim processing without manual intervention**.

---

## Fraud Risk Scoring Model

To prevent abuse while maintaining fairness, the system calculates a **Fraud Risk Score (FRS)** using multiple independent signals.

$$
FRS = w_1 \cdot EventScore + w_2 \cdot LocationScore + w_3 \cdot DeviceScore + w_4 \cdot BehaviorScore + w_5 \cdot NetworkScore
$$

Where:

- **EventScore** validates that the disruption actually occurred  
- **LocationScore** verifies the rider’s GPS location  
- **DeviceScore** checks device anomalies or emulator usage  
- **BehaviorScore** compares the claim against historical activity patterns  
- **NetworkScore** detects duplicate identities or coordinated fraud rings  

Each signal is normalized between 0 and 1 and weighted according to its reliability.

---

## Fraud Decision Policy

Once the Fraud Risk Score is calculated, the system applies automated thresholds:

- **FRS < 0.25 → Auto-approve claim** (Instant Payout)
- **0.25 ≤ FRS < 0.75 → Deep validation pipeline** (Delay & Manual Review)
- **FRS ≥ 0.75 + multiple fraud signals → Hold / Reject claim**

This ensures that genuine riders receive payouts quickly while suspicious claims are thoroughly analyzed.

---

## Automated Deep Resolution Pipeline

For medium-risk claims, the system runs a deeper automated validation pipeline.

### Step 1 — Deterministic Validation

The backend re-verifies signals using multiple checks:

- cross-check weather triggers from multiple sources  
- analyze rider GPS trajectory  
- validate activity logs and working hours  
- check device integrity signals  
- verify time-window consistency  

After these checks, the system recomputes an updated score **FRS₂**.

---

### Step 2 — Re-scoring Decision

- **FRS₂ < 0.25 → Approve**
- **FRS₂ > 0.75 with multiple fraud signals → Reject**
- otherwise proceed to AI reasoning.

---

### Step 3 — Agentic AI Reasoning

An AI agent acts as a **fraud analyst assistant**. It evaluates the collected evidence and outputs:

- confidence score  
- decision suggestion  
- explanation of reasoning  

Example output:

```
Confidence: 0.82  
Decision: Likely genuine claim  
Explanation: GPS trajectory consistent with delivery zone, no device anomalies detected
```

---

### Step 4 — Deterministic Final Rule

- **confidence ≥ 0.75 → approve claim**
- **confidence ≤ 0.40 → reject claim**
- **otherwise → retry validation with fresh data**

This combination of deterministic rules and AI reasoning provides both **accuracy and explainability**.

---

## End-to-End Automation Workflow

Once a rider purchases a weekly plan, the entire system runs automatically.

1. Rider activates weekly policy  
2. Monitoring agent scans disruption signals  
3. Trigger detected in rider’s delivery zone  
4. Claim automatically generated  
5. Fraud risk score computed  
6. Deep validation pipeline executed (if needed)  
7. Decision agent determines outcome  
8. Payment agent processes payout  
9. Rider receives notification  

This creates a **zero-touch insurance experience** where the worker does not need to file claims manually.

---

## Event Replay Mode

To ensure reliable demonstrations during the hackathon, we implemented a **Replay Mode** that allows simulated disruption events.

Judges can trigger events such as:

- heavy rain  
- heatwave  
- flood alert  

The system immediately runs the entire pipeline, allowing observers to watch the process from **trigger detection to payout** in real time.

---

## Technology Stack

### Frontend
- React / Vite
- Tailwind CSS
- Firebase Auth (OTP)

### Backend
- FastAPI / Node.js
- REST APIs for claim processing  
- background event monitoring  

### Database
- PostgreSQL (via Prisma ORM)
- stores policies, claims, events, and audit logs  

### AI / ML Layer
- Python  
- Scikit-learn / XGBoost  
- anomaly detection models  

### Agent Framework
- LangChain / Gemini Pro
- AI reasoning agents  

### External APIs
- OpenWeatherMap (weather triggers)  
- WAQI API (risk pricing context)  
- TomTom Traffic API (zone geolocation)  

### Payments
- Razorpay sandbox API for simulated payouts  

---

## Challenges We Ran Into

One of the biggest challenges was balancing **automation with fairness**. A fully automated system must prevent fraud while ensuring genuine riders are not blocked from receiving compensation.

To address this, we avoided relying on a single signal such as GPS. Instead, we designed a **multi-signal fraud scoring model** that combines environmental verification, device analysis, behavioral patterns, and network detection.

Another challenge was selecting **triggers that genuinely disrupt delivery operations**. Some environmental signals, such as air pollution levels, may not always affect delivery activity. We therefore focused on triggers that directly impact outdoor work conditions.

Reliability was another critical concern. Real-world APIs may fail or not produce events during a live demonstration. To solve this, we built an **event replay system** that allows controlled simulation of disruption events.

Finally, explainability was essential. Automated insurance decisions must be transparent and auditable. Every claim decision includes the calculated fraud score, contributing signals, and the reasoning produced by the AI agent.

---

## What We Learned

Through this project, we learned that designing insurance systems requires more than just machine learning models. It requires balancing automation, fairness, and trust.

We discovered that combining **parametric triggers, agentic AI workflows, and multi-signal fraud detection** can create a system that protects workers while maintaining financial sustainability.

Our system demonstrates how modern AI-driven infrastructure can transform traditional insurance into a **real-time safety net for the gig economy**.
