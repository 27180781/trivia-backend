const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const Redis = require("ioredis");
const fs = require('fs');

const PORT = 80;
const redis = new Redis({ host: 'srv-captain--trivia-redis', password: 'srv-captain--trivia-redis' });
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const gameData = JSON.parse(fs.readFileSync('game.json', 'utf8'));

// ניהול מצב המשחק בצורה מפורטת יותר
let gameState = {
    gameId: 'game123',
    currentQuestionIndex: -1,
    // Stages: waiting, question_revealed, voting, answer_revealed, finished
    stage: 'waiting' 
};

app.use(express.json());
app.use(express.static('public'));

app.post('/api/vote', async (req, res) => {
    if (gameState.stage !== 'voting') {
        return res.status(403).send({ message: 'Voting is not active' });
    }
    try {
        const { gameId, answer } = req.body;
        const votesKey = `votes:${gameId}:${gameState.currentQuestionIndex}`;
        await redis.hincrby(votesKey, answer, 1);
        const allVotes = await redis.hgetall(votesKey);
        io.emit('update_votes', allVotes);
        res.status(200).send({ message: 'Vote received' });
    } catch (error) {
        res.status(500).send({ message: 'Internal server error' });
    }
});

io.on('connection', (socket) => {
    console.log('Host connected:', socket.id);

    // פונקציית שליטה מרכזית שמגיבה למקש הרווח
    socket.on('game_action', async (action) => {
        if (action !== 'advance') return;

        switch (gameState.stage) {
            case 'waiting':
                // מתחילים את המשחק, מציגים את השאלה הראשונה
                gameState.currentQuestionIndex = 0;
                await redis.del(`votes:${gameState.gameId}:0`);
                io.emit('display_question', { question: gameData[0] });
                gameState.stage = 'question_revealed';
                break;

            case 'question_revealed':
                // פותחים את ההצבעה ומפעילים את הטיימר
                const currentQuestion = gameData[gameState.currentQuestionIndex];
                io.emit('start_timer', { duration: currentQuestion.timer });
                gameState.stage = 'voting';
                break;
            
            case 'voting':
                // חושפים את התשובה הנכונה
                const correctIdx = gameData[gameState.currentQuestionIndex].correctAnswerIndex;
                io.emit('reveal_answer', { correctAnswerIndex: correctIdx });
                gameState.stage = 'answer_revealed';
                break;

            case 'answer_revealed':
                // עוברים לשאלה הבאה
                if (gameState.currentQuestionIndex < gameData.length - 1) {
                    gameState.currentQuestionIndex++;
                    const nextQuestionIndex = gameState.currentQuestionIndex;
                    await redis.del(`votes:${gameState.gameId}:${nextQuestionIndex}`); // ניקוי הצבעות לשאלה הבאה
                    io.emit('display_question', { question: gameData[nextQuestionIndex] });
                    gameState.stage = 'question_revealed';
                } else {
                    // המשחק נגמר
                    io.emit('game_over');
                    gameState.stage = 'finished';
                }
                break;
        }
        console.log(`New game stage: ${gameState.stage}`);
    });

    socket.on('disconnect', () => { console.log('Host disconnected'); });
});

server.listen(PORT, () => {
    console.log(`🚀 Server is live and listening on port ${PORT}`);
});