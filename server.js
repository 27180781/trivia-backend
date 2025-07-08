// ייבוא הספריות
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const Redis = require("ioredis");

// --- הגדרות ---
const PORT = 80; // פורט ברירת המחדל של קפרובר
// התחברות ל-Redis שהתקנו דרך קפרובר
const redis = new Redis({ host: 'srv-captain--trivia-redis', password: 'srv-captain--trivia-redis' });
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- Middleware ---
// הגדרה לקבלת בקשות JSON
app.use(express.json());
// הגדרה להגשת קבצים סטטיים מהתיקייה 'public'
app.use(express.static('public'));

// --- API Endpoint לקבלת הצבעות ---
app.post('/api/vote', async (req, res) => {
    try {
        const { gameId, answer } = req.body;

        // ולידציה בסיסית
        if (!gameId || !answer) {
            return res.status(400).send({ message: 'Missing gameId or answer' });
        }

        // 1. שמירת ההצבעה ב-Redis
        //    הפקודה HINCRBY מגדילה את הערך של שדה (answer) בתוך מפתח (gameId)
        const voteCount = await redis.hincrby(gameId, answer, 1);
        console.log(`Vote received for game ${gameId}, answer ${answer}. Total for answer: ${voteCount}`);
        
        // 2. שליפת כל התוצאות המעודכנות למשחק
        const allResults = await redis.hgetall(gameId);

        // 3. שליחת התוצאות המעודכנות למסך המנחה
        io.emit('update_results', allResults);

        res.status(200).send({ message: 'Vote received successfully' });

    } catch (error) {
        console.error('Error processing vote:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// --- Socket.IO ---
io.on('connection', (socket) => {
    console.log('A host connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Host disconnected:', socket.id);
    });
});

// --- הפעלת השרת ---
server.listen(PORT, () => {
    console.log(`🚀 Server is live and listening on port ${PORT}`);
});