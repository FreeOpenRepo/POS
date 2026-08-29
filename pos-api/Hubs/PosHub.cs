using Microsoft.AspNetCore.SignalR;
using pos_api.Models;

namespace pos_api.Hubs;

public interface IPosClient
{
    Task BroadcastNewOrder(Order order);
    Task NotifyCooking(Order order);
    Task NotifyReady(Order order);
    Task NotifyOrderPaid(Order order);
    Task BroadcastTableUpdate(Table table);
    Task BroadcastInventoryAlert(string message);
}

public class PosHub : Hub<IPosClient>
{
    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }

    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
    }
}

public class KdsHub : Hub<IPosClient>
{
}

public class WaiterHub : Hub<IPosClient>
{
}
