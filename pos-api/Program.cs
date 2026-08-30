using Microsoft.EntityFrameworkCore;
using pos_api.Data;
using pos_api.Hubs;
using pos_api.Models;
using pos_api.Services;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// Add services
builder.Services.AddOpenApi();
builder.Services.AddSignalR();

// Configure CORS for Next.js frontend (pos-web)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure Database: PostgreSQL if connection string is configured, otherwise InMemory for zero-setup
var postgresConn = builder.Configuration.GetConnectionString("PostgresConnection");
if (!string.IsNullOrEmpty(postgresConn))
{
    builder.Services.AddDbContext<PosDbContext>(opt =>
        opt.UseNpgsql(postgresConn));
}
else
{
    builder.Services.AddDbContext<PosDbContext>(opt =>
        opt.UseInMemoryDatabase("PosInMemoryDb"));
}

// Register Application Services
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<IThermalPrinterService, ThermalPrinterService>();
builder.Services.AddScoped<IOrderService, OrderService>();

var app = builder.Build();

// Ensure Database is Created & Seeded with retry
for (int i = 0; i < 5; i++)
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PosDbContext>();
        db.Database.EnsureCreated();
        app.Logger.LogInformation("Database connected and verified successfully.");
        break;
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning("Database initialization attempt {Attempt} failed: {Message}. Retrying...", i + 1, ex.Message);
        System.Threading.Thread.Sleep(2000);
    }
}

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Health Check
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    system = "01_POS_KDS_ENGINE",
    timestamp = DateTime.UtcNow,
    engine = ".NET 10 Minimal APIs + SignalR Core"
}));

// Products & Menu
app.MapGet("/api/products", async (PosDbContext db) =>
{
    var products = await db.Products
        .Include(p => p.BOMItems)
        .ThenInclude(b => b.Ingredient)
        .ToListAsync();
    return Results.Ok(products);
});

// Tables & Floor
app.MapGet("/api/tables", async (PosDbContext db) =>
{
    var tables = await db.Tables.OrderBy(t => t.Id).ToListAsync();
    return Results.Ok(tables);
});

app.MapPost("/api/tables/{id}/status", async (int id, TableStatus status, PosDbContext db, Microsoft.AspNetCore.SignalR.IHubContext<PosHub, IPosClient> hub) =>
{
    var table = await db.Tables.FindAsync(id);
    if (table == null) return Results.NotFound();

    table.Status = status;
    await db.SaveChangesAsync();
    await hub.Clients.All.BroadcastTableUpdate(table);
    return Results.Ok(table);
});

// Orders & State Transitions
app.MapGet("/api/orders", async (IOrderService orderService) =>
{
    var orders = await orderService.GetActiveOrdersAsync();
    return Results.Ok(orders);
});

app.MapGet("/api/orders/{id}", async (int id, IOrderService orderService) =>
{
    var order = await orderService.GetOrderByIdAsync(id);
    return order != null ? Results.Ok(order) : Results.NotFound();
});

// Transition 1: DRAFT -> SUBMITTED (Trigger: POST_ORDER)
app.MapPost("/api/orders", async (SubmitOrderRequest request, IOrderService orderService) =>
{
    try
    {
        var order = await orderService.SubmitOrderAsync(request);
        return Results.Created($"/api/orders/{order.Id}", order);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

// KDS Queue
app.MapGet("/api/kds/queue", async (IOrderService orderService) =>
{
    var queue = await orderService.GetKdsQueueAsync();
    return Results.Ok(queue);
});

// Transition 2: SUBMITTED -> COOKING (Trigger: CHEF_ACCEPT)
app.MapPost("/api/kds/{id}/accept", async (int id, IOrderService orderService) =>
{
    try
    {
        var order = await orderService.AcceptOrderAsync(id);
        return Results.Ok(order);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// Transition 3: COOKING -> READY (Trigger: CHEF_DONE)
app.MapPost("/api/kds/{id}/complete", async (int id, IOrderService orderService) =>
{
    try
    {
        var order = await orderService.CompleteOrderAsync(id);
        return Results.Ok(order);
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// Transition 4: READY -> PAID (Trigger: SETTLE_BILL)
// Invariants: StockCannotBeNegative, PriceImmutableAfterCheckout
// Side-effects: BOM.DeductStock, ThermalPrint.PrintReceipt
app.MapPost("/api/payments/settle", async (SettleBillRequest request, IOrderService orderService) =>
{
    try
    {
        var (order, payment) = await orderService.ProcessPaymentAsync(request);
        return Results.Ok(new
        {
            order,
            payment,
            receiptText = payment.ReceiptTextPreview,
            escposBase64 = payment.ReceiptEscPosBase64
        });
    }
    catch (KeyNotFoundException)
    {
        return Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// Inventory & BOM
app.MapGet("/api/inventory", async (IInventoryService inventoryService) =>
{
    var ingredients = await inventoryService.GetAllIngredientsAsync();
    return Results.Ok(ingredients);
});

app.MapPost("/api/inventory/{id}/adjust", async (int id, StockAdjustDto dto, IInventoryService inventoryService) =>
{
    try
    {
        var item = await inventoryService.AdjustStockAsync(id, dto.Delta, dto.Reason);
        return item != null ? Results.Ok(item) : Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

// Thermal Receipt Preview / Raw Download
app.MapGet("/api/payments/{orderId}/receipt", async (int orderId, PosDbContext db, IThermalPrinterService printer) =>
{
    var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId);
    var payment = await db.Payments.FirstOrDefaultAsync(p => p.OrderId == orderId);

    if (order == null || payment == null) return Results.NotFound();

    var escposBytes = printer.GenerateEscPosBytes(order, payment);
    var receiptText = printer.GenerateReceiptText(order, payment);

    return Results.Ok(new
    {
        orderId,
        orderNumber = order.OrderNumber,
        receiptText,
        escposBase64 = Convert.ToBase64String(escposBytes)
    });
});

// Map SignalR Hubs
app.MapHub<PosHub>("/hubs/pos");
app.MapHub<KdsHub>("/hubs/kds");
app.MapHub<WaiterHub>("/hubs/waiter");

app.Run();

// DTO Declarations
public record StockAdjustDto(decimal Delta, string Reason);

