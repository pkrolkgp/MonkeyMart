package.path = "./?.lua;" .. package.path
local received, sends = {}, {}
local callback
local connection = {}
json = {
    encode = function(msg) return msg end,
    decode = function(msg) return msg end,
}
websocket = {
    DATA_TYPE_TEXT = 10,
    EVENT_CONNECTED = 1, EVENT_MESSAGE = 2,
    EVENT_ERROR = 3, EVENT_DISCONNECTED = 4,
    connect = function(url, params, handler)
        assert(url == "ws://localhost:8080")
        assert(type(params) == "table")
        callback = handler
        return connection
    end,
    send = function(conn, data, options)
        assert(conn == connection and options.type == 10)
        table.insert(sends, data)
    end,
    disconnect = function(conn) assert(conn == connection) end,
}
local Client = require("multiplayer.defold.coop_client")
local client = Client.new({
    url="ws://localhost:8080", name="Player", skin="monkey3",
    on_event=function(msg) table.insert(received, msg) end,
})
assert(client:connect())
assert(not client:connect())
assert(client:move(3, 5) == false)
callback({}, connection, {event=websocket.EVENT_CONNECTED})
assert(sends[1].type == "create" and sends[1].skin == "monkey3")
callback({}, connection, {event=websocket.EVENT_MESSAGE, message={
    type="welcome", playerId="p1", room="ABC123",
}})
assert(client.player_id == "p1" and client.room_code == "ABC123")
assert(client:move(3, 5) == true and sends[2].seq == 1)
assert(client:skin_change("monkey6") and sends[3].type == "skin")
assert(client:transfer("collect","banana",2) == "act-1")
assert(sends[4].requestId == "act-1" and sends[4].quantity == 2)
assert(client:snapshot() and sends[5].type == "snapshot")
callback({}, connection, {event=websocket.EVENT_MESSAGE, message={type="store_changed", revision=1}})
assert(received[2].revision == 1)
callback({}, connection, {event=websocket.EVENT_MESSAGE, message="wrong type"})
assert(received[3].error == "INVALID_JSON")
client:disconnect()
assert(not client.connected and not client.player_id)
local joining = Client.new({url="ws://localhost:8080", room="ROOM12"})
assert(joining:connect())
callback({}, connection, {event=websocket.EVENT_CONNECTED})
assert(sends[6].type == "join" and sends[6].room == "ROOM12")
print("Defold Lua bridge tests OK")
