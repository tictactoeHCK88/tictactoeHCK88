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
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
