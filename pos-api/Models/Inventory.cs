namespace pos_api.Models;

public class Ingredient
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal CurrentStock { get; set; }
    public decimal MinimumThreshold { get; set; } = 10;
    public UnitOfMeasure Unit { get; set; } = UnitOfMeasure.Pieces;
    public decimal CostPerUnit { get; set; }
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
}

public class BillOfMaterialItem
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int IngredientId { get; set; }
    public decimal QuantityRequired { get; set; }

    public Ingredient? Ingredient { get; set; }
}
