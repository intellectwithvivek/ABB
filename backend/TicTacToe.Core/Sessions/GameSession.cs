using TicTacToe.Core.Domain;
using TicTacToe.Core.Engine;
using TicTacToe.Core.Opponents;
using TicTacToe.Core.Scoring;

namespace TicTacToe.Core.Sessions;

/// <summary>
/// One game as the product defines it: its mode, the computer opponent, the undo policy (Option A)
/// and recording each finished game on the scoreboard exactly once.
/// The rules themselves live in <see cref="GameEngine"/>.
/// Not thread-safe on its own: callers lock <see cref="SyncRoot"/>.
/// </summary>
public sealed class GameSession
{
    // In VsComputer mode the human plays X (who always starts) and the computer plays O.
    private const Player Computer = Player.O;

    private readonly GameEngine _engine = new();
    private readonly IScoreboardService _scoreboard;
    private bool _resultRecorded;

    public GameSession(Guid id, GameMode mode, IScoreboardService scoreboard)
    {
        Id = id;
        Mode = mode;
        _scoreboard = scoreboard;
    }

    public Guid Id { get; }

    public GameMode Mode { get; }

    /// <summary>The API locks this object so concurrent requests for the same game run one at a time.</summary>
    public object SyncRoot { get; } = new();

    public Board Board => _engine.Board;

    public Player CurrentPlayer => _engine.CurrentPlayer;

    public GameStatus Status => _engine.Status;

    public Player? Winner => _engine.Winner;

    public IReadOnlyList<Position> WinningCells => _engine.WinningCells;

    public IReadOnlyList<Move> Moves => _engine.Moves;

    /// <summary>
    /// Computed here so the frontend never re-implements the rule: in progress and at least one move.
    /// </summary>
    public bool CanUndo => Status == GameStatus.InProgress && Moves.Count > 0;

    /// <summary>Plays the move and, in VsComputer mode, the computer's reply in the same call.</summary>
    /// <exception cref="GameRuleException">The move breaks a game rule; nothing changes.</exception>
    public void PlayMove(Player player, Position position)
    {
        _engine.ApplyMove(player, position);
        RecordResultIfFinished();

        // The computer never moves once the human's move has ended the game.
        if (Mode == GameMode.VsComputer && Status == GameStatus.InProgress)
        {
            _engine.ApplyMove(Computer, ComputerPlayer.ChooseMove(_engine.Board, Computer));
            RecordResultIfFinished();
        }
    }

    /// <exception cref="GameRuleException">The game has ended, or there are no moves to undo.</exception>
    public void Undo()
    {
        // Option A: a won or drawn game is final because its result is already on the scoreboard.
        if (Status != GameStatus.InProgress)
        {
            throw new GameRuleException(
                "Undo is not available after the game has ended. Reset the game to play again.");
        }

        _engine.UndoLastMove();

        // In VsComputer mode the human's move and the computer's reply are undone together,
        // so after an undo it is always the human's turn again.
        if (Mode == GameMode.VsComputer && _engine.CurrentPlayer == Computer)
        {
            _engine.UndoLastMove();
        }
    }

    /// <summary>Starts this game over with the same id and mode; the scoreboard is untouched.</summary>
    public void Reset()
    {
        _engine.Reset();
        _resultRecorded = false;
    }

    // Explicit "exactly once per game" guard. A finished game already rejects moves and undo,
    // but the scoreboard rule should not depend on that indirectly.
    private void RecordResultIfFinished()
    {
        if (Status == GameStatus.InProgress || _resultRecorded)
        {
            return;
        }

        if (Winner is Player winner)
        {
            _scoreboard.RecordWin(winner);
        }
        else
        {
            _scoreboard.RecordDraw();
        }

        _resultRecorded = true;
    }
}
