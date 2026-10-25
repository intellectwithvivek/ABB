using Microsoft.AspNetCore.Mvc;
using TicTacToe.Api.Contracts.Responses;
using TicTacToe.Api.Mapping;
using TicTacToe.Core.Scoring;

namespace TicTacToe.Api.Controllers;

/// <summary>The server-wide scoreboard shared by every game.</summary>
[ApiController]
[Route("api/scoreboard")]
public sealed class ScoreboardController : ControllerBase
{
    private readonly IScoreboardService _scoreboard;

    public ScoreboardController(IScoreboardService scoreboard)
    {
        _scoreboard = scoreboard;
    }

    [HttpGet]
    [ProducesResponseType<ScoreboardDto>(StatusCodes.Status200OK)]
    public ScoreboardDto GetScoreboard() => ResponseMapper.ToScoreboard(_scoreboard.GetScores());

    /// <summary>
    /// Sets all counters to zero and returns the scoreboard read right after the reset:
    /// all zeroes, unless another game finished in between.
    /// </summary>
    [HttpPost("reset")]
    [ProducesResponseType<ScoreboardDto>(StatusCodes.Status200OK)]
    public ScoreboardDto ResetScoreboard()
    {
        _scoreboard.Reset();
        return ResponseMapper.ToScoreboard(_scoreboard.GetScores());
    }
}
