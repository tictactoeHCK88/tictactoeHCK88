require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => res.send("Tic-Tac-Toe Realtime Server OK"));

io.on("connection", (socket) => {
  // Join Room
  socket.on("joinRoom", ({ roomId, playerName }) => {
    if (!roomId) return;
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        board: Array(9).fill(null),
        turn: "X",
        players: [],
      };
    }

    const room = rooms[roomId];

    const existingPlayerIdx = room.players.findIndex(
      (p) => p.socketId === socket.id
    );
    if (existingPlayerIdx === -1) {
      const safeName =
        playerName?.trim() || `Player-${String(socket.id).slice(-4)}`;

      const nameTaken = room.players.some(
        (p) => p.name.toLowerCase() === safeName.toLowerCase()
      );
      if (nameTaken) {
        socket.emit("error", {
          message: "Nama sudah digunakan di room ini. Silakan ganti nama!",
        });
        return;
      }

      room.players.push({ name: safeName, socketId: socket.id });
    }
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
