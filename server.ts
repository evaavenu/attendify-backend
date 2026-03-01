import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from `path`;`nimport { fileURLToPath } from `url`;`nconst __filename = fileURLToPath(import.meta.url);`nconst __dirname = path.dirname(__filename);
import fs from "fs";

// Use /data/attendance.db on cloud (Render persistent disk), fallback to local
const DB_PATH = process.env.DB_PATH || `/tmp/attendance.db`;
const db = new Database(DB_PATH);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    section TEXT,
    passcode TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    name TEXT,
    FOREIGN KEY (class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    date TEXT,
    status TEXT, -- 'P' or 'A'
    FOREIGN KEY (student_id) REFERENCES students(id)
  );
`);

// Seed initial data if empty
const configCheck = db.prepare("SELECT * FROM config WHERE key = 'admin_password'").get();
if (!configCheck) {
  db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("admin_password", "admin123");
}

const classCheck = db.prepare("SELECT * FROM classes LIMIT 1").get();
const passcodeMap: Record<string, string> = {
  "Nursery-A": "X7Q", "Nursery-B": "L2M",
  "LKG-A": "R9T", "LKG-B": "B4K",
  "UKG-A": "H6Z", "UKG-B": "P3W",
  "Class 1-A": "D8V", "Class 1-B": "Q5L",
  "Class 2-A": "M7X", "Class 2-B": "T1R",
  "Class 3-A": "K9P", "Class 3-B": "F2C",
  "Class 4-A": "Z4N", "Class 4-B": "J8S",
  "Class 5-A": "L6D", "Class 5-B": "W3Q",
  "Class 6-A": "R2Y", "Class 6-B": "V9M",
  "Class 7-A": "G5T", "Class 7-B": "N8K",
  "Class 8-A": "X1L", "Class 8-B": "C7P",
  "Class 9-A": "B6R", "Class 9-B": "H3F",
  "Class 10-A": "T8Z", "Class 10-B": "Q4Y",
  "Class 11-A": "M2J", "Class 12-A": "P9X"
};

if (!classCheck) {
  const classNames = ["Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
  const insertClass = db.prepare("INSERT INTO classes (name, section, passcode) VALUES (?, ?, ?)");
  
  classNames.forEach(name => {
    const isHigherSecondary = name === "Class 11" || name === "Class 12";
    const sections = isHigherSecondary ? ["A"] : ["A", "B"];
    
    sections.forEach(sec => {
      const passcode = passcodeMap[`${name}-${sec}`] || `${name.replace(" ", "")}-${sec}-123`.toUpperCase();
      insertClass.run(name, sec, passcode);
    });
  });
} else {
  // Update existing passcodes to match the new map
  const updatePasscode = db.prepare("UPDATE classes SET passcode = ? WHERE name = ? AND section = ?");
  Object.entries(passcodeMap).forEach(([key, code]) => {
    const [name, sec] = key.split("-");
    updatePasscode.run(code, name, sec);
  });
  // Cleanup: Ensure Class 11 and 12 only have Section A if they were previously seeded with B
  db.prepare("DELETE FROM classes WHERE name IN ('Class 11', 'Class 12') AND section = 'B'").run();
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');

  // CORS - allow requests from Capacitor APK (capacitor://localhost, https://localhost)
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowedOrigins = ['capacitor://localhost', 'https://localhost', 'http://localhost', 'http://10.0.2.2:3000'];
    if (allowedOrigins.includes(origin) || !origin) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  app.use(express.json());

  // --- API Routes ---

  // Principal Remark
  app.get("/api/config/remark", (req, res) => {
    const remark = db.prepare("SELECT value FROM config WHERE key = 'principal_remark'").get();
    res.json({ value: remark ? remark.value : "" });
  });

  app.post("/api/config/remark", (req, res) => {
    const { remark } = req.body;
    db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('principal_remark', ?)").run(remark);
    res.json({ success: true });
  });

  // Teacher Auth via Passcode
  app.post("/api/teacher/login", (req, res) => {
    const { passcode } = req.body;
    const classInfo = db.prepare("SELECT * FROM classes WHERE passcode = ?").get(passcode);
    if (classInfo) {
      res.json({ success: true, class: classInfo });
    } else {
      res.status(401).json({ success: false, message: "Invalid passcode" });
    }
  });

  // Auth
  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    const adminPass = db.prepare("SELECT value FROM config WHERE key = 'admin_password'").get();
    if (password === adminPass.value) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Incorrect password" });
    }
  });

  app.post("/api/admin/change-password", (req, res) => {
    const { newPassword } = req.body;
    db.prepare("UPDATE config SET value = ? WHERE key = 'admin_password'").run(newPassword);
    res.json({ success: true });
  });

  // Classes
  app.get("/api/classes", (req, res) => {
    const classes = db.prepare("SELECT * FROM classes").all();
    res.json(classes);
  });

  // Teacher Setup
  app.get("/api/config/:key", (req, res) => {
    const val = db.prepare("SELECT value FROM config WHERE key = ?").get(req.params.key);
    res.json(val || { value: null });
  });

  app.post("/api/config", (req, res) => {
    const { key, value } = req.body;
    db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)").run(key, value);
    res.json({ success: true });
  });

  // Students
  app.get("/api/students/:classId", (req, res) => {
    const students = db.prepare("SELECT * FROM students WHERE class_id = ?").all(req.params.classId);
    res.json(students);
  });

  app.post("/api/students", (req, res) => {
    const { classId, name } = req.body;
    const result = db.prepare("INSERT INTO students (class_id, name) VALUES (?, ?)").run(classId, name);
    res.json({ id: result.lastInsertRowid, classId, name });
  });

  app.put("/api/students/:id", (req, res) => {
    const { name } = req.body;
    db.prepare("UPDATE students SET name = ? WHERE id = ?").run(name, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/students/:id", (req, res) => {
    db.prepare("DELETE FROM attendance WHERE student_id = ?").run(req.params.id);
    db.prepare("DELETE FROM students WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Attendance
  app.get("/api/attendance/:classId/:date", (req, res) => {
    const { classId, date } = req.params;
    const records = db.prepare(`
      SELECT a.*, s.name as student_name 
      FROM attendance a 
      JOIN students s ON a.student_id = s.id 
      WHERE s.class_id = ? AND a.date = ?
    `).all(classId, date);
    res.json(records);
  });

  app.post("/api/attendance", (req, res) => {
    const { date, records } = req.body; // records: [{studentId, status}]
    
    // Server-side check for Sunday
    const isSunday = new Date(date + 'T00:00:00').getDay() === 0;
    if (isSunday) {
      return res.status(400).json({ success: false, message: "Cannot mark attendance on Sundays" });
    }

    const insert = db.prepare("INSERT OR REPLACE INTO attendance (student_id, date, status) VALUES (?, ?, ?)");
    const transaction = db.transaction((recs) => {
      for (const rec of recs) {
        // First delete existing for this student and date to avoid duplicates if replace doesn't work as expected with non-unique constraints
        db.prepare("DELETE FROM attendance WHERE student_id = ? AND date = ?").run(rec.studentId, date);
        insert.run(rec.studentId, date, rec.status);
      }
    });
    transaction(records);
    res.json({ success: true });
  });

  // Reports
  app.get("/api/reports/:classId/:month", (req, res) => {
    const { classId, month } = req.params; // month format: YYYY-MM
    const students = db.prepare("SELECT * FROM students WHERE class_id = ?").all(classId);
    const report = students.map(student => {
      const attendance = db.prepare(`
        SELECT status, date FROM attendance 
        WHERE student_id = ? AND date LIKE ?
      `).all(student.id, `${month}%`);
      
      const presentCount = attendance.filter(a => a.status === 'P').length;
      const absentCount = attendance.filter(a => a.status === 'A').length;
      const total = presentCount + absentCount;
      const percentage = total > 0 ? parseFloat(((presentCount / total) * 100).toFixed(1)) : 0;

      return {
        id: student.id,
        name: student.name,
        presentCount,
        absentCount,
        percentage,
        records: attendance
      };
    });
    res.json(report);
  });

  app.get("/api/reports/yearly/:classId/:year", (req, res) => {
    const { classId, year } = req.params; // year format: YYYY
    const students = db.prepare("SELECT * FROM students WHERE class_id = ?").all(classId);
    const report = students.map(student => {
      const attendance = db.prepare(`
        SELECT status, date FROM attendance 
        WHERE student_id = ? AND date LIKE ?
      `).all(student.id, `${year}%`);
      
      const presentCount = attendance.filter(a => a.status === 'P').length;
      const absentCount = attendance.filter(a => a.status === 'A').length;
      const total = presentCount + absentCount;
      const percentage = total > 0 ? parseFloat(((presentCount / total) * 100).toFixed(1)) : 0;

      return {
        id: student.id,
        name: student.name,
        presentCount,
        absentCount,
        percentage,
        records: attendance
      };
    });
    res.json(report);
  });

  app.get("/api/reports/all/:classId", (req, res) => {
    const { classId } = req.params;
    const students = db.prepare("SELECT * FROM students WHERE class_id = ?").all(classId);
    const report = students.map(student => {
      const records = db.prepare(`
        SELECT status, date FROM attendance 
        WHERE student_id = ?
        ORDER BY date ASC
      `).all(student.id);
      
      return {
        id: student.id,
        name: student.name,
        records
      };
    });
    res.json(report);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
