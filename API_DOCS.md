# Tic-Tac-Toe Realtime API Documentation

## Base URL

```
http://localhost:3000
```

## Endpoints

List of available endpoints:

**REST API:**

- `GET /`
- `POST /api/ai-move`

**Socket.IO Events:**

Client to Server:

- `joinRoom`
- `makeMove`
- `chatMessage`
- `leaderboardUpdate`
- `leaderboardClear`
- `resetGameRequest`
- `disconnect`
- `disconnecting`

Server to Client:

- `playerJoined`
- `boardUpdate`
- `winner`
- `resetGame`
- `chatMessage`
- `leaderboardUpdate`
- `leaderboardClear`
- `error`

---

## REST API Endpoints

### 1. GET /

Description:

- Health check endpoint to verify server is running

Request:

- No parameters required

Response (200 - OK)

```json
" Tic-Tac-Toe Realtime Server OK"
```

---

### 2. POST /api/ai-move

Description:

- Get AI move suggestion for Tic-Tac-Toe game
- Supports three difficulty levels: easy, medium, hard
- Hard mode uses minimax algorithm
- Medium mode uses Google Gemini AI (requires GEMINI_API_KEY)
- Easy mode uses random move

Request:

- body:

```json
{
  "board": ["X", null, "O", null, "X", null, null, null, null],
  "difficulty": "hard"
}
```

| Field      | Type   | Required | Description                                                        |
| ---------- | ------ | -------- | ------------------------------------------------------------------ |
| board      | array  | Yes      | Array of 9 elements representing board state (null, "X", or "O")   |
| difficulty | string | No       | AI difficulty level: "easy", "medium", or "hard" (default: "hard") |

Response (200 - OK)

```json
{
  "move": 4,
  "difficulty": "hard"
}
```

| Field      | Type   | Description                                                                        |
| ---------- | ------ | ---------------------------------------------------------------------------------- |
| move       | number | Index (0-8) where AI suggests placing the next move, or null if no moves available |
| difficulty | string | The difficulty level used                                                          |

Response (400 - Bad Request)

```json
{
  "message": "Invalid board"
}
```

Response (500 - Internal Server Error)

```json
{
  "move": 4
}
```

_Note: On error, AI falls back to random move_

---

## Socket.IO Events

### Connection

Connect to the Socket.IO server:

```javascript
const socket = io("http://localhost:3000");
```

---

### Client to Server Events

#### 1. joinRoom

Description:

- Join or create a game room
- Maximum 2 players per room
- Player names must be unique within a room

Emit:

```javascript
socket.emit("joinRoom", {
  roomId: "room123",
  playerName: "Alice",
});
```

| Field      | Type   | Required | Description           |
| ---------- | ------ | -------- | --------------------- |
| roomId     | string | Yes      | Room identifier       |
| playerName | string | Yes      | Player's display name |

---

#### 2. makeMove

Description:

- Make a move on the board
- Validates turn and board state
- Automatically checks for winner or draw

Emit:

```javascript
socket.emit("makeMove", {
  roomId: "room123",
  index: 4,
  symbol: "X",
});
```

| Field  | Type   | Required | Description                |
| ------ | ------ | -------- | -------------------------- |
| roomId | string | Yes      | Room identifier            |
| index  | number | Yes      | Board position (0-8)       |
| symbol | string | Yes      | Player symbol ("X" or "O") |

---

#### 3. chatMessage

Description:

- Send a chat message to all players in the room

Emit:

```javascript
socket.emit("chatMessage", {
  roomId: "room123",
  playerName: "Alice",
  message: "Good game!",
});
```

| Field      | Type   | Required | Description          |
| ---------- | ------ | -------- | -------------------- |
| roomId     | string | Yes      | Room identifier      |
| playerName | string | Yes      | Sender's name        |
| message    | string | Yes      | Chat message content |

---

#### 4. leaderboardUpdate

Description:

- Update the leaderboard for the room

Emit:

```javascript
socket.emit("leaderboardUpdate", {
  roomId: "room123",
  leaderboard: [
    { name: "Alice", wins: 5 },
    { name: "Bob", wins: 3 },
  ],
});
```

| Field       | Type   | Required | Description                |
| ----------- | ------ | -------- | -------------------------- |
| roomId      | string | Yes      | Room identifier            |
| leaderboard | array  | Yes      | Array of player statistics |

---

#### 5. leaderboardClear

Description:

- Clear the leaderboard for the room

Emit:

```javascript
socket.emit("leaderboardClear", {
  roomId: "room123",
});
```

| Field  | Type   | Required | Description     |
| ------ | ------ | -------- | --------------- |
| roomId | string | Yes      | Room identifier |

---

#### 6. resetGameRequest

Description:

- Request to reset the game board and turn

Emit:

```javascript
socket.emit("resetGameRequest", {
  roomId: "room123",
});
```

| Field  | Type   | Required | Description     |
| ------ | ------ | -------- | --------------- |
| roomId | string | Yes      | Room identifier |

---

### Server to Client Events

#### 1. playerJoined

Description:

- Sent when a player joins or leaves the room
- Contains current room state

Listen:

```javascript
socket.on("playerJoined", (data) => {
  console.log(data);
});
```

Response:

```json
{
  "players": [
    { "name": "Alice", "socketId": "abc123" },
    { "name": "Bob", "socketId": "def456" }
  ],
  "turn": "X",
  "board": [null, null, null, null, null, null, null, null, null]
}
```

| Field   | Type   | Description                 |
| ------- | ------ | --------------------------- |
| players | array  | List of players in the room |
| turn    | string | Current turn ("X" or "O")   |
| board   | array  | Current board state         |

---

#### 2. boardUpdate

Description:

- Sent after each valid move
- Contains updated board state and turn

Listen:

```javascript
socket.on("boardUpdate", (data) => {
  console.log(data);
});
```

Response:

```json
{
  "board": ["X", null, "O", null, "X", null, null, null, null],
  "turn": "O"
}
```

| Field | Type   | Description         |
| ----- | ------ | ------------------- |
| board | array  | Updated board state |
| turn  | string | Next player's turn  |

---

#### 3. winner

Description:

- Sent when game ends (winner or draw)
- Game automatically resets after 3 seconds

Listen:

```javascript
socket.on("winner", (data) => {
  console.log(data);
});
```

Response (Winner):

```json
{
  "winner": "Alice",
  "line": [0, 1, 2]
}
```

Response (Draw):

```json
{
  "winner": "Draw"
}
```

| Field  | Type   | Description                                     |
| ------ | ------ | ----------------------------------------------- |
| winner | string | Winner's name or "Draw"                         |
| line   | array  | Winning line indices (only if there's a winner) |

---

#### 4. resetGame

Description:

- Sent when game is reset (automatically or by request)
- Contains fresh board state

Listen:

```javascript
socket.on("resetGame", (data) => {
  console.log(data);
});
```

Response:

```json
{
  "board": [null, null, null, null, null, null, null, null, null],
  "turn": "X"
}
```

| Field | Type   | Description                |
| ----- | ------ | -------------------------- |
| board | array  | Fresh board (all null)     |
| turn  | string | Starting turn (always "X") |

---

#### 5. chatMessage

Description:

- Sent when a player sends a chat message

Listen:

```javascript
socket.on("chatMessage", (data) => {
  console.log(data);
});
```

Response:

```json
{
  "playerName": "Alice",
  "message": "Good game!"
}
```

| Field      | Type   | Description           |
| ---------- | ------ | --------------------- |
| playerName | string | Message sender's name |
| message    | string | Message content       |

---

#### 6. leaderboardUpdate

Description:

- Sent when leaderboard is updated

Listen:

```javascript
socket.on("leaderboardUpdate", (data) => {
  console.log(data);
});
```

Response:

```json
{
  "leaderboard": [
    { "name": "Alice", "wins": 5 },
    { "name": "Bob", "wins": 3 }
  ]
}
```

| Field       | Type  | Description              |
| ----------- | ----- | ------------------------ |
| leaderboard | array | Updated leaderboard data |

---

#### 7. leaderboardClear

Description:

- Sent when leaderboard is cleared

Listen:

```javascript
socket.on("leaderboardClear", () => {
  console.log("Leaderboard cleared");
});
```

Response:

```json
{}
```

---

#### 8. error

Description:

- Sent when an error occurs (e.g., room full, name taken)

Listen:

```javascript
socket.on("error", (data) => {
  console.error(data.message);
});
```

Response:

```json
{
  "message": "Room sudah penuh! Maksimal 2 pemain per room."
}
```

| Field   | Type   | Description               |
| ------- | ------ | ------------------------- |
| message | string | Error message description |

---

## Environment Variables

Required environment variables:

| Variable       | Required | Description                                               |
| -------------- | -------- | --------------------------------------------------------- |
| PORT           | No       | Server port (default: 3000)                               |
| GEMINI_API_KEY | No       | Google Gemini API key for medium difficulty AI (optional) |

---

## Game Rules

1. **Board**: 3x3 grid with indices 0-8 (left-to-right, top-to-bottom)
2. **Players**: 2 players per room, one plays "X", other plays "O"
3. **Turns**: Players alternate turns starting with "X"
4. **Winning**: First player to get 3 in a row (horizontal, vertical, or diagonal) wins
5. **Draw**: If board is full with no winner, game ends in draw
6. **Auto-reset**: Game automatically resets 3 seconds after win/draw

---

## Example Client Implementation

```javascript
const io = require("socket.io-client");
const socket = io("http://localhost:3000");

// Join a room
socket.emit("joinRoom", {
  roomId: "room123",
  playerName: "Alice",
});

// Listen for player join
socket.on("playerJoined", (data) => {
  console.log("Players:", data.players);
  console.log("Current turn:", data.turn);
});

// Make a move
socket.emit("makeMove", {
  roomId: "room123",
  index: 4, // center position
  symbol: "X",
});

// Listen for board updates
socket.on("boardUpdate", (data) => {
  console.log("Board:", data.board);
  console.log("Next turn:", data.turn);
});

// Listen for winner
socket.on("winner", (data) => {
  console.log("Winner:", data.winner);
  if (data.line) {
    console.log("Winning line:", data.line);
  }
});

// Send chat message
socket.emit("chatMessage", {
  roomId: "room123",
  playerName: "Alice",
  message: "Good game!",
});

// Listen for chat messages
socket.on("chatMessage", (data) => {
  console.log(`${data.playerName}: ${data.message}`);
});

// Handle errors
socket.on("error", (data) => {
  console.error("Error:", data.message);
});
```

---

## Error Handling

Common error scenarios:

1. **Room Full**: Maximum 2 players per room

   ```json
   { "message": "Room sudah penuh! Maksimal 2 pemain per room." }
   ```

2. **Name Taken**: Player name already exists in room

   ```json
   { "message": "Nama sudah digunakan di room ini. Silakan ganti nama!" }
   ```

3. **Invalid Board**: Board array is invalid (for AI endpoint)

   ```json
   { "message": "Invalid board" }
   ```

4. **Invalid Move**: Move is rejected if:
   - Index is out of bounds (not 0-8)
   - Cell is already occupied
   - Wrong player's turn
   - Room doesn't exist
