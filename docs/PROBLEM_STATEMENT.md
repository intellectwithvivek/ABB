# Round 2 — Problem Statement

> Faithful Markdown transcription of the assessment brief as it was shared. The original Word document is kept alongside it: [Round-2-Problem-Statement.docx](assets/Round-2-Problem-Statement.docx).

## Problem Statement

- Build a browser-based Tic Tac Toe application with an Angular frontend and a .NET backend running locally.
- The application should allow users to play Tic Tac Toe, track moves, undo moves, maintain a scoreboard, and support a basic computer opponent mode.

The solution should be easy for the panel to run, review, and discuss.

## Technology Expectations

Use the following stack:

- Frontend: Angular + TypeScript
- Backend: .NET Web API
- API Style: REST API
- Storage: In-memory storage is acceptable; SQLite may be used if preferred
- Source Control: GitHub

The Angular application should communicate with the .NET backend through REST APIs.
The backend should manage the game session and scoreboard state.

## Functional Requirements

### 1. Game Board

- Create a standard 3 × 3 Tic Tac Toe board.
- Each cell should be clickable when it is empty.
- Once a move is made, the selected cell should display either X or O.
- A selected cell should remain locked for the rest of the current game state.

### 2. Player Turns

- The game should support two players:
  - Player X
  - Player O
- The application should clearly display whose turn it is.
- Players should alternate turns after every valid move.
- Invalid moves should not change the current turn.

### 3. Win Detection

- The application should detect a winner when a player completes:
  - One full row
  - One full column
  - One diagonal
- When a player wins, the application should:
  - Show the winning player
  - Highlight the winning cells
  - Prevent additional moves for the completed game
  - Update the scoreboard

### 4. Draw Detection

- If all 9 cells are filled and there is no winner, the game should be marked as a draw.
- When the game is drawn, the application should:
  - Show a draw message
  - Prevent additional moves for the completed game
  - Update the scoreboard

### 5. Reset Game

- Provide a Reset Game option. Reset Game should:
  - Clear the current board
  - Clear the move history
  - Clear winner or draw status
  - Set the current player back to X
  - Start a fresh game session
  - Keep the scoreboard unchanged

## Must-Have

### 1. Move History

- The application should display move history for the current game.
- For each move, show:
  - Move number
  - Player
  - Cell position
- Example:

  | Move | Player | Position |
  |---|---|---|
  | 1 | X | Row 1, Column 1 |
  | 2 | O | Row 2, Column 2 |

- The move history should update after every valid move.

### 2. Undo Last Move

- Provide an Undo Last Move option.
- Undo should restore the game to the previous valid state.
- Undo should:
  - Remove the latest move or move pair based on the selected game mode
  - Restore the board
  - Restore the correct player turn
  - Recalculate win or draw status
  - Keep the move history accurate
- Undo should be disabled when there are no moves to undo.

#### Undo Behavior by Mode

- In Two Player Mode, Undo should remove only the most recent move.
  - Example:
    - X plays
    - O plays
    - User clicks Undo
    - O’s move is removed
    - It is O’s turn again
- In Computer Mode, Undo should remove the computer’s last move and the human player’s previous move together.
  - Example:
    - X plays
    - O computer plays
    - User clicks Undo
    - Both O’s move and the previous X move are removed
    - It is X’s turn again

### 3. Scoreboard

- Maintain a session-level scoreboard.
- Track:
  - X wins
  - O wins
  - Draws
- The scoreboard should update when a game is completed.
- The scoreboard should update only once for a completed game.
- Reset Game should keep the scoreboard unchanged.
- Provide a separate Reset Scoreboard option.
- The scoreboard should be served by the backend.

### 4. Basic Computer Mode

Provide two game modes:

- Two Player Mode
- Play Against Computer

In Two Player Mode, both X and O are controlled by users.

In Computer Mode:

- Human player is X
- Computer player is O
- Computer should make a move automatically after the human move
- Computer should make only valid moves
- Computer should not move after the game is already completed
- The computer move logic should follow this priority:
  1. If O can win, play the winning move
  2. If X can win next, block X
  3. Take center if available
  4. Take a corner if available
  5. Take any available cell

## Backend Requirements

- The .NET backend should expose REST APIs for game operations.
- The backend should own the game session state, move history, game status, and scoreboard.

### Suggested API Scope

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/games | Create a new game session |
| GET | /api/games/{id} | Get current game state |
| POST | /api/games/{id}/moves | Submit a player move |
| POST | /api/games/{id}/undo | Undo last move |
| POST | /api/games/{id}/reset | Reset the current game |
| GET | /api/scoreboard | Get scoreboard |
| POST | /api/scoreboard/reset | Reset scoreboard |

- The exact endpoint names can vary, but the submitted solution should clearly document the API contract.

### Game State Response

- The backend should return enough information for the frontend to render the game correctly.
- A game state response should include:
  - Game ID
  - Board state
  - Current player
  - Game mode
  - Game status
  - Winner, if any
  - Winning cells, if any
  - Move history
  - Scoreboard or a way to retrieve scoreboard
- Example game statuses:
  - InProgress
  - Won
  - Draw

### Move Request

- When the frontend submits a move, the request should include:
  - Game ID
  - Player
  - Row and column, or cell index
- The backend should validate the move.
- The backend should reject invalid moves such as:
  - Move outside the board
  - Move on an occupied cell
  - Move after game completion
  - Move by the wrong player

## Frontend Requirements

- The Angular application should provide a clean and usable interface.
- The UI should show:
  - Game board
  - Current player
  - Selected game mode
  - Winner or draw message
  - Highlighted winning cells
  - Move history
  - Scoreboard
  - Reset Game button
  - Undo Last Move button
  - Reset Scoreboard button
- The frontend should call the backend APIs for game actions and render the latest state returned by the backend.
- The UI should be responsive enough to use comfortably on a laptop browser.

## Important Clarifications

### Clarification 1: Backend State Ownership

- The backend should be the source of truth for the current game state.
- The frontend may maintain UI state, but game rules, move validation, game status, move history, and scoreboard should be consistent with the backend response.

### Clarification 2: Scoreboard and Undo

- The scoreboard should remain consistent after game completion.
- Use one of the following approaches and mention the choice in the README:

**Option A: Disable Undo After Completion**

- Once a game is won or drawn, Undo is disabled.
- The scoreboard remains final for that game.

**Option B: Allow Undo After Completion**

- Undo can be used after a game is completed.
- If the completed result is reversed through Undo, the scoreboard should also be adjusted correctly.

## Testing Expectations

- Include tests for the core game logic.
- At minimum, cover:
  - Valid move
  - Invalid move
  - Turn switching
  - Row win
  - Column win
  - Diagonal win
  - Draw
  - Reset game
  - Undo in two-player mode
  - Undo in computer mode
  - Scoreboard update
  - Computer move selection
  - Move after game completion
- Backend unit tests are preferred for game rules and state transitions.
- Frontend tests may cover component rendering and API integration points.

## AI-Assisted Development Expectation

- You may use AI-assisted development tools to build the solution.
- During submission and review, be prepared to explain:
  - How you converted the requirement into a specification
  - What prompts you used
  - What the AI generated
  - What you changed manually
  - Which parts you reviewed carefully
  - What assumptions you made
  - What trade-offs you chose
- The final submission should reflect your own understanding and engineering judgment.

## README Expectations

Your GitHub repository should include a clear README with:

- Project overview
- Tech stack
- Features implemented
- How to run the backend locally
- How to run the frontend locally
- API endpoint summary
- How to run tests
- AI tools and prompt summary
- Design decisions
- Clarifications and assumptions
- Known limitations
- Future improvements

## Submission Requirements

Submit a GitHub repository containing:

- Angular frontend source code
- .NET backend source code
- README.md
- Setup and run instructions
- Test instructions
- Prompt summary or AI workflow notes
- API documentation or endpoint summary
- Known assumptions and limitations

## Acceptance Criteria

The exercise is considered complete when:

- The Angular application runs locally
- The .NET API runs locally
- The frontend communicates with the backend through REST APIs
- A new Tic Tac Toe game can be created
- Two Player Mode works correctly
- Computer Mode works correctly
- Turns alternate correctly
- Invalid moves are handled correctly
- Win detection works
- Draw detection works
- Winning cells are highlighted
- Move history is shown
- Undo works according to the selected mode
- Scoreboard works correctly
- Reset Game works correctly
- Reset Scoreboard works correctly
- Basic tests are included
- README explains how to run and review the solution
- Candidate can explain the implementation during panel review
