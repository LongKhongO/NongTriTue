import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("nongtritue.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    species TEXT,
    age TEXT,
    planting_date DATETIME,
    location TEXT,
    health_status TEXT,
    last_care DATETIME,
    image_url TEXT,
    category TEXT, -- 'fruit', 'ornamental', 'indoor', 'outdoor'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS growth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER,
    height REAL,
    leaf_count INTEGER,
    health_score INTEGER,
    note TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(plant_id) REFERENCES plants(id)
  );

  CREATE TABLE IF NOT EXISTS supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    description TEXT,
    price REAL,
    usage_guide TEXT,
    side_effects TEXT,
    store_url TEXT,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS saved_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT,
    snippet TEXT,
    summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER,
    content TEXT,
    image_url TEXT,
    type TEXT, -- 'growth', 'care', 'disease'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(plant_id) REFERENCES plants(id)
  );

  CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT,
    nickname TEXT,
    content TEXT,
    image_url TEXT,
    likes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    author TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES community_posts(id)
  );

  CREATE TABLE IF NOT EXISTS comment_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER,
    author TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(comment_id) REFERENCES comments(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER,
    type TEXT, -- 'fertilizer', 'water', 'seed', 'other'
    amount REAL,
    description TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(plant_id) REFERENCES plants(id)
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id INTEGER,
    title TEXT,
    time DATETIME,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed'
    FOREIGN KEY(plant_id) REFERENCES plants(id)
  );

  CREATE TABLE IF NOT EXISTS news_bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT,
    snippet TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/plants", (req, res) => {
    const plants = db.prepare("SELECT * FROM plants ORDER BY created_at DESC").all();
    res.json(plants);
  });

  app.post("/api/plants", (req, res) => {
    const { name, species, age, planting_date, location, health_status, image_url, category } = req.body;
    const info = db.prepare(
      "INSERT INTO plants (name, species, age, planting_date, location, health_status, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(name, species, age, planting_date, location, health_status, image_url, category);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/plants/:id/growth", (req, res) => {
    const logs = db.prepare("SELECT * FROM growth_logs WHERE plant_id = ? ORDER BY created_at ASC").all(req.params.id);
    res.json(logs);
  });

  app.post("/api/plants/:id/growth", (req, res) => {
    const { height, leaf_count, health_score, note, image_url } = req.body;
    const info = db.prepare(
      "INSERT INTO growth_logs (plant_id, height, leaf_count, health_score, note, image_url) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(req.params.id, height, leaf_count, health_score, note, image_url);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/supplies", (req, res) => {
    const supplies = db.prepare("SELECT * FROM supplies").all();
    res.json(supplies);
  });

  app.get("/api/news/saved", (req, res) => {
    const news = db.prepare("SELECT * FROM saved_news ORDER BY created_at DESC").all();
    res.json(news);
  });

  app.post("/api/news/saved", (req, res) => {
    const { title, url, snippet, summary } = req.body;
    const info = db.prepare(
      "INSERT INTO saved_news (title, url, snippet, summary) VALUES (?, ?, ?, ?)"
    ).run(title, url, snippet, summary);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/plants/:id", (req, res) => {
    db.prepare("DELETE FROM plants WHERE id = ?").run(req.params.id);
    db.prepare("DELETE FROM diary WHERE plant_id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/diary/:plantId", (req, res) => {
    const entries = db.prepare("SELECT * FROM diary WHERE plant_id = ? ORDER BY created_at DESC").all(req.params.plantId);
    res.json(entries);
  });

  app.post("/api/diary", (req, res) => {
    const { plant_id, content, image_url, type } = req.body;
    const info = db.prepare(
      "INSERT INTO diary (plant_id, content, image_url, type) VALUES (?, ?, ?, ?)"
    ).run(plant_id, content, image_url, type);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/diary/:id", (req, res) => {
    db.prepare("DELETE FROM diary WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/community", (req, res) => {
    const posts = db.prepare("SELECT * FROM community_posts ORDER BY created_at DESC").all();
    const postsWithComments = posts.map(post => {
      const comments = db.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC").all(post.id);
      return { ...post, comments };
    });
    res.json(postsWithComments);
  });

  app.post("/api/community", (req, res) => {
    const { author, nickname, content, image_url } = req.body;
    const info = db.prepare(
      "INSERT INTO community_posts (author, nickname, content, image_url) VALUES (?, ?, ?, ?)"
    ).run(author, nickname, content, image_url);
    const newPost = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(info.lastInsertRowid);
    newPost.comments = [];
    io.emit("new_post", newPost);
    res.json(newPost);
  });

  app.post("/api/community/:id/like", (req, res) => {
    db.prepare("UPDATE community_posts SET likes = likes + 1 WHERE id = ?").run(req.params.id);
    const post = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(req.params.id);
    io.emit("post_updated", post);
    res.json(post);
  });

  app.post("/api/community/:id/comment", (req, res) => {
    const { author, content } = req.body;
    db.prepare("INSERT INTO comments (post_id, author, content) VALUES (?, ?, ?)").run(req.params.id, author, content);
    const comments = db.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC").all(req.params.id);
    const commentsWithReplies = comments.map(c => {
      const replies = db.prepare("SELECT * FROM comment_replies WHERE comment_id = ? ORDER BY created_at ASC").all(c.id);
      return { ...c, replies };
    });
    io.emit("comments_updated", { postId: req.params.id, comments: commentsWithReplies });
    res.json(commentsWithReplies);
  });

  app.post("/api/comments/:id/reply", (req, res) => {
    const { author, content, postId } = req.body;
    db.prepare("INSERT INTO comment_replies (comment_id, author, content) VALUES (?, ?, ?)").run(req.params.id, author, content);
    const comments = db.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC").all(postId);
    const commentsWithReplies = comments.map(c => {
      const replies = db.prepare("SELECT * FROM comment_replies WHERE comment_id = ? ORDER BY created_at ASC").all(c.id);
      return { ...c, replies };
    });
    io.emit("comments_updated", { postId, comments: commentsWithReplies });
    res.json(commentsWithReplies);
  });

  // Expenses
  app.get("/api/expenses", (req, res) => {
    const expenses = db.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
    res.json(expenses);
  });

  app.post("/api/expenses", (req, res) => {
    const { plant_id, type, amount, description } = req.body;
    const info = db.prepare("INSERT INTO expenses (plant_id, type, amount, description) VALUES (?, ?, ?, ?)").run(plant_id, type, amount, description);
    res.json({ id: info.lastInsertRowid });
  });

  // Reminders
  app.get("/api/reminders", (req, res) => {
    const reminders = db.prepare("SELECT * FROM reminders ORDER BY time ASC").all();
    res.json(reminders);
  });

  app.post("/api/reminders", (req, res) => {
    const { plant_id, title, time } = req.body;
    const info = db.prepare("INSERT INTO reminders (plant_id, title, time) VALUES (?, ?, ?)").run(plant_id, title, time);
    res.json({ id: info.lastInsertRowid });
  });

  // News Bookmarks
  app.get("/api/news/bookmarks", (req, res) => {
    const bookmarks = db.prepare("SELECT * FROM news_bookmarks ORDER BY created_at DESC").all();
    res.json(bookmarks);
  });

  app.post("/api/news/bookmarks", (req, res) => {
    const { title, url, snippet } = req.body;
    const info = db.prepare("INSERT INTO news_bookmarks (title, url, snippet) VALUES (?, ?, ?)").run(title, url, snippet);
    res.json({ id: info.lastInsertRowid });
  });

  // WebSocket for real-time chat/community
  io.on("connection", (socket) => {
    console.log("A user connected");
    socket.on("send_message", (msg) => {
      io.emit("receive_message", msg);
    });
    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
