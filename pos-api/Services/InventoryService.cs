using Microsoft.EntityFrameworkCore;
using pos_api.Data;
using pos_api.Models;

namespace pos_api.Services;

public interface IInventoryService
{
    Task<List<Ingredient>> GetAllIngredientsAsync();
    Task<Ingredient?> AdjustStockAsync(int ingredientId, decimal quantityDelta, string reason);
    Task<(bool IsValid, List<string> Errors)> ValidateStockForOrderAsync(Order order);
    Task DeductStockForOrderAsync(Order order);
}

public class InventoryService : IInventoryService
{
    private readonly PosDbContext _db;
    private readonly ILogger<InventoryService> _logger;

    public InventoryService(PosDbContext db, ILogger<InventoryService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<List<Ingredient>> GetAllIngredientsAsync()
    {
        return await _db.Ingredients.OrderBy(i => i.Id).ToListAsync();
    }

    public async Task<Ingredient?> AdjustStockAsync(int ingredientId, decimal quantityDelta, string reason)
    {
        var ingredient = await _db.Ingredients.FindAsync(ingredientId);
        if (ingredient == null) return null;

        var newStock = ingredient.CurrentStock + quantityDelta;
        if (newStock < 0)
        {
            throw new InvalidOperationException($"Invariant violation [StockCannotBeNegative]: Stock for '{ingredient.Name}' cannot be negative (attempted {newStock}).");
        }

        ingredient.CurrentStock = newStock;
        ingredient.LastUpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Stock adjusted for {Name}: Delta={Delta}, NewStock={NewStock}, Reason={Reason}",
            ingredient.Name, quantityDelta, newStock, reason);

        return ingredient;
    }

    public async Task<(bool IsValid, List<string> Errors)> ValidateStockForOrderAsync(Order order)
    {
        var errors = new List<string>();
        var requiredAmounts = await CalculateRequiredIngredientsAsync(order);
        var ingredientIds = requiredAmounts.Keys.ToList();

        var ingredients = await _db.Ingredients
            .Where(i => ingredientIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i);

        foreach (var (ingredientId, qtyNeeded) in requiredAmounts)
        {
            if (ingredients.TryGetValue(ingredientId, out var ing))
            {
                if (ing.CurrentStock < qtyNeeded)
                {
                    errors.Add($"Insufficient stock for '{ing.Name}'. Required: {qtyNeeded} {ing.Unit}, Available: {ing.CurrentStock} {ing.Unit}");
                }
            }
            else
            {
                errors.Add($"Ingredient ID {ingredientId} not found in inventory.");
            }
        }

        return (errors.Count == 0, errors);
    }

    public async Task DeductStockForOrderAsync(Order order)
    {
        var (isValid, errors) = await ValidateStockForOrderAsync(order);
        if (!isValid)
        {
            var msg = string.Join("; ", errors);
            throw new InvalidOperationException($"Invariant violation [StockCannotBeNegative]: {msg}");
        }

        var requiredAmounts = await CalculateRequiredIngredientsAsync(order);
        var ingredientIds = requiredAmounts.Keys.ToList();
        var ingredients = await _db.Ingredients
            .Where(i => ingredientIds.Contains(i.Id))
            .ToListAsync();

        foreach (var ing in ingredients)
        {
            if (requiredAmounts.TryGetValue(ing.Id, out var qtyNeeded))
            {
                ing.CurrentStock -= qtyNeeded;
                ing.LastUpdatedAt = DateTime.UtcNow;
                _logger.LogInformation("BOM Deduct: Ingredient '{Name}' reduced by {Qty} to {Remaining}",
                    ing.Name, qtyNeeded, ing.CurrentStock);
            }
        }

        await _db.SaveChangesAsync();
    }

    private async Task<Dictionary<int, decimal>> CalculateRequiredIngredientsAsync(Order order)
    {
        var result = new Dictionary<int, decimal>();
        var productIds = order.Items.Select(i => i.ProductId).Distinct().ToList();

        var bomList = await _db.BillOfMaterials
            .Where(b => productIds.Contains(b.ProductId))
            .ToListAsync();

        var bomByProduct = bomList
            .GroupBy(b => b.ProductId)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var item in order.Items)
        {
            if (bomByProduct.TryGetValue(item.ProductId, out var boms))
            {
                foreach (var bom in boms)
                {
                    var totalForThisItem = bom.QuantityRequired * item.Quantity;
                    if (result.ContainsKey(bom.IngredientId))
                    {
                        result[bom.IngredientId] += totalForThisItem;
                    }
                    else
                    {
                        result[bom.IngredientId] = totalForThisItem;
                    }
                }
            }
        }

        return result;
    }
}
