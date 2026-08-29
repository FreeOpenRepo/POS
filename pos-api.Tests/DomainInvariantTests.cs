using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using pos_api.Data;
using pos_api.Hubs;
using pos_api.Models;
using pos_api.Services;
using Xunit;

namespace pos_api.Tests;

public class DomainInvariantTests
{
    private PosDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<PosDbContext>()
            .UseInMemoryDatabase(databaseName: $"PosTestDb_{Guid.NewGuid()}")
            .Options;

        var db = new PosDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private OrderService CreateOrderService(PosDbContext db, IInventoryService invService)
    {
        var printerMock = new Mock<IThermalPrinterService>();
        printerMock.Setup(p => p.GenerateEscPosBytes(It.IsAny<Order>(), It.IsAny<Payment>()))
            .Returns(new byte[] { 0x1B, 0x40 });
        printerMock.Setup(p => p.GenerateReceiptText(It.IsAny<Order>(), It.IsAny<Payment>()))
            .Returns("Test Receipt");

        var posHubMock = new Mock<IHubContext<PosHub, IPosClient>>();
        var kdsHubMock = new Mock<IHubContext<KdsHub, IPosClient>>();
        var waiterHubMock = new Mock<IHubContext<WaiterHub, IPosClient>>();

        var clientsMock = new Mock<IHubClients<IPosClient>>();
        var clientProxyMock = new Mock<IPosClient>();
        clientsMock.Setup(c => c.All).Returns(clientProxyMock.Object);

        posHubMock.Setup(h => h.Clients).Returns(clientsMock.Object);
        kdsHubMock.Setup(h => h.Clients).Returns(clientsMock.Object);
        waiterHubMock.Setup(h => h.Clients).Returns(clientsMock.Object);

        return new OrderService(
            db,
            invService,
            printerMock.Object,
            posHubMock.Object,
            kdsHubMock.Object,
            waiterHubMock.Object,
            NullLogger<OrderService>.Instance
        );
    }

    [Fact]
    public async Task Invariant_PriceImmutableAfterCheckout_PreservesSnapshotPrice()
    {
        using var db = CreateInMemoryDbContext();
        var invService = new InventoryService(db, NullLogger<InventoryService>.Instance);
        var orderService = CreateOrderService(db, invService);

        // Product 1 initial price is 320.0 THB
        var product = await db.Products.FindAsync(1);
        Assert.NotNull(product);
        Assert.Equal(320.0m, product.Price);

        // Submit order
        var order = await orderService.SubmitOrderAsync(new SubmitOrderRequest(
            TableId: 1,
            Actor: ActorRole.Guest,
            Items: new List<CreateOrderItemRequest>
            {
                new(ProductId: 1, Quantity: 2)
            }
        ));

        Assert.Equal(640.0m, order.Subtotal);
        Assert.Equal(320.0m, order.Items[0].UnitPrice);

        // Now modify product price in catalog to 500.0 THB
        product.Price = 500.0m;
        await db.SaveChangesAsync();

        // Retrieve order from database again
        var fetchedOrder = await orderService.GetOrderByIdAsync(order.Id);
        Assert.NotNull(fetchedOrder);
        
        // Invariant holds: Order item unit price remains 320.0 THB, total remains 640.0 THB
        Assert.Equal(320.0m, fetchedOrder.Items[0].UnitPrice);
        Assert.Equal(640.0m, fetchedOrder.Subtotal);
    }

    [Fact]
    public async Task Invariant_StockCannotBeNegative_ThrowsWhenStockInsufficient()
    {
        using var db = CreateInMemoryDbContext();
        var invService = new InventoryService(db, NullLogger<InventoryService>.Instance);
        var orderService = CreateOrderService(db, invService);

        // Set ingredient 1 (Wagyu Beef Patty) stock to only 1 piece
        var patty = await db.Ingredients.FindAsync(1);
        Assert.NotNull(patty);
        patty.CurrentStock = 1;
        await db.SaveChangesAsync();

        // Order 5 burgers (requires 5 patties)
        var order = await orderService.SubmitOrderAsync(new SubmitOrderRequest(
            TableId: 2,
            Actor: ActorRole.Waiter,
            Items: new List<CreateOrderItemRequest>
            {
                new(ProductId: 1, Quantity: 5)
            }
        ));

        await orderService.AcceptOrderAsync(order.Id);
        await orderService.CompleteOrderAsync(order.Id);

        // Attempting to settle payment triggers BOM stock deduction
        // Must throw InvalidOperationException because stock would become negative
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            orderService.ProcessPaymentAsync(new SettleBillRequest(
                OrderId: order.Id,
                Method: PaymentMethod.CASH,
                AmountPaid: 5000.0m
            ))
        );

        Assert.Contains("StockCannotBeNegative", ex.Message);
    }

    [Fact]
    public async Task StateTransitions_CompleteWorkflow_Succeeds()
    {
        using var db = CreateInMemoryDbContext();
        var invService = new InventoryService(db, NullLogger<InventoryService>.Instance);
        var orderService = CreateOrderService(db, invService);

        // 1. Submit Order (DRAFT -> SUBMITTED)
        var order = await orderService.SubmitOrderAsync(new SubmitOrderRequest(
            TableId: 3,
            Actor: ActorRole.Guest,
            Items: new List<CreateOrderItemRequest>
            {
                new(ProductId: 4, Quantity: 2) // 2x Iced Caramel Latte
            }
        ));
        Assert.Equal(OrderStatus.SUBMITTED, order.Status);
        Assert.NotNull(order.SubmittedAt);

        // 2. Chef Accept (SUBMITTED -> COOKING)
        var cookingOrder = await orderService.AcceptOrderAsync(order.Id);
        Assert.Equal(OrderStatus.COOKING, cookingOrder.Status);
        Assert.NotNull(cookingOrder.CookingAt);

        // 3. Chef Complete (COOKING -> READY)
        var readyOrder = await orderService.CompleteOrderAsync(order.Id);
        Assert.Equal(OrderStatus.READY, readyOrder.Status);
        Assert.NotNull(readyOrder.ReadyAt);

        // 4. Settle Bill (READY -> PAID)
        var (paidOrder, payment) = await orderService.ProcessPaymentAsync(new SettleBillRequest(
            OrderId: order.Id,
            Method: PaymentMethod.CASH,
            AmountPaid: 500.0m
        ));
        Assert.Equal(OrderStatus.PAID, paidOrder.Status);
        Assert.NotNull(paidOrder.PaidAt);
        Assert.NotNull(payment);
        Assert.True(payment.ChangeAmount > 0);
        Assert.NotEmpty(payment.ReceiptEscPosBase64!);
    }
}
