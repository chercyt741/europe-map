const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Initialize SQLite Database
const db = new sqlite3.Database("./friends.db", (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("Connected to SQLite database");

    // Create friends table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            notes TEXT,
            otherCities TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            displayName TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
  }
});

// API Routes

// Get all friends (for admin panel)
app.get("/api/friends", (req, res) => {
  db.all("SELECT * FROM friends ORDER BY timestamp DESC", (err, rows) => {
    if (err) {
      console.error("Error fetching friends:", err);
      res.status(500).json({ error: "Failed to fetch friends" });
    } else {
      const friends = rows.map((row) => ({
        id: row.id,
        name: row.name,
        location: row.location,
        notes: row.notes,
        otherCities: row.otherCities,
        coords: {
          lat: row.latitude,
          lng: row.longitude,
        },
        displayName: row.displayName,
        timestamp: row.timestamp,
      }));
      res.json(friends);
    }
  });
});

// Get public friends data (for frontend - no notes)
app.get("/api/friends/public", (req, res) => {
  db.all(
    "SELECT id, name, location, latitude, longitude, displayName, timestamp FROM friends ORDER BY timestamp DESC",
    (err, rows) => {
      if (err) {
        console.error("Error fetching public friends:", err);
        res.status(500).json({ error: "Failed to fetch friends" });
      } else {
        const friends = rows.map((row) => ({
          id: row.id,
          name: row.name,
          location: row.location,
          coords: {
            lat: row.latitude,
            lng: row.longitude,
          },
          displayName: row.displayName,
          timestamp: row.timestamp,
        }));
        res.json(friends);
      }
    }
  );
});

// Add new friend
app.post("/api/friends", (req, res) => {
  const { name, location, notes, otherCities, coords, displayName } = req.body;

  // Validation
  if (!name || !location || !coords || !coords.lat || !coords.lng) {
    return res
      .status(400)
      .json({ error: "Name, location, and coordinates are required" });
  }

  const stmt = db.prepare(`
        INSERT INTO friends (name, location, notes, otherCities, latitude, longitude, displayName)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

  stmt.run(
    [
      name,
      location,
      notes || null,
      otherCities || null,
      coords.lat,
      coords.lng,
      displayName || null,
    ],
    function (err) {
      if (err) {
        console.error("Error adding friend:", err);
        res.status(500).json({ error: "Failed to add friend" });
      } else {
        res.json({
          id: this.lastID,
          name,
          location,
          notes,
          otherCities,
          coords,
          displayName,
          message: "Friend added successfully",
        });
      }
    }
  );

  stmt.finalize();
});

// Delete friend (admin only)
app.delete("/api/friends/:id", (req, res) => {
  const friendId = req.params.id;

  db.run("DELETE FROM friends WHERE id = ?", [friendId], function (err) {
    if (err) {
      console.error("Error deleting friend:", err);
      res.status(500).json({ error: "Failed to delete friend" });
    } else if (this.changes === 0) {
      res.status(404).json({ error: "Friend not found" });
    } else {
      res.json({ message: "Friend deleted successfully" });
    }
  });
});

// Clear all friends (admin only)
app.delete("/api/friends", (req, res) => {
  db.run("DELETE FROM friends", function (err) {
    if (err) {
      console.error("Error clearing friends:", err);
      res.status(500).json({ error: "Failed to clear friends" });
    } else {
      res.json({ message: `Deleted ${this.changes} friends` });
    }
  });
});

// Get stats (admin only)
app.get("/api/stats", (req, res) => {
  db.all(
    `
        SELECT 
            COUNT(*) as totalFriends,
            COUNT(CASE WHEN notes IS NOT NULL AND notes != '' THEN 1 END) as friendsWithNotes,
            COUNT(CASE WHEN otherCities IS NOT NULL AND otherCities != '' THEN 1 END) as friendsWithRecommendations
        FROM friends
    `,
    (err, rows) => {
      if (err) {
        console.error("Error getting stats:", err);
        res.status(500).json({ error: "Failed to get stats" });
      } else {
        res.json(rows[0]);
      }
    }
  );
});

// Serve static files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Handle 404
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Chercy's European Adventure server running on port ${PORT}`);
  console.log(`🌍 Frontend: http://localhost:${PORT}`);
  console.log(`🎭 Admin Panel: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err);
    } else {
      console.log("Database connection closed");
    }
    process.exit(0);
  });
});
