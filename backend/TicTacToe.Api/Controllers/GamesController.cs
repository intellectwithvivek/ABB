using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TicTacToe.Api.Application;
using TicTacToe.Api.Configuration;
using TicTacToe.Api.Contracts.Requests;
using TicTacToe.Api.Contracts.Responses;
using TicTacToe.Core.Domain;

namespace TicTacToe.Api.Controllers;

/// <summary>
/// Game endpoints. The actions only translate HTTP to <see cref="GameService"/> calls. Rule violations and
/// unknown ids surface as exceptions that GameExceptionHandler turns into 400/404 problem+json, so each
/// action describes only the success path; [ProducesResponseType] documents the rest for Swagger.
/// </summary>
// [ApiController] reads complex parameters from the JSON body without [FromBody] and answers 400
// with a ValidationProblemDetails automatically when the body is missing or malformed.
[ApiController]
[Route("api/games")]
public sealed class GamesController : ControllerBase
{
    private readonly GameService _gameService;

    public GamesController(GameService gameService)
    {
        _gameService = gameService;
    }

    // Every game is kept in memory, so creating one also counts against the lower per-client create-game limit.
    [HttpPost]
    [EnableRateLimiting(RateLimitingOptions.CreateGamePolicy)]
    [ProducesResponseType<GameStateResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public ActionResult<GameStateResponse> CreateGame(CreateGameRequest request)
    {
        var game = _gameService.CreateGame(request.Mode);

        // 201 Created with a Location header pointing at GET /api/games/{id}.
        return CreatedAtAction(nameof(GetGame), new { id = game.GameId }, game);
    }

    // {id:guid} is a route constraint: an id that is not a GUID never reaches the action.
    [HttpGet("{id:guid}")]
    [ProducesResponseType<GameStateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public GameStateResponse GetGame(Guid id) => _gameService.GetGame(id);

    /// <summary>Plays a move; in VsComputer mode the response already contains the computer's reply.</summary>
    [HttpPost("{id:guid}/moves")]
    [ProducesResponseType<GameStateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public GameStateResponse SubmitMove(Guid id, SubmitMoveRequest request) =>
        _gameService.SubmitMove(id, request.Player, new Position(request.Row, request.Col));

    /// <summary>
    /// Undoes the last move (in VsComputer mode, the computer's reply and the human's move together).
    /// </summary>
    [HttpPost("{id:guid}/undo")]
    [ProducesResponseType<GameStateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public GameStateResponse Undo(Guid id) => _gameService.Undo(id);

    /// <summary>Starts the game over with the same id and mode; the scoreboard is unchanged.</summary>
    [HttpPost("{id:guid}/reset")]
    [ProducesResponseType<GameStateResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public GameStateResponse Reset(Guid id) => _gameService.Reset(id);
}
