system: 01_POS_KDS_ENGINE
tech_stack:
  frontend: "Next.js 16 (React 19) + Dexie.js + @microsoft/signalr + @serwist/next"
  backend: ".NET 10 (Minimal APIs, Native AOT) + ESCPOS_NET + SignalR Core"
  orm: "EF Core 10 (Npgsql.EntityFrameworkCore.PostgreSQL)"
  storage: "PostgreSQL 18 + Redis 7.2"
  protocols: "WSS, Web Bluetooth, ESC/POS over TCP"
spec:
  actors: [Guest, Waiter, KitchenChef, Cashier]
  invariants: [StockCannotBeNegative, PriceImmutableAfterCheckout]
  state_transitions:
    - { from: DRAFT, to: SUBMITTED, trigger: POST_ORDER, handler: "Orders.SubmitOrder", side_effects: ["SignalR:kdsHub.BroadcastNewOrder"] }
    - { from: SUBMITTED, to: COOKING, trigger: CHEF_ACCEPT, handler: "Kds.AcceptOrder" }
    - { from: COOKING, to: READY, trigger: CHEF_DONE, handler: "Kds.CompleteOrder", side_effects: ["SignalR:waiterHub.NotifyReady"] }
    - { from: READY, to: PAID, trigger: SETTLE_BILL, handler: "Payments.Process", side_effects: ["BOM.DeductStock", "ThermalPrint.PrintReceipt"] }