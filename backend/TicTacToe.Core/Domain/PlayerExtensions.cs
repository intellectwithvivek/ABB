namespace TicTacToe.Core.Domain;

// C# enums cannot declare methods (unlike Java enums), so an extension method adds player.Opponent().
public static class PlayerExtensions
{
    public static Player Opponent(this Player player) => player == Player.X ? Player.O : Player.X;
}
