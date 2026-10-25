using TicTacToe.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddTicTacToeApi(builder.Configuration);

var app = builder.Build();
app.UseTicTacToeApi();
app.Run();

// Top-level statements generate an internal Program class; making it public lets the tests
// start the real app in memory with WebApplicationFactory<Program>.
public partial class Program;
