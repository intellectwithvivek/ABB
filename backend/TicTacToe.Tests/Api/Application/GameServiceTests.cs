using TicTacToe.Api.Application;
using TicTacToe.Api.Contracts.Responses;
using TicTacToe.Api.Infrastructure.Persistence;
using TicTacToe.Core.Domain;
using TicTacToe.Core.Engine;
using TicTacToe.Core.Scoring;
using TicTacToe.Tests.TestSupport;

namespace TicTacToe.Tests.Api.Application;

/// <summary>
/// The application service with the real in-memory repository and scoreboard (no mocks):
/// unknown ids, mapping of game state to the response and locking per game.
/// </summary>
public sealed class GameServiceTests
{
    private readonly Scoreboard _scoreboard = new();
    private readonly GameService _service;

    public GameServiceTests()
    {
        _service = new GameService(new InMemoryGameRepository(TimeProvider.System), _scoreboard);
    }

    [Fact]
    public void CreateGame_VsComputer_ReturnsEmptyGameWithXToMove()
    {
        // VsComputer, because TwoPlayer is the enum's default value and would pass even if the mode were not mapped.
        var game = _service.CreateGame(GameMode.VsComputer);

        Assert.NotEqual(Guid.Empty, game.GameId);
        Assert.Equal(GameMode.VsComputer, game.Mode);
        Assert.Equal(3, game.Board.Count);
        Assert.All(game.Board, row => Assert.Equal([null, null, null], row));
        Assert.Equal(Player.X, game.CurrentPlayer);
        Assert.Equal(GameStatus.InProgress, game.Status);
        Assert.Null(game.Winner);
        Assert.Empty(game.WinningCells);
        Assert.Empty(game.MoveHistory);
        Assert.False(game.CanUndo);
        Assert.Equal(new ScoreboardDto(0, 0, 0), game.Scoreboard);
    }

    [Fact]
    public void GetGame_CreatedGame_ReturnsSameGame()
    {
        var created = _service.CreateGame(GameMode.TwoPlayer);

        var game = _service.GetGame(created.GameId);

        Assert.Equal(created.GameId, game.GameId);
        Assert.Equal(GameMode.TwoPlayer, game.Mode);
    }

    [Fact]
    public void GameOperations_UnknownId_ThrowGameNotFound()
    {
        var unknownId = Guid.NewGuid();

        var exception = Assert.Throws<GameNotFoundException>(() => _service.GetGame(unknownId));
        Assert.Equal($"Game '{unknownId}' was not found.", exception.Message);
        Assert.Throws<GameNotFoundException>(() => _service.SubmitMove(unknownId, Player.X, new Position(0, 0)));
        Assert.Throws<GameNotFoundException>(() => _service.Undo(unknownId));
        Assert.Throws<GameNotFoundException>(() => _service.Reset(unknownId));
    }

    [Fact]
    public void SubmitMove_ValidMove_MapsBoardHistoryAndTurn()
    {
        var gameId = _service.CreateGame(GameMode.TwoPlayer).GameId;

        var game = _service.SubmitMove(gameId, Player.X, new Position(1, 2));

        Assert.Equal([null, null, null], game.Board[0]);
        Assert.Equal([null, null, Player.X], game.Board[1]);
        Assert.Equal([null, null, null], game.Board[2]);
        Assert.Equal(new MoveDto(1, Player.X, 1, 2), Assert.Single(game.MoveHistory));
        Assert.Equal(Player.O, game.CurrentPlayer);
        Assert.True(game.CanUndo);
    }

    [Fact]
    public void SubmitMove_WinningMove_MapsWinnerWinningCellsAndScoreboard()
    {
        var gameId = _service.CreateGame(GameMode.TwoPlayer).GameId;

        var game = Play(gameId, TestGames.XWinsOnTopRow);

        Assert.Equal(GameStatus.Won, game.Status);
        Assert.Equal(Player.X, game.Winner);
        Assert.Equal([new CellDto(0, 0), new CellDto(0, 1), new CellDto(0, 2)], game.WinningCells);
        Assert.False(game.CanUndo);
        Assert.Equal(new ScoreboardDto(XWins: 1, OWins: 0, Draws: 0), game.Scoreboard);
    }

    [Fact]
    public void SubmitMove_VsComputer_ResponseIncludesComputerReply()
    {
        var gameId = _service.CreateGame(GameMode.VsComputer).GameId;

        var game = _service.SubmitMove(gameId, Player.X, new Position(0, 0));

        Assert.Equal(
            [new MoveDto(1, Player.X, 0, 0), new MoveDto(2, Player.O, 1, 1)],
            game.MoveHistory);
        Assert.Equal(Player.X, game.CurrentPlayer);
    }

    [Fact]
    public void Undo_VsComputer_RemovesBothMovesAndReturnsXToMove()
    {
        var gameId = _service.CreateGame(GameMode.VsComputer).GameId;
        _service.SubmitMove(gameId, Player.X, new Position(0, 0));

        var game = _service.Undo(gameId);

        Assert.Empty(game.MoveHistory);
        Assert.All(game.Board, row => Assert.Equal([null, null, null], row));
        Assert.Equal(Player.X, game.CurrentPlayer);
        Assert.False(game.CanUndo);
    }

    [Fact]
    public void Reset_AfterWin_KeepsIdAndModeAndScoreboard()
    {
        var gameId = _service.CreateGame(GameMode.TwoPlayer).GameId;
        Play(gameId, TestGames.XWinsOnTopRow);

        var game = _service.Reset(gameId);

        Assert.Equal(gameId, game.GameId);
        Assert.Equal(GameMode.TwoPlayer, game.Mode);
        Assert.Empty(game.MoveHistory);
        Assert.Equal(Player.X, game.CurrentPlayer);
        Assert.Equal(GameStatus.InProgress, game.Status);
        Assert.Equal(new ScoreboardDto(XWins: 1, OWins: 0, Draws: 0), game.Scoreboard);
    }

    [Fact]
    public void GetGame_AfterAnotherGameEnded_ReturnsSharedScoreboard()
    {
        var watchingGameId = _service.CreateGame(GameMode.TwoPlayer).GameId;
        var finishedGameId = _service.CreateGame(GameMode.TwoPlayer).GameId;
        Play(finishedGameId, TestGames.XWinsOnTopRow);

        var game = _service.GetGame(watchingGameId);

        Assert.Equal(new ScoreboardDto(XWins: 1, OWins: 0, Draws: 0), game.Scoreboard);
    }

    [Fact]
    public async Task SubmitMove_ParallelMovesToSameCell_ExactlyOneSucceeds()
    {
        const int parallelRequests = 50;
        var gameId = _service.CreateGame(GameMode.TwoPlayer).GameId;

        var accepted = await Task.WhenAll(Enumerable.Range(0, parallelRequests)
            .Select(_ => Task.Run(() => TrySubmitMove(gameId, Player.X, new Position(0, 0)))));

        // Without the per-game lock, two requests could both pass validation and corrupt the board or history.
        Assert.Single(accepted, wasAccepted => wasAccepted);
        var game = _service.GetGame(gameId);
        Assert.Equal(new MoveDto(1, Player.X, 0, 0), Assert.Single(game.MoveHistory));
        Assert.Equal(Player.O, game.CurrentPlayer);
    }

    [Fact]
    public async Task Undo_ParallelRequests_RemoveEachPairExactlyOnce()
    {
        const int parallelRequests = 32;
        var gameId = _service.CreateGame(GameMode.VsComputer).GameId;
        Play(gameId, new Position(0, 0), new Position(2, 2), new Position(2, 0)); // 3 pairs: X and the computer's reply

        var accepted = await Task.WhenAll(Enumerable.Range(0, parallelRequests)
            .Select(_ => Task.Run(() => TryUndo(gameId))));

        // Three undos remove the three pairs; every other request finds nothing left to undo.
        Assert.Equal(3, accepted.Count(wasAccepted => wasAccepted));
        Assert.Empty(_service.GetGame(gameId).MoveHistory);
    }

    [Fact]
    public async Task GetGame_WhileVsComputerMovesArePlayed_NeverSeesMoveWithoutReply()
    {
        var gameId = _service.CreateGame(GameMode.VsComputer).GameId;
        using var playerDone = new CancellationTokenSource();

        var player = Task.Run(() =>
        {
            try
            {
                for (var round = 0; round < 500; round++)
                {
                    PlayFirstFreeCellsUntilOver(gameId);
                    _service.Reset(gameId);
                }
            }
            finally
            {
                playerDone.Cancel();
            }
        });
        var readers = Enumerable.Range(0, 4).Select(_ => Task.Run(() =>
        {
            while (!playerDone.IsCancellationRequested)
            {
                var game = _service.GetGame(gameId);

                // An odd number of moves in a game in progress would be the human's move without
                // the computer's reply.
                Assert.False(game.Status == GameStatus.InProgress && game.MoveHistory.Count % 2 == 1);
            }
        }));

        await Task.WhenAll([player, .. readers]);
    }

    // Each move is made by whoever's turn it is, so a test only lists the cells.
    private GameStateResponse Play(Guid gameId, params Position[] positions)
    {
        var game = _service.GetGame(gameId);
        foreach (var position in positions)
        {
            game = _service.SubmitMove(gameId, game.CurrentPlayer, position);
        }

        return game;
    }

    private void PlayFirstFreeCellsUntilOver(Guid gameId)
    {
        var game = _service.GetGame(gameId);
        while (game.Status == GameStatus.InProgress)
        {
            var freeCell = Board.AllPositions.First(position => game.Board[position.Row][position.Col] is null);
            game = _service.SubmitMove(gameId, Player.X, freeCell);
        }
    }

    private bool TryUndo(Guid gameId)
    {
        try
        {
            _service.Undo(gameId);
            return true;
        }
        catch (GameRuleException)
        {
            return false;
        }
    }

    private bool TrySubmitMove(Guid gameId, Player player, Position position)
    {
        try
        {
            _service.SubmitMove(gameId, player, position);
            return true;
        }
        catch (GameRuleException)
        {
            return false;
        }
    }
}
