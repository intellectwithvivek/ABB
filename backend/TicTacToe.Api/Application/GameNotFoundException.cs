namespace TicTacToe.Api.Application;

/// <summary>No game has the requested id. The API returns it as 404 Not Found.</summary>
public sealed class GameNotFoundException : Exception
{
    public GameNotFoundException(Guid gameId)
        : base($"Game '{gameId}' was not found.")
    {
    }
}
