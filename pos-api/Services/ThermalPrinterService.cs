using System.Text;
using pos_api.Models;

namespace pos_api.Services;

public interface IThermalPrinterService
{
    byte[] GenerateEscPosBytes(Order order, Payment payment);
    string GenerateReceiptText(Order order, Payment payment);
}

public class ThermalPrinterService : IThermalPrinterService
{
    // ESC/POS Command Constants
    private static readonly byte[] ESC_INIT = { 0x1B, 0x40 }; // Initialize printer
    private static readonly byte[] ESC_ALIGN_LEFT = { 0x1B, 0x61, 0x00 };
    private static readonly byte[] ESC_ALIGN_CENTER = { 0x1B, 0x61, 0x01 };
    private static readonly byte[] ESC_ALIGN_RIGHT = { 0x1B, 0x61, 0x02 };
    private static readonly byte[] ESC_EMPHASIZE_ON = { 0x1B, 0x45, 0x01 };
    private static readonly byte[] ESC_EMPHASIZE_OFF = { 0x1B, 0x45, 0x00 };
    private static readonly byte[] ESC_DOUBLE_HEIGHT_ON = { 0x1B, 0x21, 0x10 };
    private static readonly byte[] ESC_DOUBLE_HEIGHT_OFF = { 0x1B, 0x21, 0x00 };
    private static readonly byte[] ESC_PAPER_CUT = { 0x1D, 0x56, 0x00 }; // GS V 0 Full Cut
    private static readonly byte[] ESC_FEED_3 = { 0x1B, 0x64, 0x03 };

    public byte[] GenerateEscPosBytes(Order order, Payment payment)
    {
        using var ms = new MemoryStream();

        void Write(byte[] bytes) => ms.Write(bytes, 0, bytes.Length);
        void WriteText(string text)
        {
            var bytes = Encoding.UTF8.GetBytes(text);
            ms.Write(bytes, 0, bytes.Length);
        }
        void WriteLine(string text = "") => WriteText(text + "\n");

        // 1. Initialize
        Write(ESC_INIT);

        // 2. Header
        Write(ESC_ALIGN_CENTER);
        Write(ESC_DOUBLE_HEIGHT_ON);
        Write(ESC_EMPHASIZE_ON);
        WriteLine("ARTISAN POS GOURMET");
        Write(ESC_DOUBLE_HEIGHT_OFF);
        Write(ESC_EMPHASIZE_OFF);
        WriteLine("123 Sukhumvit Road, Bangkok 10110");
        WriteLine("TAX ID: 0-1055-67890-12-3 (VAT INCLUDED)");
        WriteLine("Tel: +66 2 999 8888");
        WriteLine("------------------------------------------");

        // 3. Order Info
        Write(ESC_ALIGN_LEFT);
        WriteLine($"Order No  : {order.OrderNumber}");
        WriteLine($"Table     : {order.TableNumber}  |  Actor: {order.CreatedByActor}");
        WriteLine($"Date/Time : {DateTime.UtcNow.AddHours(7):yyyy-MM-dd HH:mm:ss}");
        WriteLine("------------------------------------------");

        // 4. Line Items Table (42 columns standard 80mm)
        WriteLine(string.Format("{0,-22} {1,4} {2,7} {3,7}", "ITEM", "QTY", "PRICE", "TOTAL"));
        WriteLine("------------------------------------------");

        foreach (var item in order.Items)
        {
            var name = item.ProductName.Length > 22 ? item.ProductName.Substring(0, 19) + "..." : item.ProductName;
            WriteLine(string.Format("{0,-22} {1,4} {2,7:N2} {3,7:N2}", name, item.Quantity, item.UnitPrice, item.TotalPrice));
            if (!string.IsNullOrWhiteSpace(item.Modifiers))
            {
                WriteLine($"  * {item.Modifiers}");
            }
        }
        WriteLine("------------------------------------------");

        // 5. Totals & Tax
        Write(ESC_ALIGN_RIGHT);
        WriteLine($"Subtotal: {order.Subtotal,10:N2} THB");
        if (order.DiscountAmount > 0)
        {
            WriteLine($"Discount: -{order.DiscountAmount,9:N2} THB");
        }
        WriteLine($"VAT (7% Included): {order.TaxAmount,10:N2} THB");

        Write(ESC_EMPHASIZE_ON);
        Write(ESC_DOUBLE_HEIGHT_ON);
        WriteLine($"TOTAL DUE: {order.GrandTotal,8:N2} THB");
        Write(ESC_DOUBLE_HEIGHT_OFF);
        Write(ESC_EMPHASIZE_OFF);
        WriteLine("------------------------------------------");

        // 6. Payment Method & Tender
        Write(ESC_ALIGN_LEFT);
        WriteLine($"Payment Method : {payment.Method}");
        WriteLine($"Amount Tendered: {payment.AmountPaid,10:N2} THB");
        WriteLine($"Change Given   : {payment.ChangeAmount,10:N2} THB");
        if (!string.IsNullOrWhiteSpace(payment.TransactionReference))
        {
            WriteLine($"Ref / Tx ID    : {payment.TransactionReference}");
        }

        // 7. Footer
        Write(ESC_ALIGN_CENTER);
        WriteLine("==========================================");
        WriteLine("Thank you for dining with us!");
        WriteLine("Please scan below for e-Receipt & Rewards");
        WriteLine($"URL: https://pos.artisan.local/r/{order.OrderNumber}");
        WriteLine("==========================================");

        // 8. Feed & Paper Cut
        Write(ESC_FEED_3);
        Write(ESC_PAPER_CUT);

        return ms.ToArray();
    }

    public string GenerateReceiptText(Order order, Payment payment)
    {
        var sb = new StringBuilder();
        sb.AppendLine("==========================================");
        sb.AppendLine("           ARTISAN POS GOURMET            ");
        sb.AppendLine("    123 Sukhumvit Road, Bangkok 10110     ");
        sb.AppendLine("  TAX ID: 0-1055-67890-12-3 (VAT INCL.)   ");
        sb.AppendLine("------------------------------------------");
        sb.AppendLine($"Order No  : {order.OrderNumber}");
        sb.AppendLine($"Table     : {order.TableNumber}  |  Actor: {order.CreatedByActor}");
        sb.AppendLine($"Date/Time : {DateTime.UtcNow.AddHours(7):yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine("------------------------------------------");
        sb.AppendLine(string.Format("{0,-22} {1,4} {2,7} {3,7}", "ITEM", "QTY", "PRICE", "TOTAL"));
        sb.AppendLine("------------------------------------------");

        foreach (var item in order.Items)
        {
            var name = item.ProductName.Length > 22 ? item.ProductName.Substring(0, 19) + "..." : item.ProductName;
            sb.AppendLine(string.Format("{0,-22} {1,4} {2,7:N2} {3,7:N2}", name, item.Quantity, item.UnitPrice, item.TotalPrice));
            if (!string.IsNullOrWhiteSpace(item.Modifiers))
            {
                sb.AppendLine($"  * {item.Modifiers}");
            }
        }
        sb.AppendLine("------------------------------------------");
        sb.AppendLine($"Subtotal: {order.Subtotal,20:N2} THB");
        if (order.DiscountAmount > 0)
        {
            sb.AppendLine($"Discount: -{order.DiscountAmount,19:N2} THB");
        }
        sb.AppendLine($"VAT 7% (Included): {order.TaxAmount,13:N2} THB");
        sb.AppendLine($"GRAND TOTAL: {order.GrandTotal,19:N2} THB");
        sb.AppendLine("------------------------------------------");
        sb.AppendLine($"Payment Method : {payment.Method}");
        sb.AppendLine($"Amount Tendered: {payment.AmountPaid,14:N2} THB");
        sb.AppendLine($"Change Given   : {payment.ChangeAmount,14:N2} THB");
        sb.AppendLine("==========================================");
        sb.AppendLine("       THANK YOU - VISIT US AGAIN!        ");
        sb.AppendLine("==========================================");

        return sb.ToString();
    }
}
