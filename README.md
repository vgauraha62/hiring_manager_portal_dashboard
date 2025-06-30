# hiring_manager_portal_dashboard

Project Description
This project is a Hiring Manager Portal with a sophisticated Candidate Analytics Dashboard. It's designed to provide hiring managers with an advanced tool for evaluating and comparing job candidates. The dashboard moves beyond simple metrics, offering deep insights through various interactive visualizations. Key features include an overview of all candidates, detailed skill analysis for individuals, side-by-side candidate comparisons, and a timeline of their project submissions and scores. This allows for a more data-driven and comprehensive approach to the hiring process.

------

In-depth Technical Aspects
From a technical standpoint, the AnalyticsDashboard component showcases a modern web application architecture:

---

Frontend Framework: The application is built using React with TypeScript, as indicated by the .tsx file extension and the use of React hooks (useState, useEffect). The "use client"; directive at the top suggests it's likely built with Next.js, which separates server-rendered and client-rendered components.

----

UI Components: The UI is constructed with a component-based library, most likely shadcn/ui, given the import paths like ./card and ./button. This allows for a consistent and reusable design system for elements like cards, tabs, buttons, and select dropdowns.

---

Data Visualization: The project heavily relies on the Recharts library to create rich, interactive charts:

---

RadarChart: Used to provide a multi-dimensional view of a candidate's calculated skill scores (e.g., Technical, Complexity, Documentation, Innovation, Presentation).

---

PieChart: Visualizes the distribution of a candidate's projects across different industries.

---

BarChart: Allows for direct comparison of skill metrics between multiple selected candidates.

---

LineChart: Tracks a candidate's performance over time by plotting their project scores on a timeline.

---
Client-Side Data Processing: A significant amount of logic is handled on the client-side:

--
Data Fetching: It asynchronously fetches candidate data from a backend API endpoint (http://localhost:5000/api/analytics) when the component mounts.

----
Authentication: API calls are authenticated using a Bearer Token, which is retrieved from localStorage. This implies a token-based (likely JWT) authentication strategy.


---
Data Enhancement: After receiving data from the API, the frontend calculates several new metrics. It applies a set of heuristics (e.g., checking for keywords like 'API' or 'database' in project descriptions) to derive scores for technical skills, project complexity, and more. This offloads some computational work from the backend and allows for dynamic scoring logic on the client.
State Management: Component-level state (like the list of candidates, the currently selected candidate, and UI state like search terms) is managed using React's useState hook.


---

Interactivity: The dashboard is highly interactive, featuring:
Real-time search and filtering of candidates.
Tab-based navigation to switch between different analytics views.
Click-to-select functionality to drill down into a specific candidate's detailed analysis or to choose candidates for comparison.
