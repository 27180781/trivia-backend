const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const Redis = require("ioredis");
const fs = require('fs');

// --- הגדרות ---
const PORT = 80;
const redis = new Redis({ host: 'srv-captain--trivia-redis', password: 'srv-captain--trivia-redis' });
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- טעינת המשחק ---
const gameData = JSON.parse(fs.readFileSync('game.json', 'utf8'));
// משתנה שיחזיק את המצב הנוכחי של המשחק
let gameState = {
    gameId: 'game123', // מזהה קבוע לדוגמה
    currentQuestionIndex: -1,
    isQuestionActive: false
};

// --- Middleware ---
app.use(express.json());
app.use(express.static('public'));

// --- API Endpoint לקבלת הצבעות ---
app.post('/api/vote', async (req, res) => {
    // קבלת הצבעות רק כשהשאלה פעילה
    if (!gameState.isQuestionActive) {
        return res.status(403).send({ message: 'Voting is not active' });
    }

    try {
        const { gameId, answer, playerId } = req.body; // בהמשך נוסיף playerId אמיתי
        const currentQuestion = gameData[gameState.currentQuestionIndex];
        
        // שמירת ההצבעה (ספירת קולות)
        await redis.hincrby(`votes:${gameId}:${gameState.currentQuestionIndex}`, answer, 1);
        
        // בדיקה אם התשובה נכונה והוספת ניקוד
        if (parseInt(answer) === currentQuestion.correctAnswerIndex + 1) {
            // ה-playerId כרגע הוא דמה, בעתיד יגיע מהמשתתף
            const tempPlayerId = playerId || `player_${Math.floor(Math.random() * 1000)}`; 
            await redis.hincrby(`scores:${gameId}`, tempPlayerId, currentQuestion.points);
        }

        // שליפת כל התוצאות והניקוד המעודכנים
        const allVotes = await redis.hgetall(`votes:${gameId}:${gameState.currentQuestionIndex}`);
        const allScores = await redis.hgetall(`scores:${gameId}`);

        // שליחת עדכון למסך המנחה
        io.emit('update_results', { votes: allVotes, scores: allScores });

        res.status(200).send({ message: 'Vote received' });

    } catch (error) {
        console.error('Error processing vote:', error);
        res.status(500).send({ message: 'Internal server error' });
    }
});

// --- Socket.IO - לוגיקת המשחק ---
io.on('connection', (socket) => {
    console.log('Host connected:', socket.id);

    // התחלת המשחק
    socket.on('start_game', () => {
        console.log('Game started');
        gameState.currentQuestionIndex = 0;
        gameState.isQuestionActive = true;
        
        // ניקוי תוצאות ישנות
        redis.del(`votes:${gameState.gameId}:0`);
        redis.del(`scores:${gameState.gameId}`);
        
        const question = gameData[0];
        io.emit('show_question', question);
    });
    
    // מעבר לשאלה הבאה
    socket.on('next_question', () => {
        if (gameState.currentQuestionIndex < gameData.length - 1) {
            gameState.currentQuestionIndex++;
            gameState.isQuestionActive = true;
            
            // ניקוי תוצאות הצבעה לשאלה החדשה
            const newIndex = gameState.currentQuestionIndex;
            redis.del(`votes:${gameState.gameId}:${newIndex}`);

            const question = gameData[newIndex];
            io.emit('show_question', question);
        } else {
            // המשחק הסתיים
            gameState.isQuestionActive = false;
            io.emit('game_over');
            console.log('Game over');
        }
    });

    socket.on('disconnect', () => {
        console.log('Host disconnected:', socket.id);
    });
});

// --- הפעלת השרת ---
server.listen(PORT, () => {
    console.log(`🚀 Game server is live and listening on port ${PORT}`);
});