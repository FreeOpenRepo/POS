namespace pos_api.Models;

public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    
    // Invariant: PriceImmutableAfterCheckout
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal TotalPrice => UnitPrice * Quantity;
    public string? Modifiers { get; set; }
    public string? SpecialInstructions { get; set; }
}

public class Order
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public int TableId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public OrderStatus Status { get; set; } = OrderStatus.DRAFT;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? CookingAt { get; set; }
    public DateTime? ReadyAt { get; set; }
    public DateTime? PaidAt { get; set; }
    
    public ActorRole CreatedByActor { get; set; } = ActorRole.Guest;
    public string? Notes { get; set; }

    public List<OrderItem> Items { get; set; } = new();

    public decimal Subtotal => Items.Sum(i => i.TotalPrice);
    public decimal DiscountAmount { get; set; } = 0;
    public decimal TaxAmount => Math.Round((Subtotal - DiscountAmount) * 0.07m, 2);
    public decimal GrandTotal => Math.Max(0, Subtotal - DiscountAmount + TaxAmount);
}

public class Payment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public decimal AmountDue { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal ChangeAmount => Math.Max(0, AmountPaid - AmountDue);
    public PaymentMethod Method { get; set; } = PaymentMethod.CASH;
    public string? TransactionReference { get; set; }
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    public string? ReceiptEscPosBase64 { get; set; }
    public string? ReceiptTextPreview { get; set; }
}
