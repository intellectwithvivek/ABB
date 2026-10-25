namespace TicTacToe.Core.Scoring;

/// <summary>An immutable copy of the scoreboard totals at one moment.</summary>
public sealed record ScoreSnapshot(int XWins, int OWins, int Draws);
