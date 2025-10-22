require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn(
    "⚠️ GEMINI_API_KEY tidak ditemukan. AI akan menggunakan random move."
  );
}
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI
  ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  : null;

const rooms = {};

app.get("/", (_req, res) => res.send("Tic-Tac-Toe Realtime Server OK"));

function checkWinnerAI(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function minimax(board, depth, isMaximizing) {
  const winner = checkWinnerAI(board);

  // Terminal states
  if (winner === "O") return 10 - depth; // AI wins
  if (winner === "X") return depth - 10; // Player wins
  if (board.every((cell) => cell !== null)) return 0; // Draw

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = "O";
        const score = minimax(board, depth + 1, false);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = "X";
        const score = minimax(board, depth + 1, true);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

function getBestMove(board) {
  let bestScore = -Infinity;
  let bestMove = null;

  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = "O";
      const score = minimax(board, 0, false);
      board[i] = null;

      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }

  return bestMove;
}

app.post("/api/ai-move", async (req, res) => {
  const { board, difficulty = "hard" } = req.body || {};
  if (!Array.isArray(board) || board.length !== 9)
    return res.status(400).json({ message: "Invalid board" });

  const emptyIdx = board
    .map((v, i) => (v === null ? i : null))
    .filter((x) => x !== null);
  if (emptyIdx.length === 0) return res.json({ move: null });
  try {
    let move;

    if (difficulty === "hard") {
      move = getBestMove([...board]);
      console.log(`🤖 AI (HARD): Calculated best move = ${move}`);
    } else if (difficulty === "medium" && model) {
      const boardState = board
        .map((cell, i) => {
          if (cell === null) return `${i}: empty`;
          return `${i}: ${cell}`;
        })
        .join(", ");
        
      const prompt = `You are playing Tic-Tac-Toe as O player. The current board state is: ${boardState}.
Available moves (empty cells): ${emptyIdx.join(", ")}.

Rules:
1. Prioritize winning moves (3 in a row for O)
2. Block opponent's winning moves (prevent X from getting 3 in a row)
3. Take center (4) if available
4. Take corners if available
5. Choose strategically

Respond with ONLY the cell number (0-8) you want to place O. No explanation, just the number.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      const aiMove = parseInt(text.match(/\d+/)?.[0]);

      if (aiMove >= 0 && aiMove <= 8 && emptyIdx.includes(aiMove)) {
        move = aiMove;
        console.log(`🤖 AI (MEDIUM): Gemini chose ${move}`);
      } else {
        move = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
        console.log(`🤖 AI (MEDIUM): Fallback random = ${move}`);
      }
    } else {
      // EASY MODE: Random
      move = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
      console.log(`🤖 AI (EASY): Random move = ${move}`);
    }

    res.json({ move, difficulty });
  } catch (error) {
    console.error("AI error:", error.message);
    const move = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
    res.json({ move });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
