namespace pos_api.Models;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public ItemCategory Category { get; set; } = ItemCategory.Food;
    public decimal Price { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public bool IsAvailable { get; set; } = true;
    public decimal TaxRate { get; set; } = 0.07m; // 7% VAT standard
    public List<BillOfMaterialItem> BOMItems { get; set; } = new();
}

public class Table
{
    public int Id { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public int Seats { get; set; } = 4;
    public TableStatus Status { get; set; } = TableStatus.Available;
    public int? CurrentOrderId { get; set; }
    public string? GuestName { get; set; }
}
