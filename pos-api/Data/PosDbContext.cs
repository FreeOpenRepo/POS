using Microsoft.EntityFrameworkCore;
using pos_api.Models;

namespace pos_api.Data;

public class PosDbContext : DbContext
{
    public PosDbContext(DbContextOptions<PosDbContext> options) : base(options)
    {
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<BillOfMaterialItem> BillOfMaterials => Set<BillOfMaterialItem>();
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Seed Ingredients
        modelBuilder.Entity<Ingredient>().HasData(
            new Ingredient { Id = 1, Name = "Wagyu Beef Patty (150g)", CurrentStock = 85, MinimumThreshold = 15, Unit = UnitOfMeasure.Pieces, CostPerUnit = 95.0m },
            new Ingredient { Id = 2, Name = "Brioche Bun", CurrentStock = 120, MinimumThreshold = 20, Unit = UnitOfMeasure.Pieces, CostPerUnit = 12.0m },
            new Ingredient { Id = 3, Name = "Cheddar Cheese Slice", CurrentStock = 200, MinimumThreshold = 30, Unit = UnitOfMeasure.Pieces, CostPerUnit = 8.5m },
            new Ingredient { Id = 4, Name = "Truffle Mayo (50g)", CurrentStock = 60, MinimumThreshold = 10, Unit = UnitOfMeasure.Portions, CostPerUnit = 18.0m },
            new Ingredient { Id = 5, Name = "Potato Strips (200g)", CurrentStock = 150, MinimumThreshold = 25, Unit = UnitOfMeasure.Portions, CostPerUnit = 14.0m },
            new Ingredient { Id = 6, Name = "Arabica Coffee Beans (20g)", CurrentStock = 300, MinimumThreshold = 40, Unit = UnitOfMeasure.Portions, CostPerUnit = 10.0m },
            new Ingredient { Id = 7, Name = "Fresh Whole Milk (180ml)", CurrentStock = 250, MinimumThreshold = 30, Unit = UnitOfMeasure.Portions, CostPerUnit = 7.0m },
            new Ingredient { Id = 8, Name = "Matcha Green Tea Powder (15g)", CurrentStock = 90, MinimumThreshold = 15, Unit = UnitOfMeasure.Portions, CostPerUnit = 22.0m },
            new Ingredient { Id = 9, Name = "Belgian Chocolate Lava Cake Mix", CurrentStock = 45, MinimumThreshold = 10, Unit = UnitOfMeasure.Pieces, CostPerUnit = 35.0m },
            new Ingredient { Id = 10, Name = "Vanilla Gelato Scoop", CurrentStock = 110, MinimumThreshold = 20, Unit = UnitOfMeasure.Pieces, CostPerUnit = 15.0m }
        );

        // Seed Products
        modelBuilder.Entity<Product>().HasData(
            new Product
            {
                Id = 1,
                Name = "Signature Truffle Wagyu Burger",
                Description = "150g Australian Wagyu, melted mature cheddar, caramelized onions, house truffle mayo on toasted brioche.",
                Category = ItemCategory.Food,
                Price = 320.0m,
                ImageUrl = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
                IsAvailable = true
            },
            new Product
            {
                Id = 2,
                Name = "Double Smoked Bacon Cheeseburger",
                Description = "Double Wagyu patties, smoked crispy bacon, American cheese, secret sauce, pickles.",
                Category = ItemCategory.Food,
                Price = 390.0m,
                ImageUrl = "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80",
                IsAvailable = true
            },
            new Product
            {
                Id = 3,
                Name = "Crispy Truffle Parmesan Fries",
                Description = "Golden fried skin-on potatoes tossed in white truffle oil, grated aged parmesan, and fresh parsley.",
                Category = ItemCategory.Food,
                Price = 160.0m,
                ImageUrl = "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
                IsAvailable = true
            },
            new Product
            {
                Id = 4,
                Name = "Iced Velvet Caramel Latte",
                Description = "Double shot specialty Arabica espresso, velvety cold milk, artisanal salted caramel drizzle.",
                Category = ItemCategory.Beverage,
                Price = 135.0m,
                ImageUrl = "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80",
                IsAvailable = true
            },
            new Product
            {
                Id = 5,
                Name = "Ceremonial Uji Matcha Latte",
                Description = "Authentic stone-ground Kyoto matcha whisked fresh with organic fresh milk.",
                Category = ItemCategory.Beverage,
                Price = 145.0m,
                ImageUrl = "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80",
                IsAvailable = true
            },
            new Product
            {
                Id = 6,
                Name = "Warm Molten Lava Cake & Gelato",
                Description = "Rich 70% dark Belgian chocolate molten cake served with Madagascar vanilla bean gelato.",
                Category = ItemCategory.Dessert,
                Price = 195.0m,
                ImageUrl = "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
                IsAvailable = true
            }
        );

        // Seed Bill Of Materials (BOM)
        modelBuilder.Entity<BillOfMaterialItem>().HasData(
            // Product 1: Truffle Wagyu Burger (Patty x1, Bun x1, Cheese x1, Truffle Mayo x1)
            new BillOfMaterialItem { Id = 1, ProductId = 1, IngredientId = 1, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 2, ProductId = 1, IngredientId = 2, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 3, ProductId = 1, IngredientId = 3, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 4, ProductId = 1, IngredientId = 4, QuantityRequired = 1 },
            
            // Product 2: Double Bacon Burger (Patty x2, Bun x1, Cheese x2)
            new BillOfMaterialItem { Id = 5, ProductId = 2, IngredientId = 1, QuantityRequired = 2 },
            new BillOfMaterialItem { Id = 6, ProductId = 2, IngredientId = 2, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 7, ProductId = 2, IngredientId = 3, QuantityRequired = 2 },

            // Product 3: Truffle Fries (Potato x1, Truffle Mayo/Oil x1)
            new BillOfMaterialItem { Id = 8, ProductId = 3, IngredientId = 5, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 9, ProductId = 3, IngredientId = 4, QuantityRequired = 1 },

            // Product 4: Iced Caramel Latte (Coffee x1, Milk x1)
            new BillOfMaterialItem { Id = 10, ProductId = 4, IngredientId = 6, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 11, ProductId = 4, IngredientId = 7, QuantityRequired = 1 },

            // Product 5: Uji Matcha Latte (Matcha x1, Milk x1)
            new BillOfMaterialItem { Id = 12, ProductId = 5, IngredientId = 8, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 13, ProductId = 5, IngredientId = 7, QuantityRequired = 1 },

            // Product 6: Molten Lava Cake (Lava mix x1, Gelato x1)
            new BillOfMaterialItem { Id = 14, ProductId = 6, IngredientId = 9, QuantityRequired = 1 },
            new BillOfMaterialItem { Id = 15, ProductId = 6, IngredientId = 10, QuantityRequired = 1 }
        );

        // Seed Tables
        modelBuilder.Entity<Table>().HasData(
            new Table { Id = 1, TableNumber = "T-01", Seats = 2, Status = TableStatus.Available },
            new Table { Id = 2, TableNumber = "T-02", Seats = 2, Status = TableStatus.Available },
            new Table { Id = 3, TableNumber = "T-03", Seats = 4, Status = TableStatus.Available },
            new Table { Id = 4, TableNumber = "T-04", Seats = 4, Status = TableStatus.Available },
            new Table { Id = 5, TableNumber = "T-05", Seats = 6, Status = TableStatus.Available },
            new Table { Id = 6, TableNumber = "T-06", Seats = 8, Status = TableStatus.Available },
            new Table { Id = 7, TableNumber = "Bar-1", Seats = 1, Status = TableStatus.Available },
            new Table { Id = 8, TableNumber = "Bar-2", Seats = 1, Status = TableStatus.Available }
        );
    }
}
