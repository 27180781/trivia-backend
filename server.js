// ייבוא הספריות שהתקנו
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

// הגדרות ראשוניות
const PORT = 80; // קפרובר עובד עם פורט 80 כברירת מחדל
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// הגדרה לקבלת בקשות JSON
app.use(express.json());

// API Endpoint לקבלת הצבעות (כרגע רק מחזיר תשובה)
app.post('/api/vote', (req, res) => {
  console.log('התקבלה הצבעה:', req.body);
  // כאן תתווסף בהמשך הלוגיקה של Redis
  res.status(200).send({ message: 'Vote received' });
});

// מאזין לחיבורי WebSocket
io.on('connection', (socket) => {
  console.log('מסך מנחה התחבר:', socket.id);

  socket.on('disconnect', () => {
    console.log('מסך מנחה התנתק:', socket.id);
  });
});

// הפעלת השרת
server.listen(PORT, () => {
  console.log(`🚀 השרת מאזין בפורט ${PORT}`);
});