const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn(
    " GEMINI_API_KEY tidak ditemukan. AI akan menggunakan random move."
  );
}
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI
  ? genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  : null;

const rooms = {};

app.get("/", (_req, res) => res.send(" Tic-Tac-Toe Realtime Server OK"));

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
  if (winner === "O") return 10 - depth;
  if (winner === "X") return depth - 10;
  if (board.every((cell) => cell !== null)) return 0;

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
      console.log(` AI (HARD): Calculated best move = ${move}`);
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
        console.log(` AI (MEDIUM): Gemini chose ${move}`);
      } else {
        move = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
        console.log(` AI (MEDIUM): Fallback random = ${move}`);
      }
    } else {
      move = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
      console.log(` AI (EASY): Random move = ${move}`);
    }

    res.json({ move, difficulty });
  } catch (error) {
    console.error("AI error:", error.message);
    const move = emptyIdx[Math.floor(Math.random() * emptyIdx.length)];
    res.json({ move });
  }
});

io.on("connection", (socket) => {
  console.log(`New socket connected: ${socket.id}`);

  socket.on("joinRoom", ({ roomId, playerName }) => {
    if (!roomId) return;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        board: Array(9).fill(null),
        turn: "X",
        players: [],
      };
      console.log(`Room ${roomId} created`);
    }

    const room = rooms[roomId];
    console.log(
      `Socket ${socket.id} trying to join room ${roomId}. Current players: ${room.players.length}`
    );

    // Check if this socket is already in the room (reconnection)
    const existingPlayerIdx = room.players.findIndex(
      (p) => p.socketId === socket.id
    );

    if (existingPlayerIdx !== -1) {
      // Player already exists, just rejoin the socket room
      console.log(`Socket ${socket.id} reconnecting to room ${roomId}`);
      socket.join(roomId);

      io.to(roomId).emit("playerJoined", {
        players: room.players.map((p) => ({
          name: p.name,
          socketId: p.socketId,
        })),
        turn: room.turn,
        board: room.board,
      });
      return;
    }

    // New player trying to join
    // Check if room is full (max 2 players)
    if (room.players.length >= 2) {
      console.log(`Room ${roomId} is FULL. Rejecting socket ${socket.id}`);
      socket.emit("error", {
        message: "Room sudah penuh! Maksimal 2 pemain per room.",
      });
      return;
    }

    const safeName =
      playerName?.trim() || `Player-${String(socket.id).slice(-4)}`;

    const nameTaken = room.players.some(
      (p) => p.name.toLowerCase() === safeName.toLowerCase()
    );
    if (nameTaken) {
      console.log(`Name ${safeName} already taken in room ${roomId}`);
      socket.emit("error", {
        message: "Nama sudah digunakan di room ini. Silakan ganti nama!",
      });
      return;
    }

    // Add new player
    room.players.push({ name: safeName, socketId: socket.id });
    socket.join(roomId);
    console.log(
      `Player ${safeName} joined room ${roomId}. Total players: ${room.players.length}`
    );

    io.to(roomId).emit("playerJoined", {
      players: room.players.map((p) => ({
        name: p.name,
        socketId: p.socketId,
      })),
      turn: room.turn,
      board: room.board,
    });
  });

  socket.on("makeMove", ({ roomId, index, symbol }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (index < 0 || index > 8) return;
    if (room.board[index]) return;
    if (symbol !== room.turn) return;

    room.board[index] = symbol;
    room.turn = symbol === "X" ? "O" : "X";

    const result = checkWinner(room.board);
    if (result) {
      const winnerSymbol = result.winner;
      const winnerPlayer = room.players[winnerSymbol === "X" ? 0 : 1];
      const winnerName = winnerPlayer?.name || winnerSymbol;

      io.to(roomId).emit("winner", {
        winner: winnerName,
        line: result.line,
      });

      setTimeout(() => {
        room.board = Array(9).fill(null);
        room.turn = "X";
        io.to(roomId).emit("resetGame", { board: room.board, turn: room.turn });
      }, 3000);
    } else if (room.board.every((c) => c !== null)) {
      io.to(roomId).emit("winner", { winner: "Draw" });
      setTimeout(() => {
        room.board = Array(9).fill(null);
        room.turn = "X";
        io.to(roomId).emit("resetGame", { board: room.board, turn: room.turn });
      }, 3000);
    } else {
      io.to(roomId).emit("boardUpdate", { board: room.board, turn: room.turn });
    }
  });

  socket.on("chatMessage", ({ roomId, playerName, message }) => {
    if (!roomId || !message?.trim()) return;
    io.to(roomId).emit("chatMessage", {
      playerName: playerName?.trim() || "Player",
      message: message.trim(),
    });
  });

  socket.on("leaderboardUpdate", ({ roomId, leaderboard }) => {
    if (!roomId || !leaderboard) return;
    io.to(roomId).emit("leaderboardUpdate", { leaderboard });
  });

  socket.on("leaderboardClear", ({ roomId }) => {
    if (!roomId) return;
    io.to(roomId).emit("leaderboardClear");
  });

  socket.on("resetGameRequest", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.board = Array(9).fill(null);
    room.turn = "X";
    io.to(roomId).emit("resetGame", { board: room.board, turn: room.turn });
  });

  socket.on("disconnecting", () => {
    // Get all rooms this socket is in
    const socketRooms = Array.from(socket.rooms);

    socketRooms.forEach((roomId) => {
      // Skip the default socket.id room
      if (roomId === socket.id) return;

      const room = rooms[roomId];
      if (!room) return;

      const playerIndex = room.players.findIndex(
        (p) => p.socketId === socket.id
      );

      if (playerIndex !== -1) {
        console.log(
          `Player ${room.players[playerIndex].name} leaving room ${roomId}`
        );
        room.players.splice(playerIndex, 1);

        // If room is empty, delete it
        if (room.players.length === 0) {
          console.log(`Room ${roomId} is empty, deleting...`);
          delete rooms[roomId];
        } else {
          // Notify remaining players
          io.to(roomId).emit("playerJoined", {
            players: room.players.map((p) => ({
              name: p.name,
              socketId: p.socketId,
            })),
            turn: room.turn,
            board: room.board,
          });
        }
      }
    });
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

function checkWinner(board) {
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
      return { winner: board[a], line: [a, b, c] };
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(` Server running at http://localhost:${PORT}`)
);
