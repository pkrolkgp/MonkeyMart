-- Independent Defold WebSocket client for Monkey Mart co-op protocol.
-- Requires official extension-websocket and the Defold global json module.
local Client = {}
Client.__index = Client

function Client.new(options)
    assert(type(options) == "table" and type(options.url) == "string", "url required")
    return setmetatable({
        url = options.url, room = options.room,
        name = options.name or "Gracz", skin = options.skin or "monkey1",
        on_event = options.on_event, connection = nil, connected = false,
        player_id = nil, room_code = nil, move_seq = 0, action_seq = 0,
    }, Client)
end

function Client:_notify(event)
    if self.on_event then self.on_event(event) end
end

function Client:send(message)
    if not self.connected or not self.connection then return false end
    websocket.send(self.connection, json.encode(message), { type = websocket.DATA_TYPE_TEXT })
    return true
end

function Client:connect()
    if self.connection then return false end
    assert(websocket and json, "Defold websocket and json required")
    local function callback(_, connection, data)
        if data.event == websocket.EVENT_CONNECTED then
            self.connected = true
            self:send({type = self.room and "join" or "create", room = self.room,
                       name = self.name, skin = self.skin})
        elseif data.event == websocket.EVENT_MESSAGE then
            local ok, message = pcall(json.decode, data.message)
            if not ok or type(message) ~= "table" then
                self:_notify({type="client_error", error="INVALID_JSON"})
                return
            end
            if message.type == "welcome" then
                self.player_id = message.playerId
                self.room_code = message.room
            end
            self:_notify(message)
        elseif data.event == websocket.EVENT_ERROR then
            self:_notify({type="client_error", error=data.message or "SOCKET_ERROR"})
        elseif data.event == websocket.EVENT_DISCONNECTED then
            self.connection = nil
            self.connected = false
            self.player_id = nil
            self:_notify({type="client_disconnected", code=data.code})
        end
    end
    self.connection = websocket.connect(self.url, {}, callback)
    return true
end

function Client:move(x, y)
    if not self.player_id then return false end
    self.move_seq = self.move_seq + 1
    return self:send({type="move", x=x, y=y, seq=self.move_seq})
end

function Client:skin_change(skin)
    if not self.player_id then return false end
    return self:send({type="skin", skin=skin})
end

function Client:transfer(action, item, quantity)
    if not self.player_id then return nil end
    self.action_seq = self.action_seq + 1
    local requestId = "act-" .. tostring(self.action_seq)
    if self:send({type="action", action=action, item=item, quantity=quantity,
                  requestId=requestId}) then
        return requestId
    end
    return nil
end

function Client:snapshot()
    if not self.player_id then return false end
    return self:send({type="snapshot"})
end

function Client:disconnect()
    if self.connection then websocket.disconnect(self.connection) end
    self.connection = nil
    self.connected = false
    self.player_id = nil
end

return Client
