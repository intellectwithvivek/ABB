using TicTacToe.Core.Domain;

namespace TicTacToe.Tests.Core.Domain;

public sealed class PlayerExtensionsTests
{
    [Theory]
    [InlineData(Player.X, Player.O)]
    [InlineData(Player.O, Player.X)]
    public void Opponent_EitherPlayer_ReturnsTheOtherOne(Player player, Player expected)
    {
        Assert.Equal(expected, player.Opponent());
    }
}
