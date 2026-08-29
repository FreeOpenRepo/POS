namespace pos_api.Models;

public enum OrderStatus
{
    DRAFT,
    SUBMITTED,
    COOKING,
    READY,
    PAID,
    CANCELLED
}

public enum PaymentMethod
{
    CASH,
    PROMPTPAY_QR,
    CREDIT_CARD
}

public enum ActorRole
{
    Guest,
    Waiter,
    KitchenChef,
    Cashier
}

public enum ItemCategory
{
    Food,
    Beverage,
    Dessert,
    Special
}

public enum UnitOfMeasure
{
    Grams,
    Milliliters,
    Pieces,
    Portions
}

public enum TableStatus
{
    Available,
    Occupied,
    BillRequested
}
