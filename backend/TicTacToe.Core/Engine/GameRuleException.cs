namespace TicTacToe.Core.Engine;

/// <summary>
/// A request broke a game rule (for example, playing an occupied cell).
/// The message is written for the player; the API returns it in a 400 Bad Request.
/// </summary>
public sealed class GameRuleException : Exception
{
    public GameRuleException(string message)
        : base(message)
    {
    }
}
