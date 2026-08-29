using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using pos_api.Data;
using pos_api.Hubs;
using pos_api.Models;

namespace pos_api.Services;

public record CreateOrderItemRequest(
    int ProductId,
    int Quantity,
    string? Modifiers = null,
    string? SpecialInstructions = null
);

public record SubmitOrderRequest(
    int TableId,
    ActorRole Actor,
    List<CreateOrderItemRequest> Items,
    string? Notes = null
);

public record SettleBillRequest(
    int OrderId,
    PaymentMethod Method,
    decimal AmountPaid,
    string? TransactionReference = null
);

public interface IOrderService
{
    Task<List<Order>> GetActiveOrdersAsync();
    Task<List<Order>> GetKdsQueueAsync();
    Task<Order?> GetOrderByIdAsync(int id);
    Task<Order> SubmitOrderAsync(SubmitOrderRequest request);
    Task<Order> AcceptOrderAsync(int orderId);
    Task<Order> CompleteOrderAsync(int orderId);
    Task<(Order Order, Payment Payment)> ProcessPaymentAsync(SettleBillRequest request);
    Task<Order> CancelOrderAsync(int orderId, string reason);
}

public class OrderService : IOrderService
{
    private readonly PosDbContext _db;
    private readonly IInventoryService _inventoryService;
    private readonly IThermalPrinterService _printerService;
    private readonly IHubContext<PosHub, IPosClient> _posHub;
    private readonly IHubContext<KdsHub, IPosClient> _kdsHub;
    private readonly IHubContext<WaiterHub, IPosClient> _waiterHub;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        PosDbContext db,
        IInventoryService inventoryService,
        IThermalPrinterService printerService,
        IHubContext<PosHub, IPosClient> posHub,
        IHubContext<KdsHub, IPosClient> kdsHub,
        IHubContext<WaiterHub, IPosClient> waiterHub,
        ILogger<OrderService> logger)
    {
        _db = db;
        _inventoryService = inventoryService;
        _printerService = printerService;
        _posHub = posHub;
        _kdsHub = kdsHub;
        _waiterHub = waiterHub;
        _logger = logger;
    }

    public async Task<List<Order>> GetActiveOrdersAsync()
    {
        return await _db.Orders
            .Include(o => o.Items)
            .Where(o => o.Status != OrderStatus.PAID && o.Status != OrderStatus.CANCELLED)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<Order>> GetKdsQueueAsync()
    {
        return await _db.Orders
            .Include(o => o.Items)
            .Where(o => o.Status == OrderStatus.SUBMITTED || o.Status == OrderStatus.COOKING)
            .OrderBy(o => o.SubmittedAt ?? o.CreatedAt)
            .ToListAsync();
    }

    public async Task<Order?> GetOrderByIdAsync(int id)
    {
        return await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
    }

    /// <summary>
    /// Transition 1: DRAFT -> SUBMITTED
    /// Trigger: POST_ORDER
    /// Handler: Orders.SubmitOrder
    /// Invariant: PriceImmutableAfterCheckout (Snapshots current catalog prices)
    /// Side-effects: SignalR:kdsHub.BroadcastNewOrder, SignalR:posHub.BroadcastNewOrder
    /// </summary>
    public async Task<Order> SubmitOrderAsync(SubmitOrderRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new ArgumentException("Order must contain at least one item.");
        }

        var table = await _db.Tables.FindAsync(request.TableId)
            ?? throw new ArgumentException($"Table with ID {request.TableId} not found.");

        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await _db.Products
            .Where(p => productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p);

        var orderNumber = $"ORD-{DateTime.UtcNow:yyMMdd}-{Random.Shared.Next(1000, 9999)}";

        var order = new Order
        {
            OrderNumber = orderNumber,
            TableId = table.Id,
            TableNumber = table.TableNumber,
            Status = OrderStatus.SUBMITTED,
            CreatedAt = DateTime.UtcNow,
            SubmittedAt = DateTime.UtcNow,
            CreatedByActor = request.Actor,
            Notes = request.Notes
        };

        foreach (var itemReq in request.Items)
        {
            if (!products.TryGetValue(itemReq.ProductId, out var product))
            {
                throw new ArgumentException($"Product ID {itemReq.ProductId} not found.");
            }

            // Invariant: PriceImmutableAfterCheckout
            // Snapshot current price at moment of ordering
            order.Items.Add(new OrderItem
            {
                ProductId = product.Id,
                ProductName = product.Name,
                UnitPrice = product.Price, // Frozen immutable price
                Quantity = itemReq.Quantity,
                Modifiers = itemReq.Modifiers,
                SpecialInstructions = itemReq.SpecialInstructions
            });
        }

        // Check BOM stock availability preview
        var (isStockValid, stockErrors) = await _inventoryService.ValidateStockForOrderAsync(order);
        if (!isStockValid)
        {
            _logger.LogWarning("BOM Stock Warning for Order {OrderNo}: {Errors}", orderNumber, string.Join("; ", stockErrors));
        }

        _db.Orders.Add(order);

        // Update table state
        table.Status = TableStatus.Occupied;
        table.CurrentOrderId = order.Id;

        await _db.SaveChangesAsync();

        // Update table with accurate current order ID
        table.CurrentOrderId = order.Id;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Order {OrderNo} SUBMITTED for {Table} by {Actor}", order.OrderNumber, order.TableNumber, order.CreatedByActor);

        // Side-effects: SignalR:kdsHub.BroadcastNewOrder & posHub
        await _kdsHub.Clients.All.BroadcastNewOrder(order);
        await _posHub.Clients.All.BroadcastNewOrder(order);
        await _waiterHub.Clients.All.BroadcastNewOrder(order);
        await _posHub.Clients.All.BroadcastTableUpdate(table);

        return order;
    }

    /// <summary>
    /// Transition 2: SUBMITTED -> COOKING
    /// Trigger: CHEF_ACCEPT
    /// Handler: Kds.AcceptOrder
    /// </summary>
    public async Task<Order> AcceptOrderAsync(int orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Order ID {orderId} not found.");

        if (order.Status != OrderStatus.SUBMITTED)
        {
            throw new InvalidOperationException($"Cannot accept order in status '{order.Status}'. Expected 'SUBMITTED'.");
        }

        order.Status = OrderStatus.COOKING;
        order.CookingAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Order {OrderNo} CHEF_ACCEPT -> COOKING", order.OrderNumber);

        await _kdsHub.Clients.All.NotifyCooking(order);
        await _posHub.Clients.All.NotifyCooking(order);
        await _waiterHub.Clients.All.NotifyCooking(order);

        return order;
    }

    /// <summary>
    /// Transition 3: COOKING -> READY
    /// Trigger: CHEF_DONE
    /// Handler: Kds.CompleteOrder
    /// Side-effects: SignalR:waiterHub.NotifyReady
    /// </summary>
    public async Task<Order> CompleteOrderAsync(int orderId)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId)
            ?? throw new KeyNotFoundException($"Order ID {orderId} not found.");

        if (order.Status != OrderStatus.COOKING && order.Status != OrderStatus.SUBMITTED)
        {
            throw new InvalidOperationException($"Cannot complete order in status '{order.Status}'. Expected 'COOKING'.");
        }

        order.Status = OrderStatus.READY;
        order.ReadyAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Order {OrderNo} CHEF_DONE -> READY for table {Table}", order.OrderNumber, order.TableNumber);

        // Side-effects: SignalR:waiterHub.NotifyReady
        await _waiterHub.Clients.All.NotifyReady(order);
        await _kdsHub.Clients.All.NotifyReady(order);
        await _posHub.Clients.All.NotifyReady(order);

        return order;
    }

    /// <summary>
    /// Transition 4: READY -> PAID
    /// Trigger: SETTLE_BILL
    /// Handler: Payments.Process
    /// Invariant: StockCannotBeNegative
    /// Side-effects: BOM.DeductStock, ThermalPrint.PrintReceipt
    /// </summary>
    public async Task<(Order Order, Payment Payment)> ProcessPaymentAsync(SettleBillRequest request)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId)
            ?? throw new KeyNotFoundException($"Order ID {request.OrderId} not found.");

        if (order.Status == OrderStatus.PAID)
        {
            throw new InvalidOperationException($"Order {order.OrderNumber} is already PAID.");
        }

        if (request.AmountPaid < order.GrandTotal)
        {
            throw new InvalidOperationException($"Amount tendered ({request.AmountPaid:N2}) is less than total due ({order.GrandTotal:N2}).");
        }

        // Side-effect: BOM.DeductStock (Enforces StockCannotBeNegative invariant)
        await _inventoryService.DeductStockForOrderAsync(order);

        var payment = new Payment
        {
            OrderId = order.Id,
            AmountDue = order.GrandTotal,
            AmountPaid = request.AmountPaid,
            Method = request.Method,
            TransactionReference = request.TransactionReference ?? $"TXN-{Guid.NewGuid().ToString()[..8].ToUpper()}",
            PaidAt = DateTime.UtcNow
        };

        // Side-effect: ThermalPrint.PrintReceipt
        var escposBytes = _printerService.GenerateEscPosBytes(order, payment);
        payment.ReceiptEscPosBase64 = Convert.ToBase64String(escposBytes);
        payment.ReceiptTextPreview = _printerService.GenerateReceiptText(order, payment);

        _db.Payments.Add(payment);

        order.Status = OrderStatus.PAID;
        order.PaidAt = DateTime.UtcNow;

        var table = await _db.Tables.FindAsync(order.TableId);
        if (table != null)
        {
            table.Status = TableStatus.Available;
            table.CurrentOrderId = null;
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation("Order {OrderNo} SETTLE_BILL -> PAID. Payment method: {Method}, Total: {Total}",
            order.OrderNumber, payment.Method, order.GrandTotal);

        await _posHub.Clients.All.NotifyOrderPaid(order);
        await _waiterHub.Clients.All.NotifyOrderPaid(order);
        if (table != null)
        {
            await _posHub.Clients.All.BroadcastTableUpdate(table);
        }

        return (order, payment);
    }

    public async Task<Order> CancelOrderAsync(int orderId, string reason)
    {
        var order = await _db.Orders.FindAsync(orderId)
            ?? throw new KeyNotFoundException($"Order ID {orderId} not found.");

        if (order.Status == OrderStatus.PAID)
        {
            throw new InvalidOperationException("Cannot cancel a paid order.");
        }

        order.Status = OrderStatus.CANCELLED;
        order.Notes = (order.Notes ?? "") + $" [Cancelled: {reason}]";

        var table = await _db.Tables.FindAsync(order.TableId);
        if (table != null && table.CurrentOrderId == order.Id)
        {
            table.Status = TableStatus.Available;
            table.CurrentOrderId = null;
        }

        await _db.SaveChangesAsync();

        if (table != null)
        {
            await _posHub.Clients.All.BroadcastTableUpdate(table);
        }

        return order;
    }
}
