const express = require("express")
const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const http = require("http")
const socketIo = require("socket.io")

// Initialize Express app
const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
  },
})

// Middleware
app.use(cors({ origin: "*", credentials: true }))
app.use(express.json())

// Environment variables (for demo purposes)
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hiring-portal"
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-here-change-in-production"

// In-memory storage for demo (replace with MongoDB in production)
const users = []
const projects = []
const savedProjects = []
const messages = []

// Helper functions
const findUser = (query) => users.find((user) => Object.keys(query).every((key) => user[key] === query[key]))

const findProject = (id) => projects.find((p) => p.id === id)

const generateId = () => Date.now().toString()

// Authentication Middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]
  if (!token) return res.status(401).json({ error: "No token provided" })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = findUser({ id: decoded.id })
    if (!req.user) return res.status(401).json({ error: "Invalid token" })
    next()
  } catch (err) {
    res.status(401).json({ error: "Invalid token" })
  }
}

// Routes

// Register
app.post("/api/register", async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password || !role) {
    return res.status(400).json({ error: "All fields required" })
  }

  try {
    const existingUser = findUser({ email })
    if (existingUser) return res.status(400).json({ error: "Email already exists" })

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = {
      id: generateId(),
      email,
      password: hashedPassword,
      role,
    }
    users.push(user)

    console.log(`User registered: ${email} as ${role}`)
    res.status(201).json({ message: "User registered" })
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: "All fields required" })
  }

  try {
    const user = findUser({ email })
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    })

    console.log(`User logged in: ${email}`)
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role },
    })
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

// Submit Project
app.post("/api/projects", async (req, res) => {
  const { fullName, email, industryRole, projectTitle, projectDescription, projectLink, githubLink } = req.body
  if (!fullName || !email || !industryRole || !projectTitle || !projectDescription || !projectLink) {
    return res.status(400).json({ error: "All required fields must be provided" })
  }

  try {
    let user = findUser({ email })
    if (!user) {
      // Create a candidate user if not exists
      user = {
        id: generateId(),
        email,
        password: await bcrypt.hash("defaultCandidatePassword", 10),
        role: "candidate",
      }
      users.push(user)
    }

    const project = {
      id: generateId(),
      fullName,
      email,
      industryRole,
      projectTitle,
      projectDescription,
      projectLink,
      githubLink,
      submissionDate: new Date().toISOString(),
      isNew: true,
      submittedBy: user.id,
    }
    projects.push(project)

    console.log(`Project submitted: ${projectTitle} by ${fullName}`)
    res.status(201).json({ message: "Project submitted", project })
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get Projects
app.get("/api/projects", authMiddleware, (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Access denied" })
  }

  try {
    const projectsWithUsers = projects.map((project) => ({
      ...project,
      submittedBy: findUser({ id: project.submittedBy }),
    }))

    console.log(`Manager ${req.user.email} fetched ${projects.length} projects`)
    res.json(projectsWithUsers)
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

// Save Project
app.post("/api/saved-projects", authMiddleware, (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Access denied" })
  }

  const { projectId } = req.body
  try {
    const project = findProject(projectId)
    if (!project) return res.status(404).json({ error: "Project not found" })

    const savedProject = {
      id: generateId(),
      projectId,
      managerId: req.user.id,
    }
    savedProjects.push(savedProject)

    // Mark project as not new
    project.isNew = false

    console.log(`Project ${project.projectTitle} saved by manager ${req.user.email}`)
    res.status(201).json({ message: "Project saved" })
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get Saved Projects
app.get("/api/saved-projects", authMiddleware, (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Access denied" })
  }

  try {
    const managerSavedProjects = savedProjects
      .filter((sp) => sp.managerId === req.user.id)
      .map((sp) => {
        const project = findProject(sp.projectId)
        return {
          ...project,
          submittedBy: findUser({ id: project.submittedBy }),
        }
      })

    console.log(`Manager ${req.user.email} fetched ${managerSavedProjects.length} saved projects`)
    res.json(managerSavedProjects)
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

// Get Messages for a Project
app.get("/api/messages/:projectId", authMiddleware, (req, res) => {
  try {
    const projectMessages = messages
      .filter((m) => m.projectId === req.params.projectId)
      .map((m) => ({
        ...m,
        senderId: findUser({ id: m.senderId }),
      }))

    console.log(`Fetched ${projectMessages.length} messages for project ${req.params.projectId}`)
    res.json(projectMessages)
  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

// Helper functions for analytics
const calculateCandidateScore = (project) => {
  let score = 0;
  
  // Score based on project description length and quality
  score += Math.min(10, project.projectDescription.length / 100);
  
  // Score based on having both project and github links
  if (project.projectLink) score += 5;
  if (project.githubLink) score += 5;
  
  return Math.min(100, score);
};

const getCandidateAnalytics = (candidateProjects) => {
  return {
    totalProjects: candidateProjects.length,
    averageScore: candidateProjects.reduce((acc, proj) => acc + calculateCandidateScore(proj), 0) / candidateProjects.length || 0,
    projectsByIndustry: candidateProjects.reduce((acc, proj) => {
      acc[proj.industryRole] = (acc[proj.industryRole] || 0) + 1;
      return acc;
    }, {}),
    latestSubmission: candidateProjects.sort((a, b) => 
      new Date(b.submissionDate) - new Date(a.submissionDate)
    )[0],
  };
};

// Get Analytics for All Candidates
app.get("/api/analytics", authMiddleware, (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    // Group projects by candidate email
    const candidateProjects = projects.reduce((acc, project) => {
      if (!acc[project.email]) {
        acc[project.email] = [];
      }
      acc[project.email].push(project);
      return acc;
    }, {});

    // Calculate analytics for each candidate
    const analytics = Object.entries(candidateProjects).map(([email, projects]) => ({
      email,
      ...getCandidateAnalytics(projects),
    }));

    // Add ranking based on average score
    const rankedAnalytics = analytics
      .sort((a, b) => b.averageScore - a.averageScore)
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
      }));

    console.log(`Manager ${req.user.email} fetched analytics for ${rankedAnalytics.length} candidates`);
    res.json(rankedAnalytics);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get Analytics for Specific Candidate
app.get("/api/analytics/:email", authMiddleware, (req, res) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const candidateProjects = projects.filter(p => p.email === req.params.email);
    if (candidateProjects.length === 0) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    const analytics = {
      email: req.params.email,
      ...getCandidateAnalytics(candidateProjects),
      projects: candidateProjects.map(p => ({
        ...p,
        score: calculateCandidateScore(p),
      })),
    };

    console.log(`Manager ${req.user.email} fetched analytics for candidate ${req.params.email}`);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Demo data setup
const setupDemoData = async () => {
  // Create demo manager
  const hashedPassword = await bcrypt.hash("Hiring2025", 10)
  users.push({
    id: "manager1",
    email: "manager@example.com",
    password: hashedPassword,
    role: "manager",
  })

  // Create demo project
  projects.push({
    id: "project1",
    fullName: "John Doe",
    email: "john@example.com",
    industryRole: "Software Development",
    projectTitle: "E-commerce Platform",
    projectDescription:
      "A full-stack e-commerce platform built with React and Node.js, featuring user authentication, payment processing, and inventory management.",
    projectLink: "https://github.com/johndoe/ecommerce-platform",
    githubLink: "https://github.com/johndoe",
    submissionDate: new Date().toISOString(),
    isNew: true,
    submittedBy: "candidate1",
  })

  // Create demo candidate
  users.push({
    id: "candidate1",
    email: "john@example.com",
    password: await bcrypt.hash("defaultCandidatePassword", 10),
    role: "candidate",
  })

  console.log("Demo data setup complete")
}

// Socket.IO for Real-Time Chat
io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  socket.on("joinProject", (projectId) => {
    socket.join(projectId)
    console.log(`User ${socket.id} joined project ${projectId}`)
  })

  socket.on("sendMessage", async ({ projectId, message, senderId }) => {
    try {
      const newMessage = {
        id: generateId(),
        projectId,
        senderId,
        message,
        timestamp: new Date().toISOString(),
      }
      messages.push(newMessage)

      const populatedMessage = {
        ...newMessage,
        senderId: findUser({ id: senderId }),
      }

      io.to(projectId).emit("newMessage", populatedMessage)
      console.log(`Message sent in project ${projectId}: ${message}`)

      // Simulate candidate response (for demo purposes)
      if (populatedMessage.senderId.role === "manager") {
        setTimeout(() => {
          const project = findProject(projectId)
          const candidate = findUser({ email: project.email })
          if (candidate) {
            const response = {
              id: generateId(),
              projectId,
              senderId: candidate.id,
              message: "Thanks for your message! I'd be happy to discuss further. When's a good time for a call?",
              timestamp: new Date().toISOString(),
            }
            messages.push(response)

            const populatedResponse = {
              ...response,
              senderId: candidate,
            }
            io.to(projectId).emit("newMessage", populatedResponse)
            console.log(`Auto-response sent in project ${projectId}`)
          }
        }, 2000)
      }
    } catch (err) {
      console.error("Error sending message:", err)
    }
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
  })
})

// Initialize demo data and start server
setupDemoData().then(() => {
  const PORT = process.env.PORT || 5000
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log("Available endpoints:")
    console.log("POST /api/register - Register new user")
    console.log("POST /api/login - Login user")
    console.log("POST /api/projects - Submit project")
    console.log("GET /api/projects - Get all projects (managers only)")
    console.log("POST /api/saved-projects - Save project (managers only)")
    console.log("GET /api/saved-projects - Get saved projects (managers only)")
    console.log("GET /api/messages/:projectId - Get messages for project")
    console.log("GET /api/analytics - Get analytics for all candidates")
    console.log("GET /api/analytics/:email - Get analytics for a specific candidate")
    console.log("\nDemo credentials:")
    console.log("Email: manager@example.com")
    console.log("Password: Hiring2025")
    console.log("\nMake sure to open your HTML file and the backend will handle API requests!")
  })
})
